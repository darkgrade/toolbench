import { Badge, Card, CardContent, CardHeader, CardTitle, Stat, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kevinschaich/components'
import { BENCH, MODELS, type ModelSummary, modelDetail, percent, seconds } from '@site/data'

const KIND_LABELS: Record<string, string> = { request: 'Request', question: 'Question', 'cannot-do': "Can't do", video: 'The video' }

function describeCall(call: { name: string; arguments: Record<string, unknown>; valid: boolean }): string {
    const argumentsText = Object.entries(call.arguments)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ')
    return `${call.name}(${argumentsText})${call.valid ? '' : ' ✗ invalid'}`
}

/** One model's results in detail: its score breakdown and every turn of the script. */
export function ModelPage({ model }: { model: ModelSummary }) {
    const detail = modelDetail(model.id)
    const rank = MODELS.indexOf(model) + 1
    const kinds = model.byKind
    return (
        <article className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
                <a href={BENCH.path} className="text-sm text-muted-foreground hover:underline">
                    ← All models
                </a>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">{model.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{model.maker}</span>
                    {model.licence && <Badge variant="secondary">{model.licence}</Badge>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat boxed size="lg" label="Score" value={model.score ?? '–'} unit="/ 100" sub={model.passScores && model.passScores.length > 1 ? `median of ${model.passScores.length} runs: ${model.passScores.map(score => score ?? '–').join(' · ')}` : `#${rank} of ${MODELS.length} models`} />
                <Stat boxed size="lg" label="Turns right" value={percent(model.turnsPassed)} />
                <Stat boxed size="lg" label="Typical wait" value={seconds(model.decisionMedianMs)} sub={`slow: ${seconds(model.decisionP90Ms)}`} />
                <Stat boxed size="lg" label="Invalid tool calls" value={model.invalidToolCalls ?? '–'} sub={`of ${model.toolCalls ?? '–'}`} />
            </div>

            {kinds && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Requests done right" value={`${kinds.requests.passed}/${kinds.requests.total}`} />
                    <Stat label="Questions answered without acting" value={`${kinds.questions.passed}/${kinds.questions.total}`} />
                    <Stat label="Said what it can't do" value={`${kinds.cannotDo.passed}/${kinds.cannotDo.total}`} />
                    <Stat label="Left the video alone" value={`${kinds.video.passed}/${kinds.video.total}`} />
                </div>
            )}

            {model.reasons && (
                <section className="flex flex-col gap-3">
                    <h2 className="font-heading text-xl font-semibold">How the score adds up</h2>
                    <div className="flex flex-col gap-2">
                        {model.reasons.map(reason => (
                            <div key={reason.area} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                                <span className="text-muted-foreground">{reason.area}</span>
                                <div className="flex flex-col gap-1">
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-foreground" style={{ width: `${reason.score}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {reason.why} · counts {reason.weight}%
                                    </span>
                                </div>
                                <span className="text-right tabular-nums">{reason.score}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {detail && (
                <section className="flex flex-col gap-3">
                    <h2 className="font-heading text-xl font-semibold">Every turn</h2>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Said</TableHead>
                                <TableHead>What it did</TableHead>
                                <TableHead className="text-right">Wait</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detail.turns.map(turn => (
                                <TableRow key={turn.turn} className="align-top">
                                    <TableCell className="tabular-nums text-muted-foreground">{turn.turn}</TableCell>
                                    <TableCell className="max-w-sm whitespace-normal">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="w-fit">
                                                {KIND_LABELS[turn.kind] ?? turn.kind}
                                            </Badge>
                                            <span>{turn.said}</span>
                                            <span className="text-xs text-muted-foreground">Expected: {turn.expected}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-md whitespace-normal">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant={turn.passed ? 'secondary' : turn.credit === 0.5 ? 'outline' : 'destructive'} className="w-fit">
                                                {turn.passed ? 'Right' : turn.credit === 0.5 ? 'Minor slip' : 'Serious mistake'}
                                            </Badge>
                                            {turn.calls.map((call, index) => (
                                                <code key={index} className="text-xs break-all">
                                                    {describeCall(call)}
                                                </code>
                                            ))}
                                            {turn.reply && <span className="text-xs text-muted-foreground">“{turn.reply}”</span>}
                                            {turn.failures.map(failure => (
                                                <span key={failure} className={`text-xs ${failure.startsWith('serious') ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                    {failure.replace(/^(serious|minor): /, '')}
                                                </span>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{seconds(turn.decisionMs)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>How it ran</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    <Stat label="Download" value={model.sizeGigabytes ? `${model.sizeGigabytes.toFixed(2)} GB` : '–'} />
                    <Stat label="Memory used" value={model.peakMemoryGigabytes ? `${model.peakMemoryGigabytes.toFixed(1)} GB` : '–'} />
                    <Stat label="Load time" value={model.loadSeconds !== undefined ? `${model.loadSeconds} s` : '–'} />
                    <Stat
                        label="Model file"
                        value={
                            <a href={model.source} className="break-all hover:underline">
                                {model.files?.map(file => file.name).join(', ') || model.source}
                            </a>
                        }
                        sub={model.files?.map(file => `sha256 ${file.sha256.slice(0, 16)}…`).join(' · ')}
                    />
                </CardContent>
            </Card>
        </article>
    )
}
