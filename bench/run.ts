/**
 * One pass of one text model through the script (bench/workflow.ts runs each in a fresh process, with
 * bench/studio-config.ts pointing Studio's imports at this repo's simulated camera); the last pass
 * publishes the model's median into results/toolbench.json. `--median` publishes it from passes already
 * run, and `--perfect` records the perfect run every pass starts its turns from.
 *
 * Each model runs alone on llama-server with its defaults. The script's turns are sent one at a time,
 * word for word, as one conversation, with Studio's system prompt and Studio's real tools (loaded from
 * the darkgrade checkout). Every tool call runs against the simulated camera, and each turn is checked
 * against the answer key. See AGENTS.md "Bench conventions".
 */
import { ANSWER_KEY, type Mistake, type ToolCall, type TurnOutcome, turnCredit } from '@bench/answer-key'
import { type RunningServer, startServer } from '@bench/engines'
import { DROPPED_MODELS, LLAMA_CPP_RELEASE, LLAMA_MODELS, LLAMA_SERVER_BINARY, TEXT_MODELS, type TextModel } from '@bench/models'
import { SCRIPT_PATH, scriptTurns } from '@bench/script'
import { cameraService } from '@main/camera-service'
import type { CameraSnapshot } from '@bench/simulated-camera'
import { studioView } from '@main/studio-view'
import { STUDIO_TOOLS, beginChangeGroup, cameraStatus, endChangeGroup, findTool } from '@main/tools/studio-tools'
import { AGENT_INSTRUCTIONS } from '@bench/system-prompt'
import { toolScore } from '@bench/tool-score'
import { failModel, finishModel, startModel, stepDone, stopModel, stopRequested } from '@bench/progress'
import type { StudioViewState } from '@shared/ipc'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import * as z from 'zod/v4'

const ROOT = resolve(import.meta.dirname, '..')
const RESULTS_PATH = join(ROOT, 'results', 'toolbench.json')
const MODEL_DIRECTORY = join(ROOT, 'results', 'models')
const RAW_DIRECTORY = join(ROOT, 'results', 'raw')
const FRAME_PATH = join(RAW_DIRECTORY, 'frame.jpg')
/** Where the camera and Studio's view should be before each turn, from a perfect run (written by --perfect). */
const PERFECT_PATH = join(RAW_DIRECTORY, 'perfect-run.json')
const DARKGRADE = process.env.DARKGRADE_PATH ?? resolve(ROOT, '..', 'darkgrade')
const RESULTS_VERSION = 1
/** Studio's assistant allows this many model calls per request. */
const MAXIMUM_STEPS = 5
/**
 * The only settings changed from llama-server's defaults, the same for every model (see README): thinking
 * off, because a voice app has to answer at once; and a 64k context, which holds the longest conversation
 * (about 43k tokens) without each model reserving memory for its full context window.
 */
export const SERVER_SETTINGS = ['--reasoning', 'off', '--ctx-size', '65536']
const PASSES_DIRECTORY = join(RAW_DIRECTORY, 'passes')
/**
 * Every model gets this long to decide: its first action, or its answer when it shouldn't act. Past it
 * the turn is cut off and counts as wrong. As in Darkgrade Studio, a tool runs as soon as the model
 * calls it and the short reply comes after, so the reply isn't on this clock.
 */
export const TURN_LIMIT_MS = 10_000
/** After acting, the reply and any follow-up calls get this long before the turn moves on (not scored). */
const AFTER_ACTION_LIMIT_MS = 30_000
const STARTING_VIEW: StudioViewState = { scope: 'histogram', zebras: false, zebraLevelPercent: 95, focusPeaking: false, peakingSensitivity: 50 }

const OPENAI_TOOLS = STUDIO_TOOLS.map(tool => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.inputSchema) } }))
const CHANGING_TOOLS = new Set(STUDIO_TOOLS.filter(tool => tool.changesSomething).map(tool => tool.name))

interface WireCall {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
}

