/**
 * Turns: the whole shoot as a grid, every model against every turn. Pick a turn to see what was
 * asked, how the field did, and the different things models actually did with it.
 */
import type { ViewProps } from '@site/app'
import { BENCH, MODELS, seconds } from '@site/data'
import { Loading } from '@site/kit/shell'
import { INK, TYPE } from '@site/kit/theme'
import { type Call, type Cell, KIND_LABELS, OUTCOMES, type Outcome, type Shoot, callArguments, mistake, outcome, shortName, summary, useShoot } from '@site/shoot'
import { LOOKUPS } from '@site/views/watch/look'
import { useEffect, useMemo, useState } from 'react'

const LIMIT = 10_000
const FASTEST = 300
const ORDER: Outcome[] = ['right', 'minor', 'serious', 'timedOut']

/** What a model did to the camera on a turn, as one line; lookups don't count. */
function action(cell: Cell): string {
    if (cell.timedOut) return 'Ran out of time'
    const calls = (cell.calls ?? []).filter(call => !LOOKUPS.has(call.name))
    if (!calls.length) return 'Did nothing to the camera'
    return calls.map((call: Call) => `${call.name}${call.invalid ? ' (invalid)' : ''} ${callArguments(call)}`.trim()).join('  →  ')
}

interface Group {
    action: string
    models: number[]
    outcomes: Outcome[]
}

/** The distinct things models did on a turn, most common first. */
function groups(shoot: Shoot, turn: number): Group[] {
    const found = new Map<string, Group>()
    shoot.runs.forEach((run, model) => {
        const key = action(run[turn])
        const group = found.get(key) ?? { action: key, models: [], outcomes: [] }
        group.models.push(model)
        group.outcomes.push(outcome(run[turn]))
        found.set(key, group)
    })
    return [...found.values()].sort((first, second) => second.models.length - first.models.length)
}

