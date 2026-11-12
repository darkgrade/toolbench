import {
    Badge,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
    Leaderboard,
    type LeaderboardColumn,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TradeoffChart,
} from '@kevinschaich/components'
import { BENCH, FILTERS, MODELS, type ModelSummary, RUN, percent, sampleSentence, seconds } from '@site/data'
import { Method } from '@site/pages/method'
import { Script } from '@site/pages/script'
import { useEffect, useState } from 'react'

const TABS = [
    { id: 'results', label: 'Results' },
    { id: 'tradeoff', label: 'Accuracy vs. speed' },
    { id: 'method', label: 'How we test' },
    { id: 'script', label: 'The script' },
]

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

function tabFromHash(): string {
    if (typeof location === 'undefined') return TABS[0].id
    const id = location.hash.replace(/^#/, '')
    return TABS.some(tab => tab.id === id) ? id : TABS[0].id
}

/** One row of filters per category, each a one-of-a-few choice. */
function Filters({ chosen, choose }: { chosen: Record<string, string>; choose: (filter: string, option: string) => void }) {
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

export function Overview() {
    const [tab, setTab] = useState(TABS[0].id)
    const [chosen, setChosen] = useState<Record<string, string>>(Object.fromEntries(FILTERS.map(filter => [filter.id, 'all'])))
    const shown = MODELS.filter(model => FILTERS.every(filter => filter.options.find(option => option.id === chosen[filter.id])!.matches(model)))
    const choose = (filter: string, option: string) => setChosen(previous => ({ ...previous, [filter]: option }))
    useEffect(() => {
        setTab(tabFromHash())
        const onHash = () => setTab(tabFromHash())
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [])
    const select = (id: string) => {
        setTab(id)
        history.replaceState(null, '', `#${id}`)
    }

    return (
        <Tabs value={tab} onValueChange={value => select(String(value))} className="flex flex-col gap-6">
            <TabsList>
                {TABS.map(item => (
                    <TabsTrigger key={item.id} value={item.id}>
                        {item.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="results" className="flex flex-col gap-3">
                {MODELS.length === 0 ? (
                    <Empty className="border">
                        <EmptyHeader>
                            <EmptyTitle>Results are on the way</EmptyTitle>
                            <EmptyDescription>The models are being tested now. Check back soon.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <Filters chosen={chosen} choose={choose} />
                        <Leaderboard rows={shown} rowKey={model => model.id} defaultSort="score" columns={COLUMNS} />
                        <p className="text-sm text-muted-foreground">
                            {sampleSentence()} Every model hears the same script, a creator filming a video with requests to their camera app in between, and is checked turn by turn. The score, out of 100, weighs doing the right thing most, then speed. Pick a model to see every turn.
                        </p>
                    </>
                )}
            </TabsContent>
            <TabsContent value="tradeoff" className="flex flex-col gap-3">
                <Filters chosen={chosen} choose={choose} />
                <TradeoffChart
                    points={shown.filter(model => model.decisionMedianMs).map(model => ({ id: model.id, label: model.name, x: model.decisionMedianMs!, y: 1 - model.turnsPassed! }))}
                    xLabel="Typical wait"
                    yLabel="Turns wrong"
                    xScale="log"
                    formatX={value => seconds(value)}
                    formatY={value => percent(value, 0)}
                    onSelect={id => location.assign(`${BENCH.path}${id}/`)}
                />
                <p className="text-sm text-muted-foreground">Closer to the bottom left is better: fewer mistakes, less waiting.</p>
            </TabsContent>
            <TabsContent value="method">
                <Method />
            </TabsContent>
            <TabsContent value="script">
                <Script />
            </TabsContent>
        </Tabs>
    )
}
