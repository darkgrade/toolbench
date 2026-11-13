/**
 * One model's own page: its score, its whole shoot turn by turn on the viewfinder, where it stands in
 * the field, and every turn written out. Everything is in the prerendered page; picking a turn is the
 * only thing that needs the browser.
 */
import { Badge } from '@kevinschaich/components'
import { BENCH, MODELS, type ModelDetail, type ModelSummary, type TurnDetail, percent, seconds } from '@site/data'
import facts from '@site/facts.json'
import { INK, TONE, TYPE } from '@site/kit/theme'
import { type Cell, KIND_LABELS, OUTCOMES, type Turn, type TurnStart, callArguments, mistake, outcome, shortName } from '@site/shoot'
import { LOOKUPS, lookAfter } from '@site/views/watch/look'
import { Viewfinder } from '@site/views/watch/viewfinder'
import perfect from '@results/perfect.json'
import { scaleLinear, scaleLog } from 'd3-scale'
import { useState } from 'react'

const LIMIT = 10_000
const FASTEST = 300
const before = perfect as TurnStart[]
const waitShare = (milliseconds: number | null): number => Math.log(Math.min(LIMIT, Math.max(FASTEST, milliseconds ?? LIMIT)) / FASTEST) / Math.log(LIMIT / FASTEST)

/** A recorded turn as the views read one: credit, wait and calls. */
function cellOf(turn: TurnDetail): Cell {
    return {
        credit: turn.credit ?? (turn.failures.length ? 0 : 1),
        wait: turn.decisionMs === null ? null : Math.round(turn.decisionMs),
        timedOut: turn.timedOut,
        failures: turn.failures,
        calls: turn.calls.map(call => ({ name: call.name, arguments: call.arguments, invalid: !call.valid })),
    }
}

function ScoreRing({ score }: { score: number | null | undefined }) {
    const around = 2 * Math.PI * 52
    return (
        <div className="relative size-32 shrink-0 sm:size-40">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="7" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={INK.accent} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((score ?? 0) / 100) * around} ${around}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`${TYPE.number} text-4xl font-semibold sm:text-5xl`}>{score ?? '–'}</span>
                <span className="text-xs text-muted-foreground">out of 100</span>
            </div>
        </div>
    )
}

