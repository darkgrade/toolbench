/**
 * Toolbench as a workflow (Outpost's workflows). One run:
 *
 *   toolbench ─┬─ perfect              where the camera and Studio should be before each turn
 *              ├─ model × N ── pass × 1–3   one pass of the script, in a fresh process (bench/run.ts)
 *              └─ publish              results/toolbench.json and results/models/*.json, to GitHub
 *
 * Models run one at a time (a concurrency limit of one on the GPU). Small models run three passes and
 * publish the median; mixture-of-experts models run one. A pass is kept under the script, the model's
 * file, the harness and Studio's tools, so a later run reuses it; "Run without cache" (force) redoes all.
 */
import { TEXT_MODELS, LLAMA_MODELS, type TextModel } from '@bench/models'
import { DARKGRADE, ROOT, writeStudioConfig } from '@bench/studio-config'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createInterface } from 'node:readline'
import { type JsonObject, type TaskContext, fileHash, workflows } from 'outpost-workflows'

const REPOSITORY = 'darkgrade/toolbench'
const RESULTS_PATH = join(ROOT, 'results', 'toolbench.json')
const MODEL_DIRECTORY = join(ROOT, 'results', 'models')
const PASSES_DIRECTORY = join(ROOT, 'results', 'raw', 'passes')

type RunInput = { models?: string[]; force?: boolean }
type ModelInput = { model: string; force?: boolean; key: string }
type PassInput = { model: string; pass: number; passes: number; force?: boolean; key: string }
type Row = JsonObject

/** Small models' scores swing between runs, so they run three times; mixture-of-experts models once. */
const passesFor = (model: TextModel): number => (model.modelClass === 'small' ? 3 : 1)
const modelById = (id: string): TextModel => {
    const model = TEXT_MODELS.find(candidate => candidate.id === id)
    if (!model) throw new Error(`unknown model ${id}`)
    return model
}
const modelFile = (model: TextModel) => join(LLAMA_MODELS, model.repository.replace('/', '__'), model.file)

/** What makes two passes "the same": the script, the harness, and the Studio tools they ran against. */
function inputKey(): string {
    const bench = readdirSync(join(ROOT, 'bench'))
        .filter(name => name.endsWith('.ts') && !['workflow.ts', 'worker.ts', 'start.ts'].includes(name))
        .sort()
        .map(name => fileHash(join(ROOT, 'bench', name)))
    const tools = spawnSync('git', ['-C', DARKGRADE, 'rev-parse', 'HEAD:apps/studio/src/main/tools'], { encoding: 'utf8' }).stdout.trim()
    return [fileHash(join(ROOT, 'script', 'video-script.md')), ...bench, tools].join('|')
}
const modelStamp = (model: TextModel) => {
    const path = modelFile(model)
    return existsSync(path) ? `${statSync(path).size}:${statSync(path).mtimeMs}` : 'missing'
}

/** One run of bench/run.ts in a fresh process; its progress lines go to the task's log. Cancelling the run ends it. */
async function runHarness(argumentsGiven: string[], context: TaskContext): Promise<void> {
    const child = spawn('bun', ['--tsconfig-override', writeStudioConfig(), join(ROOT, 'bench', 'run.ts'), ...argumentsGiven], { cwd: ROOT, env: { ...process.env, DARKGRADE_PATH: DARKGRADE }, stdio: ['ignore', 'pipe', 'pipe'] })
    const stop = () => child.kill('SIGINT')
    context.signal.addEventListener('abort', stop)
    const errors: string[] = []
    createInterface({ input: child.stderr! }).on('line', line => errors.push(line))
    for await (const line of createInterface({ input: child.stdout! })) if (line.startsWith('progress ')) await context.log(line.slice('progress '.length))
    const code = await new Promise<number>(resolve => (child.exitCode !== null ? resolve(child.exitCode) : child.on('exit', status => resolve(status ?? 1))))
    context.signal.removeEventListener('abort', stop)
    if (context.signal.aborted) throw new Error('Cancelled')
    if (code !== 0) throw new Error(errors.slice(-5).join('\n') || `bench/run.ts exited with ${code}`)
}

const passPath = (id: string, pass: number) => join(PASSES_DIRECTORY, `${id}.${pass}.json`)
const keptPass = (input: PassInput) => {
    const path = passPath(input.model, input.pass)
    if (input.force || !existsSync(path)) return false
    return (JSON.parse(readFileSync(path, 'utf8')) as { key?: string }).key === input.key
}
const rowOf = (id: string): Row | undefined => ((JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as { models: Row[] }).models ?? []).find(row => row.id === id)

