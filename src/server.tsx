/** Renders each page to HTML at build time (scripts/prerender.ts), so every page is static and crawlable. */
import { loadViews, Overview } from '@site/app'
import { BENCH, MODELS, type ModelDetail, modelFromPath, TABS } from '@site/data'
import { loadDetail } from '@site/details'
import { Entry } from '@site/entry'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'

export { routes } from '@site/data'
export { BENCH }

// A view that loads on first use renders as a placeholder until its code has arrived. Rendering each once
// asks for that code; once it is here, the pages below come out whole.
for (const tab of TABS) renderToString(<Overview path={`${BENCH.path}${tab.id}/`} />)
await loadViews()
await new Promise(resolve => setTimeout(resolve, 0))

const details = new Map<string, ModelDetail | undefined>(await Promise.all(MODELS.map(async (model): Promise<[string, ModelDetail | undefined]> => [model.id, await loadDetail(model.id)])))

export function render(path: string): string {
    const model = modelFromPath(path)
    return renderToString(<StrictMode>{model ? <Entry model={model} detail={details.get(model.id)} /> : <Overview path={path} />}</StrictMode>)
}