function Reading({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className={TYPE.label}>{label}</dt>
            <dd className={`${TYPE.number} text-xl font-semibold`}>{value}</dd>
            {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
        </div>
    )
}

/** The model's shoot: a cell and a wait bar per turn, and the picked turn on the viewfinder. */
function Shoot({ model, turns }: { model: ModelSummary; turns: TurnDetail[] }) {
    const firstMistake = turns.findIndex(turn => (turn.credit ?? 1) < 1)
    const [picked, setPicked] = useState(firstMistake >= 0 ? firstMistake : 13)
    const turn = turns[picked]
    const cell = cellOf(turn)
    const result = OUTCOMES[outcome(cell)]
    const look = lookAfter(before[picked], cell.calls ?? [], cell.calls?.length ?? 0, before[picked - 1])
    const acted = turn.calls.some(call => !LOOKUPS.has(call.name))
    return (
        <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={TYPE.label}>Its shoot</p>
                    <h2 className={TYPE.title}>Turn by turn</h2>
                </div>
                <a href={`${BENCH.path}watch/?model=${model.id}&turn=${turn.turn}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                    Watch it play out →
                </a>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                {facts.acts.map(act => (
                    <div key={act.label} className="flex flex-col gap-1.5">
                        <span className="text-[11px] leading-none whitespace-nowrap" style={{ color: act.recording ? INK.accent : INK.muted }}>
                            {act.label}
                        </span>
                        <div className="flex items-end gap-1">
                            {turns
                                .filter(item => item.turn >= act.from && item.turn <= act.to)
                                .map(item => {
                                    const index = item.turn - 1
                                    const itemCell = cellOf(item)
                                    return (
                                        <button
                                            key={item.turn}
                                            onClick={() => setPicked(index)}
                                            aria-label={`Turn ${item.turn}: ${item.said}`}
                                            aria-current={index === picked}
                                            className={`flex w-5 flex-col items-center gap-1 rounded-sm px-0.5 pt-1 pb-1 sm:w-6 ${index === picked ? 'bg-white/15' : 'hover:bg-white/8'}`}
                                        >
                                            <span className="flex h-12 w-full items-end">
                                                <span className="w-full rounded-t-[2px]" style={{ height: `${Math.max(6, waitShare(itemCell.timedOut ? LIMIT : itemCell.wait) * 100)}%`, background: 'oklch(1 0 0 / 0.22)' }} />
                                            </span>
                                            <span className="size-3.5 rounded-[3px] sm:size-4" style={{ background: OUTCOMES[outcome(itemCell)].color }} />
                                            <span className={`${TYPE.number} text-[10px] leading-none ${index === picked ? 'text-foreground' : 'text-muted-foreground'}`}>{item.turn}</span>
                                        </button>
                                    )
                                })}
                        </div>
                    </div>
                ))}
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Bars show how long it took to act, up to the 10 s limit. Pick a turn.</p>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
                <Viewfinder look={look} flash={false} />
                <div className="flex min-w-0 flex-col gap-3">
                    <p className={TYPE.label}>
                        Turn {turn.turn} · {KIND_LABELS[turn.kind as Turn['kind']] ?? turn.kind}
                    </p>
                    <p className="font-heading line-clamp-5 text-xl leading-snug font-semibold tracking-tight">“{turn.said}”</p>
                    <p className="text-sm text-muted-foreground">Should happen: {turn.expected}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-black" style={{ background: result.color }}>
                            {result.label}
                        </span>
                        <span className={TYPE.number}>{cell.timedOut || cell.wait === null ? 'Still deciding at 10 s' : `${acted ? 'Acted' : 'Answered'} in ${seconds(cell.wait)}`}</span>
                    </p>
                    <ul className="flex flex-col gap-1.5">
                        {(cell.calls ?? []).map((call, index) => (
                            <li key={index} className={`flex items-baseline gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs ${call.invalid ? 'line-through opacity-60' : ''}`}>
                                <span className={LOOKUPS.has(call.name) ? 'text-muted-foreground' : 'text-foreground'}>{call.name}</span>
                                <span className="min-w-0 truncate text-muted-foreground">{callArguments(call)}</span>
                            </li>
                        ))}
                        {!cell.calls?.length && <li className="text-xs text-muted-foreground">Did nothing to the camera.</li>}
                    </ul>
                    {turn.failures.map(failure => (
                        <p key={failure} className="text-sm" style={{ color: failure.startsWith('serious') ? OUTCOMES.serious.color : OUTCOMES.minor.color }}>
                            {mistake(failure).replace(/^./, letter => letter.toUpperCase())}
                        </p>
                    ))}
                    {turn.reply && <p className="text-sm leading-relaxed text-foreground/75">“{turn.reply.replace(/\*\*/g, '')}”</p>}
                </div>
            </div>
        </section>
    )
}

/** Every model by turns right and typical wait, with this one lit. */
function Standing({ model }: { model: ModelSummary }) {
    const width = 640
    const height = 300
    const x = scaleLog().domain([FASTEST, LIMIT]).range([44, width - 16])
    const lowest = Math.floor(Math.min(...MODELS.map(other => other.turnsPassed ?? 1)) * 10) / 10
    const y = scaleLinear().domain([lowest, 1]).range([height - 30, 14])
    const place = (other: ModelSummary): [number, number] => [x(Math.min(LIMIT, Math.max(FASTEST, other.decisionMedianMs ?? LIMIT))), y(other.turnsPassed ?? lowest)]
    const [ownX, ownY] = place(model)
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${model.name} among every model, by turns right and typical wait`}>
            {[1000, 3000, LIMIT].map(tick => (
                <g key={tick}>
                    <line x1={x(tick)} x2={x(tick)} y1={14} y2={height - 30} stroke={INK.grid} />
                    <text x={x(tick)} y={height - 12} textAnchor="middle" fontSize={11} fill={INK.muted}>
                        {tick / 1000} s
                    </text>
                </g>
            ))}
            {[lowest, (1 + lowest) / 2, 1].map(tick => (
                <g key={tick}>
                    <line x1={44} x2={width - 16} y1={y(tick)} y2={y(tick)} stroke={INK.grid} />
                    <text x={38} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={INK.muted}>
                        {Math.round(tick * 100)}%
                    </text>
                </g>
            ))}
            <text x={44} y={height - 12} fontSize={11} fill={INK.muted}>
                Typical wait →
            </text>
            {MODELS.filter(other => other.id !== model.id).map(other => {
                const [otherX, otherY] = place(other)
                return (
                    <a key={other.id} href={`${BENCH.path}${other.id}/`}>
                        <title>{other.name}</title>
                        <circle cx={otherX} cy={otherY} r={5} fill={TONE.good} fillOpacity={0.28} stroke={TONE.good} strokeOpacity={0.5} />
                    </a>
                )
            })}
            <circle cx={ownX} cy={ownY} r={16} fill={INK.accent} fillOpacity={0.18} />
            <circle cx={ownX} cy={ownY} r={7} fill={INK.accent} />
            <text x={ownX > width - 180 ? ownX - 14 : ownX + 14} y={ownY - 12} textAnchor={ownX > width - 180 ? 'end' : 'start'} fontSize={12} fontWeight={600} fill={INK.text}>
                {shortName(model)}
            </text>
        </svg>
    )
}

/** The median of the field's score in one area, to mark on this model's bar. */
function fieldMedian(area: string): number {
    const scores = MODELS.flatMap(other => other.reasons?.filter(reason => reason.area === area).map(reason => reason.score) ?? []).sort((first, second) => first - second)
    return scores[Math.floor(scores.length / 2)] ?? 0
}

export function ModelPage({ model, detail }: { model: ModelSummary; detail: ModelDetail | undefined }) {
    const rank = MODELS.indexOf(model) + 1
    const kinds = model.byKind
    const previous = MODELS[rank - 2]
    const next = MODELS[rank]
    const rival = next ?? previous
    return (
        <article className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-6 sm:px-8 sm:py-8">
            <header className="flex flex-col gap-6">
                <a href={BENCH.path} className="text-sm text-muted-foreground hover:underline">
                    ← All models
                </a>
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex min-w-0 flex-col gap-3">
                        <p className={TYPE.label}>
                            {model.maker} · {model.modelClass} · #{rank} of {MODELS.length}
                        </p>
                        <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{model.name}</h1>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {model.licence && <Badge variant="secondary">{model.licence}</Badge>}
                            {model.strengths?.map(strength => (
                                <Badge key={strength} variant="outline">
                                    {strength}
                                </Badge>
                            ))}
                            {model.weaknesses?.map(weakness => (
                                <Badge key={weakness} variant="outline" className="text-muted-foreground">
                                    {weakness}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                            <a href={`${BENCH.path}watch/?model=${model.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                                Watch it run the shoot →
                            </a>
                            {rival && (
                                <a href={`${BENCH.path}compare/?a=${model.id}&b=${rival.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                                    Compare with {shortName(rival)} →
                                </a>
                            )}
                        </div>
                    </div>
                    <ScoreRing score={model.score} />
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-white/8 py-5 sm:grid-cols-3 lg:grid-cols-6">
                    <Reading label="Turns right" value={percent(model.turnsPassed)} />
                    <Reading label="Serious mistakes" value={String(model.seriousMistakes ?? '–')} />
                    <Reading label="Typical wait" value={seconds(model.decisionMedianMs)} sub={`slow: ${seconds(model.decisionP90Ms)}`} />
                    <Reading label="Invalid tool calls" value={String(model.invalidToolCalls ?? '–')} sub={`of ${model.toolCalls ?? '–'}`} />
                    <Reading label="Download" value={model.sizeGigabytes ? `${model.sizeGigabytes.toFixed(1)} GB` : '–'} />
                    <Reading label="Memory used" value={model.peakMemoryGigabytes ? `${model.peakMemoryGigabytes.toFixed(1)} GB` : '–'} />
                </dl>
            </header>

            {detail && <Shoot model={model} turns={detail.turns} />}

            <section className="grid gap-10 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                    <div>
                        <p className={TYPE.label}>The field</p>
                        <h2 className={TYPE.title}>Where it stands</h2>
                    </div>
                    <Standing model={model} />
                    <p className="text-xs text-muted-foreground">Every model by turns right and typical wait. Higher and further left is better.</p>
                </div>
                {model.reasons && (
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className={TYPE.label}>The score</p>
                            <h2 className={TYPE.title}>How the score adds up</h2>
                        </div>
                        <div className="flex flex-col gap-3.5">
                            {model.reasons.map(reason => (
                                <div key={reason.area} className="grid grid-cols-[7.5rem_1fr_2.25rem] items-center gap-3 text-sm">
                                    <span className="text-muted-foreground">{reason.area}</span>
                                    <div className="flex flex-col gap-1">
                                        <div className="relative h-2 rounded-full bg-white/8">
                                            <div className="h-full rounded-full" style={{ width: `${reason.score}%`, background: INK.accent }} />
                                            <span className="absolute -top-1 h-4 w-px bg-white/60" style={{ left: `${fieldMedian(reason.area)}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {reason.why} · counts {reason.weight}%
                                        </span>
                                    </div>
                                    <span className={`${TYPE.number} text-right`}>{reason.score}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">The tick on each bar is the middle of the field.</p>
                        {kinds && (
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
                                <Reading label="Requests done right" value={`${kinds.requests.passed}/${kinds.requests.total}`} />
                                <Reading label="Questions answered without acting" value={`${kinds.questions.passed}/${kinds.questions.total}`} />
                                <Reading label="Said what it can't do" value={`${kinds.cannotDo.passed}/${kinds.cannotDo.total}`} />
                                <Reading label="Left the video alone" value={`${kinds.video.passed}/${kinds.video.total}`} />
                            </dl>
                        )}
                    </div>
                )}
            </section>

            {detail && (
                <section className="flex flex-col gap-4">
                    <div>
                        <p className={TYPE.label}>The record</p>
                        <h2 className={TYPE.title}>Every turn</h2>
                    </div>
                    <ol className="flex flex-col">
                        {detail.turns.map(turn => {
                            const result = OUTCOMES[outcome(cellOf(turn))]
                            return (
                                <li key={turn.turn} className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-1 border-t border-white/6 py-3 sm:grid-cols-[1.5rem_minmax(0,5fr)_minmax(0,6fr)_3.5rem]">
                                    <span className={`${TYPE.number} text-xs text-muted-foreground`}>{turn.turn}</span>
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <span className="text-sm">{turn.said}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {KIND_LABELS[turn.kind as Turn['kind']] ?? turn.kind} · Expected: {turn.expected}
                                        </span>
                                    </div>
                                    <div className="col-start-2 flex min-w-0 flex-col gap-1 sm:col-start-3">
                                        <span className="text-sm font-medium" style={{ color: result.color }}>
                                            {result.label}
                                            {turn.failures.length ? `: ${turn.failures.map(mistake).join(', ')}` : ''}
                                        </span>
                                        {turn.calls.map((call, index) => (
                                            <code key={index} className="font-mono text-xs break-all text-muted-foreground">
                                                {call.name}({Object.entries(call.arguments).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')}){call.valid ? '' : ' ✗ invalid'}
                                            </code>
                                        ))}
                                        {turn.reply && <span className="text-xs text-foreground/70">“{turn.reply}”</span>}
                                    </div>
                                    <span className={`${TYPE.number} col-start-2 text-xs text-muted-foreground sm:col-start-4 sm:text-right sm:text-sm`}>{seconds(turn.decisionMs)}</span>
                                </li>
                            )
                        })}
                    </ol>
                </section>
            )}

            <section className="flex flex-col gap-4">
                <div>
                    <p className={TYPE.label}>The run</p>
                    <h2 className={TYPE.title}>How it ran</h2>
                </div>
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Reading label="Score" value={`${model.score ?? '–'} / 100`} sub={model.passScores && model.passScores.length > 1 ? `median of ${model.passScores.length} runs: ${model.passScores.map(score => score ?? '–').join(' · ')}` : `#${rank} of ${MODELS.length} models`} />
                    <Reading label="Load time" value={model.loadSeconds !== undefined ? `${model.loadSeconds} s` : '–'} />
                    <Reading label="Download" value={model.sizeGigabytes ? `${model.sizeGigabytes.toFixed(2)} GB` : '–'} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <dt className={TYPE.label}>Model file</dt>
                        <dd className="text-sm">
                            <a href={model.source} className="break-all hover:underline">
                                {model.files?.map(file => file.name).join(', ') || model.source}
                            </a>
                        </dd>
                        <dd className="text-xs text-muted-foreground">{model.files?.map(file => `sha256 ${file.sha256.slice(0, 16)}…`).join(' · ')}</dd>
                    </div>
                </dl>
            </section>

            <nav className="grid grid-cols-2 gap-4 border-t border-white/8 pt-5 text-sm" aria-label="Other models">
                {previous ? (
                    <a href={`${BENCH.path}${previous.id}/`} className="group flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">← #{rank - 1}</span>
                        <span className="group-hover:underline">{previous.name}</span>
                    </a>
                ) : (
                    <span />
                )}
                {next && (
                    <a href={`${BENCH.path}${next.id}/`} className="group flex flex-col items-end gap-0.5 text-right">
                        <span className="text-xs text-muted-foreground">#{rank + 1} →</span>
                        <span className="group-hover:underline">{next.name}</span>
                    </a>
                )}
            </nav>
        </article>
    )
}
