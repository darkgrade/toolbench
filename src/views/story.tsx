/**
 * The story of the shoot: every model's every turn as a point of light, rearranged as you scroll from
 * the whole field, through the script's stretches, to the models worth running. Ends with the ranking.
 */
import { BENCH, MODELS, percent, seconds } from '@site/data'
import facts from '@site/facts.json'
import { type Scene, type Space, Story, type Step } from '@site/kit/story'
import { TYPE } from '@site/kit/theme'
import { KIND_LABELS, OUTCOMES, type Shoot, callArguments, mistake, outcome, shortName, summary, useShoot } from '@site/shoot'
import { type Layouts, PALETTE, makeLayouts } from '@site/views/story/layouts'
import { type ReactNode, useMemo } from 'react'

const TURNS = facts.tally.length
/** How many models got turn `turn` (1-based) right. */
const right = (turn: number): number => facts.tally[turn - 1].right
const wrong = (turn: number): number => MODELS.length - right(turn)

function Key() {
    return (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {Object.values(OUTCOMES).map(item => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.label}
                </span>
            ))}
        </p>
    )
}

function steps(layouts: Layouts | undefined, shoot: Shoot | undefined): Step[] {
    const picture = (draw: (made: Layouts) => (space: Space) => Scene) => (space: Space) => draw(layouts!)(space)
    const kind = (turn: number): string => shoot?.turns[turn].kind ?? ''
    const best = MODELS[0]
    const fastest = [...MODELS].filter(model => (model.turnsPassed ?? 0) >= 0.9).sort((first, second) => (first.decisionMedianMs ?? Infinity) - (second.decisionMedianMs ?? Infinity))[0]
    const smallest = [...MODELS].filter(model => (model.score ?? 0) >= (best.score ?? 0) - 10).sort((first, second) => (first.sizeGigabytes ?? Infinity) - (second.sizeGigabytes ?? Infinity))[0]
    return [
        {
            id: 'field',
            kicker: 'Toolbench',
            title: 'Can a model on your laptop run your shoot?',
            body: (
                <>
                    <p>
                        A creator films a short video and talks to their camera app while they work. We gave the same shoot to {MODELS.length} local models, each driving Darkgrade Studio's real
                        tools.
                    </p>
                    <p>Every point of light is one thing the creator said, heard by one model. Each cluster is a model, the best in the middle. Scroll to follow the shoot.</p>
                </>
            ),
            extra: <Key />,
            scene: picture(made => made.galaxy),
        },
        {
            id: 'script',
            kicker: 'The script',
            title: `${TURNS} turns, the same for every model`,
            body: (
                <p>
                    Each row is a model, best at the top. Each column is a turn of the script, in order: setting up, two takes with a break between them, then wrapping up. A model is marked on
                    where the camera ends up, not on which tools it used.
                </p>
            ),
            scene: picture(made => space => made.grid(space)),
        },
        {
            id: 'setup',
            kicker: 'Setting up',
            title: 'Small requests, small slips',
            watermark: 'Setup',
            body: (
                <>
                    <p>
                        Before the first take the creator nudges things: a bit brighter, a bit warmer, show the waveform. Nothing here can ruin a take, so mistakes are small ones, and there are
                        plenty.
                    </p>
                    <p>
                        The hardest is “Undo that.” Only {right(9)} of {MODELS.length} models put the colour back and left everything else alone.
                    </p>
                </>
            ),
            scene: picture(made => space => made.grid(space, turn => shoot!.turns[turn].act === 0)),
        },
        {
            id: 'video',
            kicker: 'During a take',
            title: 'While the camera rolls, the right move is nothing',
            watermark: 'Rolling',
            body: (
                <>
                    <p>
                        The creator is now talking to their audience, not their camera. A model that hears “a shorter guest list” and changes the exposure, or stops the recording, has ruined
                        the take.
                    </p>
                    <p>
                        {facts.brokeATake} of {MODELS.length} models did something to the camera during at least one line of the video.
                    </p>
                </>
            ),
            scene: picture(made => space => made.grid(space, turn => kind(turn) === 'video')),
        },
        {
            id: 'cut',
            kicker: 'Start and stop',
            title: '“Cut.” is where most models lose the take',
            watermark: 'Cut',
            body: (
                <>
                    <p>
                        “Start recording” is easy: {right(14)} models press record. But the creator ends each take by saying “Cut.”, and {wrong(19)} of {MODELS.length} models leave the camera
                        rolling.
                    </p>
                    <p>“Roll camera” for the second take is worse: only {right(23)} models start recording.</p>
                </>
            ),
            scene: picture(made => space => made.grid(space, turn => [14, 19, 23, 28].includes(turn + 1))),
        },
        {
            id: 'honest',
            kicker: 'Questions and limits',
            title: 'Knowing when not to act',
            watermark: 'Honest',
            body: (
                <>
                    <p>
                        Four turns are questions, like “Is my exposure okay?” The right answer is an answer. {facts.actedOnAQuestion} models changed a setting instead.
                    </p>
                    <p>
                        One turn asks for something no tool can do: “Delete the last clip.” {facts.claimedTheImpossible} models said they had deleted it.
                    </p>
                </>
            ),
            scene: picture(made => space => made.grid(space, turn => kind(turn) === 'question' || kind(turn) === 'cannot-do')),
        },
        {
            id: 'waits',
            kicker: 'The wait',
            title: 'Right is not enough if you are left waiting',
            body: (
                <>
                    <p>
                        The same turns, now placed by how long each model took to act. A voice app has to feel instant: past a second or two you start to wonder whether it heard you. At ten
                        seconds we stop waiting and count the turn as wrong.
                    </p>
                    {fastest && (
                        <p>
                            {shortName(fastest)} typically acts in {seconds(fastest.decisionMedianMs)} and still gets {percent(fastest.turnsPassed)} of turns right.
                        </p>
                    )}
                </>
            ),
            scene: picture(made => made.waits),
        },
        {
            id: 'size',
            kicker: 'Size',
            title: 'A bigger download is no guarantee',
            body: (
                <>
                    <p>Each column is a model, from the smallest download to the largest, with its turns stacked: right at the bottom, mistakes on top.</p>
                    {smallest && (
                        <p>
                            {shortName(smallest)} is a {smallest.sizeGigabytes?.toFixed(1)} GB download and scores {smallest.score}, within ten points of the best.
                        </p>
                    )}
                </>
            ),
            scene: picture(made => made.bySize),
        },
        {
            id: 'frontier',
            kicker: 'The field',
            title: 'The ones worth running',
            body: (
                <>
                    <p>Each model's turns gather into one light: higher is more turns right, further left is less waiting. The top left corner is where you want to be.</p>
                    <p>
                        {shortName(best)} leads with a score of {best.score}: {percent(best.turnsPassed)} of turns right and a typical wait of {seconds(best.decisionMedianMs)}.
                    </p>
                </>
            ),
            scene: picture(made => made.field),
        },
    ]
}