type ChatMessage =
    | { role: 'system' | 'user'; content: string }
    | { role: 'assistant'; content: string | null; tool_calls?: WireCall[] }
    | { role: 'tool'; tool_call_id: string; content: string }

interface Step {
    firstTokenMs: number | null
    endedMs: number
    promptTokens: number | null
    generatedTokens: number | null
    generatedTokensPerSecond: number | null
    content: string
    calls: WireCall[]
    error?: string
}

/** One streamed chat completion with Studio's tools, timed. */
async function step(url: string, messages: ChatMessage[], signal: AbortSignal): Promise<Step> {
    const startedMs = performance.now()
    const record: Step = { firstTokenMs: null, endedMs: 0, promptTokens: null, generatedTokens: null, generatedTokensPerSecond: null, content: '', calls: [] }
    const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // One slot for every request, as Studio does: a turn cut off at the limit must not send the next to an empty slot that re-reads everything.
        body: JSON.stringify({ messages, tools: OPENAI_TOOLS, stream: true, id_slot: 0 }),
        signal,
    })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
    const decoder = new TextDecoder()
    let buffered = ''
    for await (const chunk of response.body) {
        buffered += decoder.decode(chunk, { stream: true })
        const lines = buffered.split('\n')
        buffered = lines.pop() ?? ''
        for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
            const event = JSON.parse(line.slice(6))
            if (event.timings) {
                record.promptTokens = event.timings.prompt_n
                record.generatedTokens = event.timings.predicted_n
                record.generatedTokensPerSecond = event.timings.predicted_per_second
            }
            const delta = event.choices?.[0]?.delta ?? {}
            if (record.firstTokenMs === null && (delta.content || delta.reasoning_content || delta.tool_calls)) record.firstTokenMs = performance.now() - startedMs
            if (delta.content) record.content += delta.content
            for (const part of delta.tool_calls ?? []) {
                const index = part.index ?? record.calls.length
                record.calls[index] ??= { id: part.id ?? `call_${index}`, type: 'function', function: { name: '', arguments: '' } }
                if (part.id) record.calls[index].id = part.id
                if (part.function?.name) record.calls[index].function.name += part.function.name
                if (part.function?.arguments) record.calls[index].function.arguments += part.function.arguments
            }
        }
    }
    record.calls = record.calls.filter(Boolean)
    record.endedMs = performance.now() - startedMs
    return record
}

/** Runs one call against Studio's real tool code and the simulated camera. */
async function runTool(call: WireCall): Promise<{ result: string; record: ToolCall }> {
    const tool = findTool(call.function.name)
    let input: Record<string, unknown> = {}
    try {
        input = call.function.arguments.trim() ? JSON.parse(call.function.arguments) : {}
    } catch {
        return { result: 'Error: the arguments were not valid JSON', record: { name: call.function.name, arguments: {}, valid: false, changesSomething: false } }
    }
    const record: ToolCall = { name: call.function.name, arguments: input, valid: Boolean(tool), changesSomething: CHANGING_TOOLS.has(call.function.name) }
    if (!tool) return { result: `Error: there is no tool called ${call.function.name}`, record }
    const parsed = tool.inputSchema.safeParse(input)
    if (!parsed.success) return { result: `Error: ${parsed.error.message}`, record: { ...record, valid: false } }
    try {
        return { result: JSON.stringify((await tool.run(parsed.data as Record<string, unknown>)).data), record }
    } catch (error) {
        return { result: `Error: ${error instanceof Error ? error.message : String(error)}`, record }
    }
}

interface TurnRecord {
    turn: number
    said: string
    kind: string
    expected: string
    passed: boolean
    /** Mistakes, each "serious: …" or "minor: …". */
    failures: string[]
    /** 1 right, ½ only minor mistakes, 0 any serious mistake. */
    credit: number
    reply: string
    calls: ToolCall[]
    /** Cut off at TURN_LIMIT_MS. */
    timedOut: boolean
    /** From sending the turn until the model finished deciding its first action (or its reply). */
    decisionMs: number | null
    totalMs: number
    steps: number
    generatedTokens: number
}

