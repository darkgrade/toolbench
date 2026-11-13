/**
 * Joins the published results into the two files the overview's views load: public/data/shoot.json
 * (every model's every turn: its credit, wait, mistakes and tool calls, with the camera's state before
 * each turn) and src/facts.json (the few tallies the story's captions quote, small enough to bundle
 * and prerender). Runs before `vite` and `vite build`; neither file is committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface ModelRow {
    id: string
    score?: number | null
    error?: string
}

interface RecordedTurn {
    turn: number
    said: string
    kind: string
    expected: string
    credit?: number
    failures: string[]
    calls: { name: string; arguments: Record<string, unknown>; valid: boolean; changesSomething?: boolean }[]
    decisionMs: number | null
    timedOut?: boolean
}

const ROOT = resolve(import.meta.dirname, '..')
const read = <T>(...path: string[]): T => JSON.parse(readFileSync(join(ROOT, ...path), 'utf8')) as T

const results = read<{ models: ModelRow[] }>('results', 'toolbench.json')
const models = results.models.filter(model => !model.error && model.score !== undefined && model.score !== null)
const script = readFileSync(join(ROOT, 'script', 'video-script.md'), 'utf8').split('## Answer key')[0]

/** The script's stretches, in order, named for people rather than as the stage directions word them. */
const ACT_LABELS = ['Setting up', 'Take 1', 'Between takes', 'Take 2', 'Wrapping up']
const acts: { label: string; from: number; to: number; recording: boolean }[] = []
for (const line of script.split('\n').map(text => text.trim())) {
    if (/^\*—.*—\*$/.test(line)) acts.push({ label: ACT_LABELS[acts.length] ?? line, from: 0, to: 0, recording: /\(recording\)/.test(line) })
    const turn = /^(\d+)\.\s/.exec(line)
    if (turn && acts.length) {
        const act = acts[acts.length - 1]
        act.from ||= Number(turn[1])
        act.to = Number(turn[1])
    }
}

const runs = models.map(model => read<{ turns: RecordedTurn[] }>('results', 'models', `${model.id}.json`).turns)
const turns = runs[0].map(turn => ({
    turn: turn.turn,
    said: turn.said,
    kind: turn.kind,
    expected: turn.expected,
    act: acts.findIndex(act => turn.turn >= act.from && turn.turn <= act.to),
}))

const shoot = {
    models: models.map(model => model.id),
    acts,
    turns,
    before: read<unknown[]>('results', 'perfect.json'),
    /** One row per model, one cell per turn: credit, wait in ms (null when it never decided), then only what applies. */
    runs: runs.map(run =>
        run.map(turn => ({
            credit: turn.credit ?? (turn.failures.length ? 0 : 1),
            wait: turn.decisionMs === null ? null : Math.round(turn.decisionMs),
            ...(turn.timedOut ? { timedOut: true } : {}),
            ...(turn.failures.length ? { failures: turn.failures } : {}),
            ...(turn.calls.length ? { calls: turn.calls.map(call => ({ name: call.name, arguments: call.arguments, ...(call.valid ? {} : { invalid: true }) })) } : {}),
        }))
    ),
}

/** Per turn, how many models got it right, slipped, made a serious mistake or ran out of time. */
const tally = turns.map((_, index) => {
    const cells = shoot.runs.map(run => run[index])
    return {
        right: cells.filter(cell => cell.credit === 1).length,
        minor: cells.filter(cell => cell.credit === 0.5).length,
        serious: cells.filter(cell => cell.credit === 0 && !cell.timedOut).length,
        timedOut: cells.filter(cell => cell.timedOut).length,
    }
})
const failed = (index: number, pattern: RegExp): number => shoot.runs.filter(run => run[index].failures?.some(failure => pattern.test(failure))).length
const indexes = (kind: string): number[] => turns.flatMap((turn, index) => (turn.kind === kind ? [index] : []))
const facts = {
    /** The script's stretches, for pages that don't load the whole shoot. */
    acts,
    tally,
    /** Models that changed or stopped something during at least one line of the video. */
    brokeATake: shoot.runs.filter(run => indexes('video').some(index => run[index].credit < 1)).length,
    /** Models that acted on at least one question. */
    actedOnAQuestion: shoot.runs.filter(run => indexes('question').some(index => run[index].failures?.some(failure => /unasked|changed/.test(failure)))).length,
    /** Models that said they did what no tool can do. */
    claimedTheImpossible: indexes('cannot-do').reduce((total, index) => total + failed(index, /claimed/), 0),
    /** Models that left the camera rolling, or never started it, at least once. */
    missedRecording: shoot.runs.filter(run => run.some(cell => cell.failures?.some(failure => /still recording|not recording/.test(failure)))).length,
    perfectRuns: shoot.runs.filter(run => run.every(cell => cell.credit === 1)).length,
}

mkdirSync(join(ROOT, 'public', 'data'), { recursive: true })
writeFileSync(join(ROOT, 'public', 'data', 'shoot.json'), JSON.stringify(shoot))
writeFileSync(join(ROOT, 'src', 'facts.json'), `${JSON.stringify(facts)}\n`)
console.log(`toolbench: wrote ${models.length} models × ${turns.length} turns for the site`)