export function StoryView({ onOpen }: { onOpen: (tab: string, query?: string) => void }) {
    const loaded = useShoot()
    const shoot = loaded instanceof Error ? undefined : loaded
    const layouts = useMemo(() => (shoot ? makeLayouts(shoot) : undefined), [shoot])
    const story = useMemo(() => steps(layouts, shoot), [layouts, shoot])

    function tip(index: number): ReactNode {
        if (!shoot) return null
        const turn = shoot.turns[index % shoot.turns.length]
        const model = Math.floor(index / shoot.turns.length)
        const cell = shoot.runs[model][turn.turn - 1]
        const result = OUTCOMES[outcome(cell)]
        return (
            <>
                <p className="font-heading text-sm leading-snug font-semibold">{shortName(summary(shoot.models[model]))}</p>
                <p className="text-xs text-muted-foreground">
                    Turn {turn.turn} · {KIND_LABELS[turn.kind]} · {cell.wait === null ? 'no answer' : seconds(cell.wait)}
                </p>
                <p className="line-clamp-3 text-xs leading-relaxed text-foreground/80">“{turn.said}”</p>
                <p className="text-xs font-medium" style={{ color: result.color }}>
                    {result.label}
                    {cell.failures?.length ? `: ${cell.failures.map(mistake).join(', ')}` : ''}
                </p>
                {cell.calls?.slice(0, 3).map((call, position) => (
                    <p key={position} className="truncate font-mono text-[11px] text-muted-foreground">
                        {call.name} {callArguments(call)}
                    </p>
                ))}
            </>
        )
    }

    function open(index: number): void {
        if (!shoot) return
        onOpen('watch', `?model=${shoot.models[Math.floor(index / shoot.turns.length)]}&turn=${(index % shoot.turns.length) + 1}`)
    }

    return (
        <Story count={layouts?.count ?? 0} palette={PALETTE} steps={story} tip={tip} onSelect={open}>
            <Ranking onOpen={onOpen} />
        </Story>
    )
}

/** Every model, best first, as plain links: the end of the story and the way in to each model's own page. */
function Ranking({ onOpen }: { onOpen: (tab: string) => void }) {
    return (
        <section className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-4 pb-16 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={TYPE.label}>The ranking</p>
                    <h2 className={TYPE.title}>Every model, best first</h2>
                </div>
                <div className="flex gap-4 text-sm">
                    <a
                        href={`${BENCH.path}watch/`}
                        onClick={event => {
                            event.preventDefault()
                            onOpen('watch')
                        }}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                        Watch a model run the shoot →
                    </a>
                </div>
            </div>
            <ol className="gap-x-10 sm:columns-2">
                {MODELS.map((model, index) => (
                    <li key={model.id} className="break-inside-avoid border-b border-white/5">
                        <a href={`${BENCH.path}${model.id}/`} className="group grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 py-2.5">
                            <span className={`${TYPE.number} text-xs text-muted-foreground`}>{index + 1}</span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium group-hover:underline">{model.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {model.maker} · {percent(model.turnsPassed)} of turns right · {seconds(model.decisionMedianMs)} typical wait
                                </span>
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-white/10 sm:block">
                                    <span className="block h-full rounded-full bg-foreground" style={{ width: `${model.score ?? 0}%` }} />
                                </span>
                                <span className={`${TYPE.number} w-7 text-right text-sm font-semibold`}>{model.score ?? '–'}</span>
                            </span>
                        </a>
                    </li>
                ))}
            </ol>
        </section>
    )
}