/** One turn: the script's words appended to the conversation so far, as Studio's assistant hears them. */
async function runTurn(url: string, conversation: ChatMessage[], text: string): Promise<Omit<TurnRecord, 'turn' | 'said' | 'kind' | 'expected' | 'passed' | 'failures' | 'credit'>> {
    const startedMs = performance.now()
    conversation.push({ role: 'user', content: `${text}\n\nCAMERA NOW: ${JSON.stringify(cameraStatus())}` })
    const calls: ToolCall[] = []
    let reply = ''
    let decisionMs: number | null = null
    let steps = 0
    let generatedTokens = 0
    let timedOut = false
    const deciding = AbortSignal.timeout(TURN_LIMIT_MS)
    let afterAction: AbortSignal | null = null
    beginChangeGroup()
    try {
        for (let index = 0; index < MAXIMUM_STEPS; index++) {
            let result: Step
            try {
                result = await step(url, conversation, afterAction ?? deciding)
            } catch (error) {
                timedOut = !afterAction && deciding.aborted
                reply = timedOut || afterAction?.aborted ? reply : `(error: ${error instanceof Error ? error.message : String(error)})`
                break
            }
            steps++
            generatedTokens += result.generatedTokens ?? 0
            const acts = result.calls.some(call => CHANGING_TOOLS.has(call.function.name))
            if (decisionMs === null && (acts || result.calls.length === 0)) {
                decisionMs = performance.now() - startedMs
                afterAction = AbortSignal.timeout(AFTER_ACTION_LIMIT_MS)
            }
            conversation.push({ role: 'assistant', content: result.content || null, ...(result.calls.length ? { tool_calls: result.calls } : {}) })
            reply = result.content.trim()
            if (result.calls.length === 0) break
            for (const call of result.calls) {
                const { result: output, record } = await runTool(call)
                calls.push(record)
                conversation.push({ role: 'tool', tool_call_id: call.id, content: output })
            }
        }
    } finally {
        endChangeGroup()
    }
    return { reply, calls, decisionMs: decisionMs ?? (timedOut ? TURN_LIMIT_MS : null), totalMs: performance.now() - startedMs, steps, generatedTokens, timedOut }
}

function percentile(values: number[], fraction: number): number | null {
    if (values.length === 0) return null
    const sorted = [...values].sort((first, second) => first - second)
    return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)])
}

async function sha256(path: string): Promise<string> {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    return hash.digest('hex')
}

/** A slightly dark, evenly lit test picture with nothing clipped, as the answer key's turn 1 expects. */
function ensureFrame(): void {
    if (existsSync(FRAME_PATH)) return
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720', '-vf', 'eq=brightness=-0.22:contrast=0.55', '-frames:v', '1', FRAME_PATH])
}

function runningEngines(): string[] {
    return execFileSync('ps', ['-Ao', 'pid=,args='])
        .toString()
        .split('\n')
        .filter(line => (line.trim().split(/\s+/)[1] ?? '').split('/').at(-1) === 'llama-server')
}

/**
 * Reads the fixed start of every request (system prompt and tool list, about 5k tokens) once, untimed, as
 * Darkgrade Studio does when it loads a model, so the first turn isn't timed on a one-off read that
 * big dense models can't finish inside the limit. Same for every model.
 */
async function warmUp(url: string): Promise<void> {
    await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: AGENT_INSTRUCTIONS }, { role: 'user', content: 'Ready?' }], tools: OPENAI_TOOLS, max_tokens: 1, id_slot: 0 }),
    })
}

/** Thrown between turns when a stop has been asked for; the model is left out of the results. */
class StopRequested extends Error {}

/** Exit code that tells launch.ts the run was stopped on purpose. */
export const STOPPED_EXIT_CODE = 3

interface PassResult {
    row: Record<string, unknown>
    turns: TurnRecord[]
}

