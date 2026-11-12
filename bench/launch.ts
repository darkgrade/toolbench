/**
 * Runs the benchmark against Darkgrade Studio's real tool code. Studio's tools import Studio's camera
 * service and Electron; this writes a TypeScript config that points those two imports at this repo's
 * simulated camera and Electron stand-in, and everything else at the darkgrade checkout
 * (DARKGRADE_PATH, by default ../darkgrade), then starts bench/run.ts with it.
 *
 *   bun run bench [-- --models id,id] [-- --resume]
 *   bun run bench:stop      stop after the current turn (or the Stop button on /progress)
 *
 * Small models run three passes and publish the median; mixture-of-experts models run one.
 * --resume skips models already in results/toolbench.json, and passes already run, from a run of the same script.
 */
import { LLAMA_MODELS, TEXT_MODELS } from '@bench/models'
import { finishRun, startRun, stopRequested } from '@bench/progress'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const darkgrade = resolve(process.env.DARKGRADE_PATH ?? join(root, '..', 'darkgrade'))
const studio = join(darkgrade, 'apps', 'studio', 'src')
if (!existsSync(join(studio, 'main', 'tools', 'studio-tools.ts'))) {
    console.error(`No Darkgrade Studio checkout at ${darkgrade}. Set DARKGRADE_PATH to it.`)
    process.exit(2)
}
const config = join(root, '.darkgrade-tsconfig.json')
writeFileSync(
    config,
    JSON.stringify(
        {
            compilerOptions: {
                target: 'ES2023',
                module: 'ESNext',
                moduleResolution: 'bundler',
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                types: ['node', 'bun'],
                paths: {
                    electron: [join(root, 'bench', 'electron-stand-in.ts')],
                    '@main/camera-service': [join(root, 'bench', 'simulated-camera.ts')],
                    '@main/*': [join(studio, 'main', '*')],
                    '@shared/*': [join(studio, 'shared', '*')],
                    '@bench/*': [join(root, 'bench', '*')],
                    // One copy of zod, Studio's, so schemas built by its tools convert with the same library.
                    'zod/v4': [join(darkgrade, 'apps', 'studio', 'node_modules', 'zod', 'v4')],
                },
            },
            include: [join(root, 'bench', '**', '*.ts')],
        },
        null,
        4
    )
)
if (process.argv.includes('--typecheck')) process.exit(spawnSync('npx', ['tsc', '-p', config], { cwd: root, stdio: 'inherit' }).status ?? 1)

const run = (...argumentsGiven: string[]): number =>
    spawnSync('bun', ['--tsconfig-override', config, join(root, 'bench', 'run.ts'), ...argumentsGiven], { cwd: root, stdio: 'inherit', env: { ...process.env, DARKGRADE_PATH: darkgrade } }).status ?? 1

// Studio's tools keep their undo history in memory, so each model gets a fresh process.
if (run('--perfect') !== 0) process.exit(1)
const listed = process.argv.includes('--models') ? process.argv[process.argv.indexOf('--models') + 1].split(',') : null
const models = TEXT_MODELS.filter(candidate => !listed || listed.includes(candidate.id))
const sizeGigabytes = (repository: string, file: string): number => {
    const path = join(LLAMA_MODELS, repository.replace('/', '__'), file)
    return existsSync(path) ? statSync(path).size / 1e9 : 5
}
/** Models already done with this exact script, kept when resuming. */
function alreadyDone(): Map<string, Record<string, string | number>> {
    const resultsPath = join(root, 'results', 'toolbench.json')
    if (!process.argv.includes('--resume') || !existsSync(resultsPath)) return new Map()
    const results = JSON.parse(readFileSync(resultsPath, 'utf8')) as { input?: { scriptSha256?: string }; models?: { id: string; error?: string; score?: number; turnsPassed?: number; seriousMistakes?: number; decisionMedianMs?: number }[] }
    const script = createHash('sha256').update(readFileSync(join(root, 'script', 'video-script.md'))).digest('hex')
    if (results.input?.scriptSha256 !== script) return new Map()
    return new Map(
        (results.models ?? [])
            .filter(model => !model.error && model.score !== undefined && ((model as { passScores?: unknown[] }).passScores?.length ?? 1) >= passesFor(TEXT_MODELS.find(candidate => candidate.id === model.id) ?? TEXT_MODELS[0]))
            .map(model => [model.id, { score: model.score ?? '–', 'turns right': `${Math.round((model.turnsPassed ?? 0) * 100)}%`, 'serious mistakes': model.seriousMistakes ?? 0, 'typical wait': `${((model.decisionMedianMs ?? 0) / 1000).toFixed(1)} s` }])
    )
}

/** Small models' scores swing between runs, so they run three times; mixture-of-experts models once. */
const passesFor = (model: (typeof TEXT_MODELS)[number]): number => (model.modelClass === 'small' ? 3 : 1)
const passesDirectory = join(root, 'results', 'raw', 'passes')
const resuming = process.argv.includes('--resume')
if (!resuming) rmSync(passesDirectory, { recursive: true, force: true })
const script = createHash('sha256').update(readFileSync(join(root, 'script', 'video-script.md'))).digest('hex')
const passDone = (id: string, pass: number): boolean => {
    const path = join(passesDirectory, `${id}.${pass}.json`)
    return resuming && existsSync(path) && (JSON.parse(readFileSync(path, 'utf8')) as { scriptSha256?: string }).scriptSha256 === script
}

const done = alreadyDone()
startRun('toolbench', models.map(model => ({ id: model.id, name: model.name, sizeGigabytes: sizeGigabytes(model.repository, model.file) })), done)
process.on('SIGINT', () => {
    finishRun('stopped')
    process.exit(130)
})
for (const model of models.filter(candidate => !done.has(candidate.id))) {
    if (stopRequested()) break
    let status = 0
    for (let pass = 1; pass <= passesFor(model) && status === 0; pass++) {
        if (pass < passesFor(model) && passDone(model.id, pass)) continue
        if (stopRequested()) status = 3
        else status = run('--models', model.id, '--pass', String(pass), '--passes', String(passesFor(model)))
    }
    if (status === 3) break
    if (status !== 0) {
        finishRun('stopped')
        process.exit(1)
    }
}
finishRun(stopRequested() ? 'stopped' : 'finished')
