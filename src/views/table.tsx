/** Every model as a sortable table, with the filters: the plain view of the results. */
import { Badge, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Leaderboard, type LeaderboardColumn, Tabs, TabsList, TabsTrigger } from '@kevinschaich/components'
import { BENCH, FILTERS, MODELS, type ModelSummary, percent, sampleSentence, seconds } from '@site/data'
import { useState } from 'react'

const COLUMNS: LeaderboardColumn<ModelSummary>[] = [
    {
        key: 'model',
        label: 'Model',
        render: model => (
            <a href={`${BENCH.path}${model.id}/`} className="flex flex-col hover:underline">
                <span className="font-medium text-foreground">{model.name}</span>
                <span className="text-xs text-muted-foreground">{model.maker}</span>
            </a>
        ),
    },
    { key: 'score', label: 'Score', hint: 'out of 100', better: 'higher', value: model => model.score ?? null, render: model => <span className="font-semibold">{model.score ?? '–'}</span> },
    { key: 'turns', label: 'Turns right', better: 'higher', value: model => model.turnsPassed ?? null, render: model => percent(model.turnsPassed) },
    { key: 'video', label: 'Ignored the video', hint: 'did nothing when it should', better: 'higher', value: model => (model.byKind ? model.byKind.video.passed / model.byKind.video.total : null), render: model => (model.byKind ? `${model.byKind.video.passed}/${model.byKind.video.total}` : '–') },
    { key: 'latency', label: 'Typical wait', hint: 'until it acts', value: model => model.decisionMedianMs ?? null, render: model => seconds(model.decisionMedianMs) },
    { key: 'slow', label: 'Slow wait', hint: '1 in 10 is slower', value: model => model.decisionP90Ms ?? null, render: model => seconds(model.decisionP90Ms) },
    { key: 'size', label: 'Download', value: model => model.sizeGigabytes ?? null, render: model => (model.sizeGigabytes ? `${model.sizeGigabytes.toFixed(1)} GB` : '–') },
    {
        key: 'licence',
        label: 'Licence',
        render: model => (
            <Badge variant={model.licence?.includes('NC') ? 'outline' : 'secondary'} className="whitespace-nowrap">
                {model.licence ?? '–'}
            </Badge>
        ),
    },
]

/** One row of filters per category, each a one-of-a-few choice. */
export function Filters({ chosen, choose }: { chosen: Record<string, string>; choose: (filter: string, option: string) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            {FILTERS.map(filter => (
                <Tabs key={filter.id} value={chosen[filter.id]} onValueChange={value => choose(filter.id, String(value))}>
                    <TabsList aria-label={filter.label}>
                        {filter.options.map(option => (
                            <TabsTrigger key={option.id} value={option.id}>
                                {option.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            ))}
        </div>
    )
}

/** The models a set of filter choices leaves. */
export function useFilters(): { chosen: Record<string, string>; choose: (filter: string, option: string) => void; shown: ModelSummary[] } {
    const [chosen, setChosen] = useState<Record<string, string>>(Object.fromEntries(FILTERS.map(filter => [filter.id, 'all'])))
    const shown = MODELS.filter(model => FILTERS.every(filter => filter.options.find(option => option.id === chosen[filter.id])!.matches(model)))
    const choose = (filter: string, option: string) => setChosen(previous => ({ ...previous, [filter]: option }))
    return { chosen, choose, shown }
}

export function TableView() {
    const { chosen, choose, shown } = useFilters()
    if (MODELS.length === 0)
        return (
            <Empty className="border">
                <EmptyHeader>
                    <EmptyTitle>Results are on the way</EmptyTitle>
                    <EmptyDescription>The models are being tested now. Check back soon.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    return (
        <div className="flex flex-col gap-3">
            <Filters chosen={chosen} choose={choose} />
            <Leaderboard rows={shown} rowKey={model => model.id} defaultSort="score" columns={COLUMNS} />
            <p className="text-sm text-muted-foreground">
                {sampleSentence()} Every model hears the same script, a creator filming a video with requests to their camera app in between, and is checked turn by turn. The score, out of 100, weighs doing the right thing most, then speed. Pick a model to see every turn.
            </p>
        </div>
    )
}