/** One pass of the script; small models run three passes and publish the median (see main). */
async function benchmarkModel(model: TextModel, pass: number, passes: number): Promise<PassResult> {
    if (runningEngines().length) throw new Error('another llama-server is still running, refusing to measure')
    const modelPath = join(LLAMA_MODELS, model.repository.replace('/', '__'), model.file)
    startModel(model.id, scriptTurns().length, passes > 1 ? `Pass ${pass} of ${passes}: loading the model` : undefined)
    const server: RunningServer = await startServer(modelPath, undefined, join(RAW_DIRECTORY, `${model.id}.server.log`), SERVER_SETTINGS)
    const turns = scriptTurns()
    const records: TurnRecord[] = []
    cameraService.reset()
    cameraService.useFrame(FRAME_PATH)
    studioView.report({ ...STARTING_VIEW })
    const conversation: ChatMessage[] = [{ role: 'system', content: AGENT_INSTRUCTIONS }]
    await warmUp(server.url)
    const perfect = JSON.parse(readFileSync(PERFECT_PATH, 'utf8')) as Record<string, { camera: CameraSnapshot; view: StudioViewState }>
    try {
        for (const { turn, text } of turns) {
            if (stopRequested()) throw new StopRequested()
            const expectation = ANSWER_KEY.find(entry => entry.turn === turn)
            if (!expectation) throw new Error(`no answer key entry for turn ${turn}`)
            // Each turn starts where a perfect run would be, so one mistake isn't counted again in later turns.
            cameraService.restore(perfect[turn].camera)
            studioView.report({ ...perfect[turn].view })
            const before = { camera: structuredClone(cameraService.getState()), view: { ...studioView.getState()! } }
            const eventCount = cameraService.events.length
            const result = await runTurn(server.url, conversation, text)
            const after = { camera: structuredClone(cameraService.getState()), view: { ...studioView.getState()! } }
            const outcome: TurnOutcome = { before, after, events: cameraService.events.slice(eventCount), calls: result.calls, reply: result.reply }
            const mistakes: Mistake[] = [...(result.timedOut ? [{ severity: 'serious' as const, reason: `took longer than ${TURN_LIMIT_MS / 1000} s to decide` }] : []), ...expectation.check(outcome)]
            const failures = mistakes.map(mistake => `${mistake.severity}: ${mistake.reason}`)
            records.push({ turn, said: text, kind: expectation.kind, expected: expectation.expected, passed: mistakes.length === 0, failures, credit: turnCredit(mistakes), ...result })
            stepDone(model.id, records.length, turns.length, `${passes > 1 ? `Pass ${pass} of ${passes}, t` : 'T'}urn ${turn}: "${text.length > 60 ? `${text.slice(0, 57)}…` : text}"`, {
                passed: mistakes.length === 0 ? true : mistakes.some(mistake => mistake.severity === 'serious') ? false : undefined,
                note: failures.length ? failures.join('; ') : `${((result.decisionMs ?? result.totalMs) / 1000).toFixed(1)} s`,
            })
            console.log(`  ${model.id} turn ${turn}: ${failures.length ? `FAIL ${failures.join('; ')}` : 'pass'} (${Math.round(result.decisionMs ?? result.totalMs)} ms)`)
        }
    } finally {
        await server.stop()
    }
    if (runningEngines().length) throw new Error('llama-server did not exit')
    const decisions = records.map(record => record.decisionMs).filter((value): value is number => value !== null)
    const calls = records.flatMap(record => record.calls)
    const turnsPassed = records.reduce((sum, record) => sum + record.credit, 0) / records.length
    const seriousShare = records.filter(record => record.credit === 0).length / records.length
    const invalidCallShare = calls.length ? calls.filter(call => !call.valid).length / calls.length : 0
    const decisionMedianMs = percentile(decisions, 0.5)
    const decisionP90Ms = percentile(decisions, 0.9)
    const scored = toolScore({ turnsPassed, seriousShare, invalidCallShare, decisionMedianMs, decisionP90Ms })
    const byKind = (kind: string) => {
        const ofKind = records.filter(record => record.kind === kind)
        return { passed: ofKind.filter(record => record.passed).length, total: ofKind.length }
    }
    writeFileSync(join(RAW_DIRECTORY, `${model.id}.${pass}.json`), JSON.stringify({ model: model.id, pass, conversation }, null, 2))
    const row = {
        id: model.id,
        ...scored,
        name: model.name,
        modelClass: model.modelClass,
        maker: model.maker,
        licence: model.licence,
        source: `https://huggingface.co/${model.repository}`,
        files: [{ name: model.file, bytes: statSync(modelPath).size, sha256: await sha256(modelPath) }],
        sizeGigabytes: Number((statSync(modelPath).size / 1e9).toFixed(2)),
        turnsPassed: Number(turnsPassed.toFixed(4)),
        seriousMistakes: records.filter(record => record.credit === 0).length,
        minorOnly: records.filter(record => record.credit === 0.5).length,
        byKind: { requests: byKind('request'), questions: byKind('question'), cannotDo: byKind('cannot-do'), video: byKind('video') },
        toolCalls: calls.length,
        invalidToolCalls: calls.filter(call => !call.valid).length,
        decisionMedianMs,
        decisionP90Ms,
        decisionMaxMs: percentile(decisions, 1),
        generatedTokens: records.reduce((sum, record) => sum + record.generatedTokens, 0),
        loadSeconds: Number((server.loadMs / 1000).toFixed(1)),
        // macOS leaves the memory-mapped model file out of a process's footprint, so it's added back.
        peakMemoryGigabytes: Number(((server.peakFootprintBytes + statSync(modelPath).size) / 1e9).toFixed(2)),
    }
    return { row, turns: records }
}

