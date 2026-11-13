/**
 * Watch: the shoot replayed. The creator's line appears, each chosen model waits exactly as long as
 * it really took to act, then its tool calls land on a drawn viewfinder and the turn is marked.
 * Up to three models run side by side; the script along the bottom jumps to any turn.
 */
import { Button, NativeSelect, NativeSelectOption } from '@kevinschaich/components'
import type { ViewProps } from '@site/app'
import { BENCH, MODELS, seconds } from '@site/data'
import { loadDetail } from '@site/details'
import { Loading } from '@site/kit/shell'
import { INK, TONE, TYPE } from '@site/kit/theme'
import { type Cell, KIND_LABELS, OUTCOMES, type Shoot, callArguments, mistake, outcome, shortName, summary, useShoot } from '@site/shoot'
import { LOOKUPS, lookAfter } from '@site/views/watch/look'
import { Viewfinder } from '@site/views/watch/viewfinder'
import { Eye, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/** The longest a model may take to decide, in milliseconds. */
const LIMIT = 10_000
const CALL_GAP = 280
const VERDICT_DELAY = 350
const HOLD = 1700
const captionTime = (said: string): number => Math.min(2400, Math.max(500, said.split(/\s+/).length * 90))

/** A model's replies, loaded when it is first watched. */
function useReplies(id: string): string[] | undefined {
    const [replies, setReplies] = useState<Record<string, string[]>>({})
    useEffect(() => {
        if (replies[id]) return
        let current = true
        loadDetail(id).then(detail => current && detail && setReplies(previous => ({ ...previous, [id]: detail.turns.map(turn => turn.reply) })))
        return () => {
            current = false
        }
    }, [id, replies])
    return replies[id]
}

/** Where a lane is in its turn, `since` milliseconds after the creator finished speaking. */
function moment(cell: Cell, since: number): { phase: 'listening' | 'thinking' | 'acting' | 'done'; shown: number; waited: number } {
    const decision = cell.timedOut || cell.wait === null ? LIMIT : cell.wait
    const calls = cell.calls?.length ?? 0
    if (since < 0) return { phase: 'listening', shown: 0, waited: 0 }
    if (since < decision) return { phase: 'thinking', shown: 0, waited: since }
    const after = since - decision
    const shown = Math.min(calls, Math.floor(after / CALL_GAP) + 1)
    return { phase: after >= calls * CALL_GAP + VERDICT_DELAY ? 'done' : 'acting', shown, waited: decision }
}

const turnTime = (said: string, cells: Cell[]): number =>
    captionTime(said) + Math.max(...cells.map(cell => (cell.timedOut || cell.wait === null ? LIMIT : cell.wait) + (cell.calls?.length ?? 0) * CALL_GAP + VERDICT_DELAY)) + HOLD

function Lane({ shoot, id, turn, since, onModel }: { shoot: Shoot; id: string; turn: number; since: number; onModel: (id: string) => void }) {
    const model = summary(id)
    const cell = shoot.runs[shoot.models.indexOf(id)][turn]
    const replies = useReplies(id)
    const { phase, shown, waited } = moment(cell, since)
    const calls = cell.calls ?? []
    const look = lookAfter(shoot.before[turn], calls, shown, shoot.before[turn - 1])
    const latest = calls[shown - 1]
    const decision = cell.timedOut || cell.wait === null ? LIMIT : cell.wait
    const flash = latest?.name === 'take_photo' && !latest.invalid && since - decision - (shown - 1) * CALL_GAP < 380
    const result = OUTCOMES[outcome(cell)]
    const acted = calls.some(call => !LOOKUPS.has(call.name))
    const speed = decision <= 1000 ? TONE.good : decision <= 3000 ? TONE.fair : TONE.bad
    return (
        <article className="flex min-w-0 flex-col gap-3">
            <header className="flex items-center justify-between gap-3">
                <NativeSelect size="sm" value={id} onChange={event => onModel(event.target.value)} aria-label="Model" className="max-w-full min-w-0">
                    {shoot.models.map((option, index) => (
                        <NativeSelectOption key={option} value={option}>
                            {index + 1}. {summary(option).name}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
                <a href={`${BENCH.path}${id}/`} className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline">
                    Score <span className={`${TYPE.number} text-sm font-semibold text-foreground`}>{model.score}</span>
                </a>
            </header>
            <Viewfinder look={look} flash={flash} />
            <div className="flex min-h-5 items-center gap-2 text-sm">
                {phase === 'listening' && <span className="text-muted-foreground">Listening…</span>}
                {phase === 'thinking' && (
                    <>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full rounded-full" style={{ width: `${(waited / LIMIT) * 100}%`, background: waited <= 1000 ? TONE.good : waited <= 3000 ? TONE.fair : TONE.bad }} />
                        </span>
                        <span className={`${TYPE.number} w-12 text-right text-xs text-muted-foreground`}>{(waited / 1000).toFixed(1)} s</span>
                    </>
                )}
                {(phase === 'acting' || phase === 'done') && (
                    <>
                        <span className={`${TYPE.number} font-medium`} style={{ color: cell.timedOut ? OUTCOMES.timedOut.color : speed }}>
                            {cell.timedOut || cell.wait === null ? 'Still deciding at 10 s' : `${acted ? 'Acted' : 'Answered'} in ${seconds(cell.wait)}`}
                        </span>
                        {phase === 'done' && (
                            <span className="ks-fade ml-auto rounded-full px-2 py-0.5 text-xs font-medium text-black" style={{ background: result.color }}>
                                {result.label}
                            </span>
                        )}
                    </>
                )}
            </div>
            <ul className="flex flex-col gap-1.5">
                {calls.slice(0, shown).map((call, index) => (
                    <li key={index} className={`ks-fade flex items-baseline gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs ${call.invalid ? 'line-through opacity-60' : ''}`}>
                        {LOOKUPS.has(call.name) && <Eye className="size-3 shrink-0 translate-y-0.5 text-muted-foreground" aria-label="Looked" />}
                        <span className={LOOKUPS.has(call.name) ? 'text-muted-foreground' : 'text-foreground'}>{call.name}</span>
                        <span className="min-w-0 truncate text-muted-foreground">{callArguments(call)}</span>
                    </li>
                ))}
                {phase === 'done' && calls.length === 0 && <li className="ks-fade text-xs text-muted-foreground">Did nothing to the camera.</li>}
            </ul>
            {phase === 'done' && (
                <div className="ks-fade flex flex-col gap-1.5 text-sm">
                    {cell.failures?.map(failure => (
                        <p key={failure} style={{ color: failure.startsWith('serious') ? OUTCOMES.serious.color : OUTCOMES.minor.color }}>
                            {mistake(failure).replace(/^./, letter => letter.toUpperCase())}
                        </p>
                    ))}
                    {replies?.[turn] && <p className="leading-relaxed text-foreground/75">“{replies[turn].replace(/\*\*/g, '')}”</p>}
                </div>
            )}
        </article>
    )
}

/** The script as a strip of turns, grouped by stretch, with each lane's result under every turn. */
function Strip({ shoot, lanes, turn, onTurn }: { shoot: Shoot; lanes: string[]; turn: number; onTurn: (turn: number) => void }) {
    const rows = lanes.map(id => shoot.runs[shoot.models.indexOf(id)])
    const current = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        current.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }, [turn])
    return (
        <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-3 [scrollbar-width:none] sm:justify-center sm:px-8">
            {shoot.acts.map((act, actIndex) => (
                <div key={act.label} className="flex flex-col gap-1.5">
                    <span className="text-[11px] leading-none whitespace-nowrap" style={{ color: act.recording ? INK.accent : INK.muted }}>
                        {act.label}
                    </span>
                    <div className="flex gap-1">
                        {shoot.turns
                            .filter(item => item.act === actIndex)
                            .map(item => {
                                const index = item.turn - 1
                                return (
                                    <button
                                        key={item.turn}
                                        ref={index === turn ? current : undefined}
                                        onClick={() => onTurn(index)}
                                        aria-label={`Turn ${item.turn}: ${item.said}`}
                                        aria-current={index === turn}
                                        className={`flex w-5 flex-col items-center gap-0.5 rounded-sm pt-0.5 pb-1 transition-colors ${index === turn ? 'bg-white/15' : 'hover:bg-white/8'}`}
                                    >
                                        <span className={`${TYPE.number} text-[10px] leading-none ${index === turn ? 'text-foreground' : 'text-muted-foreground'}`}>{item.turn}</span>
                                        {rows.map((row, lane) => (
                                            <span key={lane} className="size-2.5 rounded-[2px]" style={{ background: OUTCOMES[outcome(row[index])].color, opacity: index <= turn ? 1 : 0.35 }} />
                                        ))}
                                    </button>
                                )
                            })}
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Three models worth watching together: the best, the best small download, and one from the middle of the field. */
function startingLanes(): string[] {
    const best = MODELS[0]
    const small = MODELS.find(model => model !== best && (model.sizeGigabytes ?? Infinity) < 4) ?? MODELS[1]
    const middle = MODELS.find((model, index) => index >= Math.floor(MODELS.length / 2) && model !== small) ?? MODELS[2]
    return [best.id, small.id, middle.id]
}

export default function WatchView(_: ViewProps) {
    const loaded = useShoot()
    const frame = useRef<HTMLDivElement>(null)
    const [lanes, setLanes] = useState(startingLanes)
    const [shownLanes, setShownLanes] = useState(1)
    const [turn, setTurn] = useState(0)
    const [playing, setPlaying] = useState(false)
    /** Milliseconds into the current turn; Infinity shows the turn finished. */
    const [elapsed, setElapsed] = useState(Infinity)
    const shoot = loaded instanceof Error ? undefined : loaded

    useEffect(() => {
        const query = new URLSearchParams(location.search)
        const model = query.get('model')
        const asked = Number(query.get('turn'))
        if (model && MODELS.some(candidate => candidate.id === model)) setLanes(previous => [model, ...previous.filter(id => id !== model)].slice(0, 3))
        if (asked >= 1) setTurn(asked - 1)
    }, [])

    useEffect(() => {
        const element = frame.current
        if (!element) return
        const measure = (): void => setShownLanes(element.clientWidth < 640 ? 1 : element.clientWidth < 1080 ? 2 : 3)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [shoot])

    const visible = useMemo(() => lanes.slice(0, shownLanes), [lanes, shownLanes])
    const cells = shoot ? visible.map(id => shoot.runs[shoot.models.indexOf(id)][Math.min(turn, shoot.turns.length - 1)]) : []
    const said = shoot?.turns[Math.min(turn, (shoot?.turns.length ?? 1) - 1)]
    const total = said ? turnTime(said.said, cells) : 0

    useEffect(() => {
        if (!playing || !shoot) return
        let last = performance.now()
        let request = requestAnimationFrame(function step(now) {
            setElapsed(previous => (Number.isFinite(previous) ? previous : 0) + Math.min(1000, now - last))
            last = now
            request = requestAnimationFrame(step)
        })
        return () => cancelAnimationFrame(request)
    }, [playing, shoot])

    // When a turn has played out, the next one starts; the last one stops the replay.
    useEffect(() => {
        if (!playing || !shoot || elapsed < total) return
        if (turn >= shoot.turns.length - 1) {
            setPlaying(false)
            setElapsed(Infinity)
            return
        }
        setTurn(turn + 1)
        setElapsed(0)
    }, [elapsed, total, playing, shoot, turn])

    function jump(to: number): void {
        if (!shoot) return
        setTurn(Math.max(0, Math.min(shoot.turns.length - 1, to)))
        setElapsed(playing ? 0 : Infinity)
    }

    function toggle(): void {
        if (!shoot) return
        if (playing) {
            setPlaying(false)
            setElapsed(Infinity)
            return
        }
        // Playing from a finished turn replays it; from the last turn, the whole shoot.
        if (turn >= shoot.turns.length - 1) setTurn(0)
        setElapsed(0)
        setPlaying(true)
    }

    useEffect(() => {
        const onKey = (event: KeyboardEvent): void => {
            if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return
            if (event.key === ' ') {
                event.preventDefault()
                toggle()
            }
            if (event.key === 'ArrowRight') jump(turn + 1)
            if (event.key === 'ArrowLeft') jump(turn - 1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    if (loaded instanceof Error) return <p className="p-8 text-sm text-muted-foreground">The shoot couldn't be loaded. Try again in a moment.</p>
    if (!shoot || !said) return <Loading />

    const caption = captionTime(said.said)
    const spoken = Number.isFinite(elapsed) ? said.said.slice(0, Math.ceil((Math.min(elapsed, caption) / caption) * said.said.length)) : said.said
    const act = shoot.acts[said.act]
    return (
        <div ref={frame} className="flex h-full flex-col" style={{ background: INK.background }}>
            <div className="flex flex-col gap-2 px-4 pt-2 pb-4 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className={TYPE.label}>
                        Turn {said.turn} of {shoot.turns.length} · <span style={{ color: act.recording ? INK.accent : undefined }}>{act.label}</span> · {KIND_LABELS[said.kind]}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => jump(turn - 1)} disabled={turn === 0} aria-label="Previous turn">
                            <SkipBack />
                        </Button>
                        <Button variant="secondary" size="sm" onClick={toggle}>
                            {playing ? <Pause /> : <Play />}
                            {playing ? 'Pause' : 'Play the shoot'}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => jump(turn + 1)} disabled={turn === shoot.turns.length - 1} aria-label="Next turn">
                            <SkipForward />
                        </Button>
                    </div>
                </div>
                <p className="font-heading min-h-[2lh] text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
                    “{spoken}
                    {spoken.length === said.said.length ? '”' : ''}
                </p>
                <p className="text-sm text-muted-foreground">Should happen: {said.expected}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-8">
                <div className="mx-auto grid max-w-7xl gap-6" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
                    {visible.map((id, lane) => (
                        <Lane
                            key={lane}
                            shoot={shoot}
                            id={id}
                            turn={turn}
                            since={elapsed - caption}
                            onModel={chosen => setLanes(previous => previous.map((existing, index) => (index === lane ? chosen : existing)))}
                        />
                    ))}
                </div>
            </div>
            <div className="border-t border-white/8">
                <Strip shoot={shoot} lanes={visible} turn={turn} onTurn={jump} />
            </div>
        </div>
    )
}
