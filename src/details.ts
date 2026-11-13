/**
 * Each model's turns (results/models/<id>.json), one file per model, loaded on demand: a model's own
 * page loads its own before it renders, and Watch loads a model's when it is first chosen.
 */
import type { ModelDetail } from '@site/data'

const details = import.meta.glob<ModelDetail>('/results/models/*.json', { import: 'default' })

export function loadDetail(id: string): Promise<ModelDetail | undefined> {
    return details[`/results/models/${id}.json`]?.() ?? Promise.resolve(undefined)
}
