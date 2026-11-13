import { BENCH, TABS } from '@site/data'
import { Loading, Page, Shell, tabFromPath, useTab } from '@site/kit/shell'
import { MethodView } from '@site/views/method'
import { StoryView } from '@site/views/story'
import { TableView } from '@site/views/table'
import { type ComponentType, lazy, Suspense } from 'react'

/** A view's props: how it opens another view, optionally at a query (a model, a turn). */
export interface ViewProps {
    onOpen: (tab: string, query?: string) => void
}

/** The views that load on first use, so the story never waits on their code. */
const LOADERS = {
    watch: () => import('@site/views/watch'),
    turns: () => import('@site/views/turns'),
    field: () => import('@site/views/field'),
    compare: () => import('@site/views/compare'),
}
const WatchView = lazy<ComponentType<ViewProps>>(LOADERS.watch)
const TurnsView = lazy<ComponentType<ViewProps>>(LOADERS.turns)
const FieldView = lazy<ComponentType<ViewProps>>(LOADERS.field)
const CompareView = lazy<ComponentType<ViewProps>>(LOADERS.compare)

/** Loads every view's code: the server render waits on this so each view's page is prerendered whole. */
export const loadViews = (): Promise<unknown> => Promise.all(Object.values(LOADERS).map(load => load()))

/** The overview: the story and the other views, each at its own path under BENCH.path. */
export function Overview({ path }: { path: string }) {
    // The script once had its own tab; it now sits under the method, and its address still opens there.
    const script = path.replace(BENCH.path, '').replace(/\/$/, '') === 'script'
    const [tab, select] = useTab(BENCH, TABS, script ? 'method' : (tabFromPath(BENCH, TABS, path) ?? TABS[0].id))
    return (
        <Shell bench={BENCH} tabs={TABS} tab={tab} onTab={select}>
            {tab === 'story' && <StoryView onOpen={select} />}
            {tab === 'results' && (
                <Page>
                    <TableView />
                </Page>
            )}
            {tab === 'method' && <MethodView path={path} />}
            <Suspense fallback={<Loading />}>
                {tab === 'watch' && <WatchView onOpen={select} />}
                {tab === 'turns' && <TurnsView onOpen={select} />}
                {tab === 'tradeoff' && <FieldView onOpen={select} />}
                {tab === 'compare' && <CompareView onOpen={select} />}
            </Suspense>
        </Shell>
    )
}
