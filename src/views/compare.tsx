/**
 * Compare: two models side by side. Their scores area by area, how long each kept you waiting on
 * every turn, and the turns they handled differently, with what each one did.
 */
import { NativeSelect, NativeSelectOption } from '@kevinschaich/components'
import type { ViewProps } from '@site/app'
import { BENCH, MODELS, type ModelSummary, percent, seconds } from '@site/data'
import { Loading } from '@site/kit/shell'
import { INK, TONE, TYPE } from '@site/kit/theme'
import { type Cell, OUTCOMES, type Shoot, callArguments, mistake, outcome, summary, useShoot } from '@site/shoot'
import { useEffect, useState } from 'react'

const SIDES = [TONE.good, INK.accent]
const LIMIT = 10_000
const FASTEST = 300
const across = (milliseconds: number | null): number => (Math.log(Math.min(LIMIT, Math.max(FASTEST, milliseconds ?? LIMIT)) / FASTEST) / Math.log(LIMIT / FASTEST)) * 100

function Picker({ side, id, onChange }: { side: number; id: string; onChange: (id: string) => void }) {
    const model = summary(id)
    return (
        <div className="flex min-w-0 flex-col gap-2 border-t-2 pt-3" style={{ borderColor: SIDES[side] }}>
            <NativeSelect value={id} onChange={event => onChange(event.target.value)} aria-label={side === 0 ? 'First model' : 'Second model'} className="max-w-full min-w-0">
                {MODELS.map((option, index) => (
                    <NativeSelectOption key={option.id} value={option.id}>
                        {index + 1}. {option.name}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
            <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {model.maker} · {model.sizeGigabytes?.toFixed(1)} GB · {model.licence}
                </p>
                <a href={`${BENCH.path}${id}/`} className="group shrink-0 text-right">
                    <span className={`${TYPE.number} block text-4xl leading-none font-semibold`} style={{ color: SIDES[side] }}>
                        {model.score}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:underline">its page →</span>
                </a>
            </div>
        </div>
    )
}

function Areas({ models }: { models: ModelSummary[] }) {
    const areas = models[0].reasons ?? []
    return (
        <section className="flex flex-col gap-3">
            <p className={TYPE.label}>How the score adds up</p>
            {areas.map((area, index) => (
                <div key={area.area} className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr]">
                    <span className="text-sm">
                        {area.area}
                        <span className="block text-xs text-muted-foreground">counts {area.weight}%</span>
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {models.map((model, side) => {
                            const reason = model.reasons?.[index]
                            return (
                                <div key={side} className="grid grid-cols-[1fr_auto] items-center gap-3">
                                    <span className="h-1.5 overflow-hidden rounded-full bg-white/8">
                                        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${reason?.score ?? 0}%`, background: SIDES[side] }} />
                                    </span>
                                    <span className="w-44 truncate text-xs text-muted-foreground sm:w-56">{reason?.why}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </section>
    )
}

function Waits({ runs }: { runs: Cell[][] }) {
    return (
        <section className="flex flex-col gap-2">
            <p className={TYPE.label}>The wait on every turn</p>
            {runs.map((run, side) => (
                <div key={side} className="relative h-6">
                    {[1000, 3000].map(tick => (
                        <span key={tick} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${across(tick)}%` }} />
                    ))}
                    {run.map((cell, turn) => (
                        <span key={turn} className="absolute top-1/2 size-2 -translate-1/2 rounded-full" style={{ left: `${across(cell.timedOut ? LIMIT : cell.wait)}%`, background: SIDES[side], opacity: 0.7 }} />
                    ))}
                </div>
            ))}
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
        </section>
    )
}

function Did({ cell, side }: { cell: Cell; side: number }) {
    const result = OUTCOMES[outcome(cell)]
    return (
        <div className="flex min-w-0 flex-col gap-1 border-l-2 pl-3" style={{ borderColor: SIDES[side] }}>
            <p className="text-sm font-medium" style={{ color: result.color }}>
                {result.label} · {cell.wait === null ? 'no answer' : seconds(cell.wait)}
            </p>
            {cell.calls?.map((call, index) => (
                <p key={index} className={`truncate font-mono text-xs text-muted-foreground ${call.invalid ? 'line-through' : ''}`}>
                    {call.name} {callArguments(call)}
                </p>
            ))}
            {!cell.calls?.length && <p className="text-xs text-muted-foreground">Did nothing to the camera.</p>}
            {cell.failures?.map(failure => (
                <p key={failure} className="text-xs text-foreground/80">
                    {mistake(failure).replace(/^./, letter => letter.toUpperCase())}
                </p>
            ))}
        </div>
    )
}

function Turns({ shoot, runs, ids, onOpen }: { shoot: Shoot; runs: Cell[][]; ids: string[]; onOpen: ViewProps['onOpen'] }) {
    const differing = shoot.turns.filter((_, turn) => outcome(runs[0][turn]) !== outcome(runs[1][turn]))
    const [picked, setPicked] = useState<number | null>(null)
    const turn = picked !== null && differing.some(item => item.turn - 1 === picked) ? picked : (differing[0]?.turn ?? 1) - 1
    return (
        <section className="flex flex-col gap-3">
            <p className={TYPE.label}>Turn by turn</p>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                {shoot.acts.map((act, actIndex) => (
                    <div key={act.label} className="flex flex-col gap-1">
                        <span className="text-[11px] leading-none whitespace-nowrap" style={{ color: act.recording ? INK.accent : INK.muted }}>
                            {act.label}
                        </span>
                        <div className="flex gap-1">
                            {shoot.turns
                                .filter(item => item.act === actIndex)
                                .map(item => {
                                    const index = item.turn - 1
                                    const differs = outcome(runs[0][index]) !== outcome(runs[1][index])
                                    return (
                                        <button
                                            key={item.turn}
                                            onClick={() => setPicked(index)}
                                            aria-label={`Turn ${item.turn}: ${item.said}`}
                                            className={`flex w-5 flex-col items-center gap-0.5 rounded-sm py-1 ${index === turn ? 'bg-white/15' : 'hover:bg-white/8'}`}
                                        >
                                            {runs.map((run, side) => (
                                                <span key={side} className="size-3 rounded-[3px]" style={{ background: OUTCOMES[outcome(run[index])].color, opacity: differs ? 1 : 0.35 }} />
                                            ))}
                                        </button>
                                    )
                                })}
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                {differing.length ? `They part ways on ${differing.length} of ${shoot.turns.length} turns. Pick one to see what each did.` : 'They end up in the same place on every turn.'}
            </p>
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-heading font-semibold">
                        Turn {turn + 1}: “{shoot.turns[turn].said.length > 90 ? `${shoot.turns[turn].said.slice(0, 90)}…` : shoot.turns[turn].said}”
                    </span>
                    <a
                        href={`${BENCH.path}watch/?model=${ids[0]}&turn=${turn + 1}`}
                        onClick={event => {
                            event.preventDefault()
                            onOpen('watch', `?model=${ids[0]}&turn=${turn + 1}`)
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                        Watch it →
                    </a>
                </p>
                <p className="text-sm text-muted-foreground">Should happen: {shoot.turns[turn].expected}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                    {runs.map((run, side) => (
                        <Did key={side} cell={run[turn]} side={side} />
                    ))}
                </div>
            </div>
        </section>
    )
}

function Facts({ models }: { models: ModelSummary[] }) {
    const rows: [string, (model: ModelSummary) => string][] = [
        ['Turns right', model => percent(model.turnsPassed)],
        ['Serious mistakes', model => String(model.seriousMistakes ?? '–')],
        ['Typical wait', model => seconds(model.decisionMedianMs)],
        ['Slow wait', model => seconds(model.decisionP90Ms)],
        ['Requests done right', model => (model.byKind ? `${model.byKind.requests.passed} of ${model.byKind.requests.total}` : '–')],
        ['Left the video alone', model => (model.byKind ? `${model.byKind.video.passed} of ${model.byKind.video.total}` : '–')],
        ['Memory used', model => (model.peakMemoryGigabytes ? `${model.peakMemoryGigabytes.toFixed(1)} GB` : '–')],
        ['Load time', model => (model.loadSeconds !== undefined ? `${model.loadSeconds} s` : '–')],
    ]
    return (
        <section className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-1.5 text-sm">
            {rows.map(([label, read]) => (
                <div key={label} className="col-span-3 grid grid-cols-subgrid border-b border-white/5 pb-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    {models.map((model, side) => (
                        <span key={side} className={`${TYPE.number} text-right`} style={{ color: SIDES[side] }}>
                            {read(model)}
                        </span>
                    ))}
                </div>
            ))}
        </section>
    )
}

export default function CompareView({ onOpen }: ViewProps) {
    const loaded = useShoot()
    const [ids, setIds] = useState([MODELS[0].id, MODELS[1].id])
    const shoot = loaded instanceof Error ? undefined : loaded
    useEffect(() => {
        const query = new URLSearchParams(location.search)
        const asked = [query.get('a'), query.get('b')]
        setIds(previous => previous.map((id, side) => (MODELS.some(model => model.id === asked[side]) ? asked[side]! : id)))
    }, [])
    function choose(side: number, id: string): void {
        const next = ids.map((existing, index) => (index === side ? id : existing))
        setIds(next)
        history.replaceState(null, '', `?a=${next[0]}&b=${next[1]}`)
    }
    if (loaded instanceof Error) return <p className="p-8 text-sm text-muted-foreground">The shoot couldn't be loaded. Try again in a moment.</p>
    if (!shoot) return <Loading />
    const models = ids.map(summary)
    const runs = ids.map(id => shoot.runs[shoot.models.indexOf(id)])
    return (
        <div className="h-full overflow-y-auto" style={{ background: INK.background }}>
            <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-4 sm:px-8">
                <div className="grid gap-6 sm:grid-cols-2">
                    {ids.map((id, side) => (
                        <Picker key={side} side={side} id={id} onChange={chosen => choose(side, chosen)} />
                    ))}
                </div>
                <Areas models={models} />
                <Turns shoot={shoot} runs={runs} ids={ids} onOpen={onOpen} />
                <Waits runs={runs} />
                <Facts models={models} />
            </div>
        </div>
    )
}