export async function toolbench() {
    const { task, serve, start } = await workflows('toolbench')

    const perfect = task<{ force?: boolean }, { summary: string }>({
        name: 'perfect',
        timeout: '10m',
        fn: async (_input, context) => {
            await runHarness(['--perfect'], context)
            return { summary: 'Recorded the perfect run' }
        },
    })

    const passTask = task<PassInput, { kept: boolean; score: number | null; summary: string }>({
        name: 'pass',
        timeout: '2h',
        fn: async (input, context) => {
            if (keptPass(input)) return { kept: true, score: null, summary: 'Reused from an earlier run' }
            await runHarness(['--models', input.model, '--pass', String(input.pass), '--passes', String(input.passes)], context)
            // The pass file is the harness's; it's marked with what it ran on, so later runs can reuse it.
            const path = passPath(input.model, input.pass)
            const saved = JSON.parse(readFileSync(path, 'utf8')) as { row?: { score?: number | null }; key?: string }
            writeFileSync(path, JSON.stringify({ ...saved, key: input.key }))
            const score = saved.row?.score ?? null
            return { kept: false, score, summary: `Score ${score ?? '–'}` }
        },
    })

    const modelTask = task<ModelInput, { row: Row; summary: string }>({
        name: 'model',
        concurrency: { key: 'gpu', max: 1 },
        timeout: '6h',
        fn: async (input, context) => {
            const model = modelById(input.model)
            const passes = passesFor(model)
            const key = `${input.key}|${modelStamp(model)}`
            const results = []
            for (let pass = 1; pass <= passes; pass++) results.push(await passTask.run({ model: model.id, pass, passes, force: input.force, key }, { label: passes > 1 ? `Pass ${pass} of ${passes}` : 'Pass', key: `pass:${model.id}:${pass}` }))
            // The last pass publishes the median when it runs; when every pass was kept, publish it from them.
            if (results.at(-1)!.kept) await runHarness(['--models', model.id, '--pass', String(passes), '--passes', String(passes), '--median'], context)
            const row = rowOf(model.id)
            if (!row) throw new Error(`No results row for ${model.id}`)
            if (row.error) throw new Error(String(row.error))
            return { row, summary: `Score ${row.score ?? '–'}${passes > 1 ? ` (passes ${(row.passScores as (number | null)[]).map(score => score ?? '–').join(' · ')})` : ''}` }
        },
    })

    const publishTask = task<{ models: string[] }, { commit: string | null; summary: string }>({
        name: 'publish',
        fn: async (input, context) => {
            const files: Record<string, string> = { [relative(ROOT, RESULTS_PATH)]: readFileSync(RESULTS_PATH, 'utf8') }
            for (const id of input.models) {
                const detail = join(MODEL_DIRECTORY, `${id}.json`)
                if (existsSync(detail)) files[relative(ROOT, detail)] = readFileSync(detail, 'utf8')
            }
            if (!context.inOutpost) return { commit: null, summary: 'Written here (not in Outpost, so not published)' }
            const { commit } = await context.publish({ repo: REPOSITORY, files, message: 'Update results' })
            return { commit, summary: commit ? `Published ${commit.slice(0, 7)}` : 'Nothing changed' }
        },
    })

    const run = task<RunInput, { scored: number; summary: string }>({
        name: 'toolbench',
        timeout: '72h',
        fn: async (input, context) => {
            mkdirSync(PASSES_DIRECTORY, { recursive: true })
            const models = input.models ?? TEXT_MODELS.map(model => model.id)
            await context.plan([
                { key: 'perfect', label: 'Perfect run', kind: 'perfect' },
                ...models.flatMap(id => {
                    const passes = passesFor(modelById(id))
                    return [
                        { key: `model:${id}`, label: modelById(id).name, kind: 'model' },
                        ...Array.from({ length: passes }, (_, index) => ({ key: `pass:${id}:${index + 1}`, label: passes > 1 ? `Pass ${index + 1} of ${passes}` : 'Pass', kind: 'pass', parent: `model:${id}` })),
                    ]
                }),
                { key: 'publish', label: 'Publish', kind: 'publish' },
            ])
            await perfect.run({}, { label: 'Perfect run', key: 'perfect' })
            const key = inputKey()
            const rows: Row[] = []
            for (const id of models) {
                try {
                    rows.push((await modelTask.run({ model: id, force: input.force, key }, { label: modelById(id).name, key: `model:${id}` })).row)
                } catch (error) {
                    rows.push({ id, error: error instanceof Error ? error.message : String(error) })
                }
            }
            const published = await publishTask.run({ models }, { label: 'Publish', key: 'publish' })
            const scored = rows.filter(row => !row.error).length
            return { scored, summary: `${scored} of ${rows.length} models scored · ${published.summary}` }
        },
    })

    return { serve, start, run }
}