/** A failure as it's published: the plain reason, and no paths from the machine that ran it. */
function publishableError(message: string, model: TextModel): string {
    const log = existsSync(join(RAW_DIRECTORY, `${model.id}.server.log`)) ? readFileSync(join(RAW_DIRECTORY, `${model.id}.server.log`), 'utf8') : ''
    const architecture = log.match(/unknown model architecture: '([^']+)'/)?.[1]
    if (architecture) return `Couldn't run: llama.cpp ${LLAMA_CPP_RELEASE} doesn't support this model's architecture ("${architecture}") yet.`
    return message.replaceAll(ROOT, '.').replaceAll(homedir(), '~')
}

const passPath = (id: string, pass: number): string => join(PASSES_DIRECTORY, `${id}.${pass}.json`)

/** The published row: the pass with the median score, so its turn-by-turn page matches its numbers, plus every pass's score. */
function publishMedian(model: TextModel, passes: number, rows: Map<string, Record<string, unknown>>): void {
    const results = Array.from({ length: passes }, (_, index) => JSON.parse(readFileSync(passPath(model.id, index + 1), 'utf8')) as PassResult)
    const byScore = [...results].sort((first, second) => Number(first.row.score ?? -1) - Number(second.row.score ?? -1))
    const median = byScore[Math.floor(byScore.length / 2)]
    const passScores = results.map(result => result.row.score as number | null)
    rows.set(model.id, { ...median.row, passScores })
    writeFileSync(join(MODEL_DIRECTORY, `${model.id}.json`), `${JSON.stringify({ id: model.id, turns: median.turns })}\n`)
    const row = median.row as { score?: number | null; turnsPassed: number; seriousMistakes: number; decisionMedianMs: number | null }
    finishModel(model.id, {
        score: row.score ?? '–',
        ...(passes > 1 ? { passes: passScores.map(score => score ?? '–').join(' · ') } : {}),
        'turns right': `${Math.round(row.turnsPassed * 100)}%`,
        'serious mistakes': row.seriousMistakes,
        'typical wait': `${((row.decisionMedianMs ?? 0) / 1000).toFixed(1)} s`,
    })
}