function Grid({ shoot, turn, model, onPick }: { shoot: Shoot; turn: number; model: number | null; onPick: (turn: number, model: number | null) => void }) {
    return (
        <div className="overflow-x-auto pb-2">
            <table className="border-separate border-spacing-[2px]">
                <thead>
                    <tr>
                        <th />
                        {shoot.acts.map(act => (
                            <th key={act.label} colSpan={act.to - act.from + 1} className="pr-2 pb-1 text-left text-[11px] font-normal whitespace-nowrap" style={{ color: act.recording ? INK.accent : INK.muted }}>
                                {act.label}
                            </th>
                        ))}
                    </tr>
                    <tr>
                        <th />
                        {shoot.turns.map((item, index) => (
                            <th key={item.turn} className={shoot.turns[index + 1]?.act !== item.act ? 'pr-2' : undefined}>
                                <button
                                    onClick={() => onPick(index, null)}
                                    aria-label={`Turn ${item.turn}: ${item.said}`}
                                    className={`${TYPE.number} block w-full rounded-sm py-0.5 text-[10px] font-normal ${index === turn ? 'bg-white/15 text-foreground' : 'text-muted-foreground hover:bg-white/8'}`}
                                >
                                    {item.turn}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {shoot.runs.map((run, row) => (
                        <tr key={shoot.models[row]}>
                            <th className="max-w-40 truncate pr-2 text-right text-[11px] font-normal sm:max-w-56">
                                <a href={`${BENCH.path}${shoot.models[row]}/`} className={`hover:underline ${row === model ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {shortName(summary(shoot.models[row]))}
                                </a>
                            </th>
                            {run.map((cell, index) => (
                                <td key={index} className={`p-0 ${shoot.turns[index + 1]?.act !== shoot.turns[index].act ? 'pr-2' : ''}`}>
                                    <button
                                        onClick={() => onPick(index, row)}
                                        aria-label={`${summary(shoot.models[row]).name}, turn ${index + 1}: ${OUTCOMES[outcome(cell)].label}`}
                                        className={`block size-3.5 rounded-[3px] transition-opacity sm:size-4 ${index === turn && row === model ? 'ring-2 ring-white' : ''}`}
                                        style={{ background: OUTCOMES[outcome(cell)].color, opacity: index === turn || row === model ? 1 : 0.45 }}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function Waits({ shoot, turn, model }: { shoot: Shoot; turn: number; model: number | null }) {
    const across = (milliseconds: number | null): number => (Math.log(Math.min(LIMIT, Math.max(FASTEST, milliseconds ?? LIMIT)) / FASTEST) / Math.log(LIMIT / FASTEST)) * 100
    return (
        <div>
            <div className="relative h-8">
                {[1000, 3000].map(tick => (
                    <span key={tick} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${across(tick)}%` }} />
                ))}
                {shoot.runs.map((run, row) => (
                    <span
                        key={row}
                        className={`absolute top-1/2 size-2 -translate-1/2 rounded-full ${row === model ? 'z-10 ring-2 ring-white' : ''}`}
                        style={{ left: `${across(run[turn].timedOut ? LIMIT : run[turn].wait)}%`, background: OUTCOMES[outcome(run[turn])].color, opacity: row === model ? 1 : 0.75 }}
                    />
                ))}
            </div>
            <div className="relative h-4 text-[11px] text-muted-foreground">
                <span className="absolute left-0">0.3 s</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${across(1000)}%` }}>
                    1 s
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: `${across(3000)}%` }}>
                    3 s
                </span>
                <span className="absolute right-0">10 s</span>
            </div>
        </div>
    )
}

export default function TurnsView({ onOpen }: ViewProps) {
    const loaded = useShoot()
    const [turn, setTurn] = useState(18)
    const [model, setModel] = useState<number | null>(null)
    const shoot = loaded instanceof Error ? undefined : loaded
    useEffect(() => {
        const asked = Number(new URLSearchParams(location.search).get('turn'))
        if (asked >= 1) setTurn(asked - 1)
    }, [])
    const found = useMemo(() => (shoot ? groups(shoot, Math.min(turn, shoot.turns.length - 1)) : []), [shoot, turn])
    if (loaded instanceof Error) return <p className="p-8 text-sm text-muted-foreground">The shoot couldn't be loaded. Try again in a moment.</p>
    if (!shoot) return <Loading />

    const item = shoot.turns[turn]
    const cells = shoot.runs.map(run => run[turn])
    const tally = ORDER.map(kind => ({ kind, count: cells.filter(cell => outcome(cell) === kind).length })).filter(entry => entry.count)
    const picked = model === null ? null : cells[model]
    return (
        <div className="h-full overflow-y-auto" style={{ background: INK.background }}>
            <div className="mx-auto flex max-w-[92rem] flex-col gap-8 px-4 py-4 sm:px-8 xl:flex-row xl:items-start">
                <div className="min-w-0 xl:sticky xl:top-4">
                    <Grid
                        shoot={shoot}
                        turn={turn}
                        model={model}
                        onPick={(nextTurn, nextModel) => {
                            setTurn(nextTurn)
                            setModel(nextModel)
                        }}
                    />
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ORDER.map(kind => (
                            <span key={kind} className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-[2px]" style={{ background: OUTCOMES[kind].color }} />
                                {OUTCOMES[kind].label}
                            </span>
                        ))}
                    </p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-5 xl:min-w-96">
                    <div className="flex flex-col gap-2">
                        <p className={TYPE.label}>
                            Turn {item.turn} · <span style={{ color: shoot.acts[item.act].recording ? INK.accent : undefined }}>{shoot.acts[item.act].label}</span> · {KIND_LABELS[item.kind]}
                        </p>
                        <h2 className={`${TYPE.title} line-clamp-4`}>“{item.said}”</h2>
                        <p className="text-sm text-muted-foreground">Should happen: {item.expected}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                            {tally.map(entry => (
                                <span key={entry.kind} style={{ flex: entry.count, background: OUTCOMES[entry.kind].color }} />
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {tally.map(entry => `${entry.count} ${OUTCOMES[entry.kind].label.toLowerCase()}`).join(' · ')} of {MODELS.length} models
                        </p>
                    </div>
                    {picked && model !== null && (
                        <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                            <p className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">{summary(shoot.models[model]).name}</span>
                                <span style={{ color: OUTCOMES[outcome(picked)].color }}>
                                    {OUTCOMES[outcome(picked)].label} · {picked.wait === null ? 'no answer' : seconds(picked.wait)}
                                </span>
                            </p>
                            {picked.failures?.map(failure => (
                                <p key={failure} className="text-muted-foreground">
                                    {mistake(failure).replace(/^./, letter => letter.toUpperCase())}
                                </p>
                            ))}
                            <a
                                href={`${BENCH.path}watch/?model=${shoot.models[model]}&turn=${item.turn}`}
                                onClick={event => {
                                    event.preventDefault()
                                    onOpen('watch', `?model=${shoot.models[model]}&turn=${item.turn}`)
                                }}
                                className="text-muted-foreground hover:text-foreground hover:underline"
                            >
                                Watch this turn →
                            </a>
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <p className={TYPE.label}>How long they took</p>
                        <Waits shoot={shoot} turn={turn} model={model} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className={TYPE.label}>What they did</p>
                        <ul className="flex flex-col gap-2">
                            {found.map(group => (
                                <li key={group.action} className="flex flex-col gap-1.5 rounded-lg border border-white/8 p-3">
                                    <p className="flex items-baseline justify-between gap-3">
                                        <span className={`min-w-0 text-xs break-words ${/^(Did nothing|Ran out)/.test(group.action) ? 'text-sm text-foreground' : 'font-mono text-foreground/90'}`}>{group.action}</span>
                                        <span className={`${TYPE.number} shrink-0 text-sm font-semibold`}>{group.models.length}</span>
                                    </p>
                                    <p className="flex flex-wrap gap-1">
                                        {group.models.map((row, index) => (
                                            <button
                                                key={row}
                                                onClick={() => setModel(row)}
                                                className={`rounded-full border px-2 py-0.5 text-[11px] hover:border-white/40 ${row === model ? 'border-white text-foreground' : 'border-white/10 text-muted-foreground'}`}
                                            >
                                                <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ background: OUTCOMES[group.outcomes[index]].color }} />
                                                {shortName(summary(shoot.models[row]))}
                                            </button>
                                        ))}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