function command(binary: string, ...argumentsGiven: string[]): string {
    const result = spawnSync(binary, argumentsGiven)
    return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
}

async function runDetails(): Promise<Record<string, unknown>> {
    return {
        benchmark: 'toolbench',
        version: RESULTS_VERSION,
        date: new Date().toISOString(),
        hardware: {
            machine: command('sysctl', '-n', 'hw.model'),
            chip: command('sysctl', '-n', 'machdep.cpu.brand_string'),
            memoryGigabytes: Number(command('sysctl', '-n', 'hw.memsize')) / 2 ** 30,
            cores: Number(command('sysctl', '-n', 'hw.ncpu')),
            macOS: `${command('sw_vers', '-productVersion')} (${command('sw_vers', '-buildVersion')})`,
        },
        engines: { llamaServer: command(LLAMA_SERVER_BINARY, '--version').match(/version: [^\n]+/)?.[0] ?? 'unknown', harness: `bun ${process.versions.bun}` },
        input: {
            script: 'script/video-script.md',
            scriptSha256: await sha256(SCRIPT_PATH),
            turns: scriptTurns().length,
            tools: { source: 'darkgrade/darkgrade apps/studio/src/main/tools/studio-tools.ts', commit: command('git', '-C', DARKGRADE, 'rev-parse', 'HEAD'), count: STUDIO_TOOLS.length },
        },
        dropped: DROPPED_MODELS,
        method: {
            settings: "Each model on llama-server with its defaults except two settings, the same for all: thinking off (`--reasoning off`), because a voice app has to act at once; and a 64k context (`--ctx-size 65536`), which holds the longest conversation (about 43k tokens) without a model reserving memory for its whole context window, so memory used reflects the model. The only other arguments are the model file and a port; requests carry no sampling options.",
            input: "The script's turns, word for word (a perfect transcript), sent one at a time as one conversation. Each turn also carries the camera's current status, as Darkgrade Studio's assistant does. The system prompt is Studio's assistant prompt plus one line saying the person is filming.",
            tools: "Darkgrade Studio's own tool library, unchanged, running against a simulated camera that starts as the script's setup describes. Up to five model calls per turn, as in Studio.",
            accuracy: "Each turn is checked against the answer key by outcome: where the camera and Studio end up, not which tools were used. Lookups never count against a model and an answer's wording isn't graded. Mistakes are serious (ruins a take or your work: recording started or stopped at the wrong time, an unasked photo or download, the wrong file, the picture changed mid-take, a mode change not made, a false claim) or minor (a small adjustment missed or off, a harmless extra). A turn counts 1 when right, ½ with only minor mistakes, 0 with any serious one.",
            latency: "From sending a turn to the model finishing its first action, or its reply when it shouldn't act. After loading, each model reads the fixed start of every request (system prompt and tools) once, untimed, as Studio does on load.",
            timeLimit: `${TURN_LIMIT_MS / 1000} s for every model to decide: its first action, or its answer when it shouldn't act (read-only lookups first count toward it). Past it, the turn is cut off and counts as wrong and as a ${TURN_LIMIT_MS / 1000} s wait. As in Darkgrade Studio, a tool runs as soon as it's called and the short reply comes afterwards, so the reply isn't timed.`,
            score: 'A 0–100 score from fixed scales, so it doesn\'t change when other models are added: right outcome (45%: half the turns\' credit scores 0, all of it 100), serious mistakes (15%: on a quarter of turns scores 0, none 100), clean tool calls (5%: one call in five invalid scores 0, none 100), typical wait (25%: 10 s scores 0, 0.3 s scores 100) and slow wait, the slowest 1 in 10 (10%: 10 s scores 0, 1 s scores 100), waits on a log scale.',
            isolation: 'One model at a time. The run refuses to start a model while another llama-server is alive, and confirms each has exited.',
            runs: 'Small models run the script three times, each in a fresh process, and publish the run with the median score; one run can swing by 10–20 points for them, because one early choice carries through the conversation. Mixture-of-experts models run once.',
        },
    }
}

/** Plays the answer key's perfect calls once and records where the camera and view are before each turn. */
async function recordPerfectRun(): Promise<void> {
    mkdirSync(RAW_DIRECTORY, { recursive: true })
    ensureFrame()
    cameraService.reset()
    cameraService.useFrame(FRAME_PATH)
    studioView.report({ ...STARTING_VIEW })
    const states: Record<number, { camera: CameraSnapshot; view: StudioViewState }> = {}
    for (const { turn } of scriptTurns()) {
        states[turn] = { camera: cameraService.snapshot(), view: { ...studioView.getState()! } }
        beginChangeGroup()
        for (const call of ANSWER_KEY.find(entry => entry.turn === turn)!.perfect) {
            const { result } = await runTool({ id: 'perfect', type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } })
            if (result.startsWith('Error')) throw new Error(`perfect run, turn ${turn}, ${call.name}: ${result}`)
        }
        endChangeGroup()
    }
    writeFileSync(PERFECT_PATH, JSON.stringify(states))
    console.log(`toolbench: recorded a perfect run of ${Object.keys(states).length} turns`)
}

async function main(): Promise<void> {
    const argumentsGiven = process.argv.slice(2)
    if (argumentsGiven.includes('--perfect')) return recordPerfectRun()
    // Every pass already run (kept from an earlier run): only the median is published again.
    const medianOnly = argumentsGiven.includes('--median')
    const listed = argumentsGiven.includes('--models') ? argumentsGiven[argumentsGiven.indexOf('--models') + 1].split(',') : null
    const models = listed ? TEXT_MODELS.filter(model => listed.includes(model.id)) : TEXT_MODELS
    mkdirSync(RAW_DIRECTORY, { recursive: true })
    mkdirSync(MODEL_DIRECTORY, { recursive: true })
    ensureFrame()
    const details = await runDetails()
    const previous = existsSync(RESULTS_PATH) ? ((JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as { models?: { id: string }[] }).models ?? []) : []
    const rows = new Map(previous.map(row => [row.id, row as Record<string, unknown>]))
    console.log(`toolbench: ${models.length} models × ${scriptTurns().length} turns`)
    const pass = argumentsGiven.includes('--pass') ? Number(argumentsGiven[argumentsGiven.indexOf('--pass') + 1]) : 1
    const passes = argumentsGiven.includes('--passes') ? Number(argumentsGiven[argumentsGiven.indexOf('--passes') + 1]) : 1
    mkdirSync(PASSES_DIRECTORY, { recursive: true })
    for (const model of models) {
        console.log(`toolbench: ${model.id}${passes > 1 ? ` pass ${pass} of ${passes}` : ''}`)
        try {
            if (!medianOnly) writeFileSync(passPath(model.id, pass), JSON.stringify({ ...(await benchmarkModel(model, pass, passes)), scriptSha256: details.input && (details.input as { scriptSha256: string }).scriptSha256 }))
            if (pass < passes) continue
            publishMedian(model, passes, rows)
        } catch (error) {
            if (error instanceof StopRequested) {
                console.log(`  ${model.id} stopped`)
                stopModel(model.id)
                process.exit(STOPPED_EXIT_CODE)
            }
            const message = publishableError(error instanceof Error ? error.message : String(error), model)
            console.log(`  ${model.id} failed: ${message}`)
            failModel(model.id, message)
            rows.set(model.id, { id: model.id, name: model.name, maker: model.maker, error: message })
            if (runningEngines().length) throw new Error(`stopping: llama-server still running after ${model.id} failed`)
        }
        const ordered = [...rows.values()].sort((first, second) => Number(second.score ?? -1) - Number(first.score ?? -1))
        writeFileSync(RESULTS_PATH, `${JSON.stringify({ ...details, models: ordered }, null, 2)}\n`)
    }
}

if (import.meta.main) await main()
