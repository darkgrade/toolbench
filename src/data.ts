/**
 * The published results, bundled at build time: results/toolbench.json for the overview and
 * results/models/<id>.json for each model's page. Every page is prerendered from these, so the site
 * needs no server and search engines see the numbers.
 */
import results from '@results/toolbench.json'

export const BENCH = {
    name: 'Toolbench',
    tagline: 'Which local AI model gets your camera commands right?',
    repository: 'darkgrade/toolbench',
    /** Where the site is served; also Vite's base. */
    path: '/toolbench/',
    origin: 'https://darkgrade.com',
}

export interface Reason {
    area: string
    weight: number
    score: number
    points: number
    why: string
}

export interface KindScore {
    passed: number
    total: number
}

export interface ModelSummary {
    id: string
    /** 0–100, best 100 (see bench/tool-score.ts). */
    score?: number | null
    reasons?: Reason[]
    strengths?: string[]
    weaknesses?: string[]
    name: string
    maker: string
    licence?: string
    source?: string
    files?: { name: string; bytes: number; sha256: string }[]
    sizeGigabytes?: number
    error?: string
    turnsPassed?: number
    byKind?: { requests: KindScore; questions: KindScore; cannotDo: KindScore; video: KindScore }
    toolCalls?: number
    invalidToolCalls?: number
    decisionMedianMs?: number | null
    decisionP90Ms?: number | null
    loadSeconds?: number
    peakMemoryGigabytes?: number
}

export interface RunDetails {
    date?: string
    hardware?: { machine?: string; chip?: string; memoryGigabytes?: number; macOS?: string }
    input?: { turns?: number; tools?: { count?: number; commit?: string } }
    method?: Record<string, string>
    models: ModelSummary[]
}

export interface TurnDetail {
    turn: number
    said: string
    kind: string
    expected: string
    passed: boolean
    failures: string[]
    reply: string
    calls: { name: string; arguments: Record<string, unknown>; valid: boolean }[]
    decisionMs: number | null
}

export interface ModelDetail {
    id: string
    turns: TurnDetail[]
}

export const RUN = results as RunDetails
export const MODELS = RUN.models.filter(model => !model.error && model.score !== undefined)

const details = import.meta.glob<ModelDetail>('../results/models/*.json', { eager: true, import: 'default' })
export function modelDetail(id: string): ModelDetail | undefined {
    return details[`../results/models/${id}.json`]
}

/** One row of filters per category, each a one-of-a-few choice. */
export const FILTERS: { id: string; label: string; options: { id: string; label: string; matches: (model: ModelSummary) => boolean }[] }[] = [
    {
        id: 'size',
        label: 'Size',
        options: [
            { id: 'all', label: 'Any size', matches: () => true },
            { id: 'small', label: 'Small', matches: model => (model.sizeGigabytes ?? Infinity) < 6 },
            { id: 'medium', label: 'Medium', matches: model => (model.sizeGigabytes ?? 0) >= 6 && (model.sizeGigabytes ?? 0) < 13 },
            { id: 'large', label: 'Large', matches: model => (model.sizeGigabytes ?? 0) >= 13 },
        ],
    },
    {
        id: 'licence',
        label: 'Licence',
        options: [
            { id: 'all', label: 'Any licence', matches: () => true },
            { id: 'commercial', label: 'Commercial use', matches: model => !model.licence?.includes('NC') && model.licence !== 'Unstated' },
        ],
    },
]

export const percent = (value: number | null | undefined, places = 0): string => (value === null || value === undefined ? '–' : `${(value * 100).toFixed(places)}%`)
export const seconds = (milliseconds: number | null | undefined): string => (milliseconds === null || milliseconds === undefined ? '–' : `${(milliseconds / 1000).toFixed(1)} s`)

/** "One script, 29 turns, English only." */
export function sampleSentence(): string {
    return `English only for now: one script of ${RUN.input?.turns ?? 29} turns, each model run once. With one script, treat scores within a few points of each other as ties.`
}

/** Every page the site has, with what its title, description and preview card say. */
export interface Route {
    path: string
    title: string
    description: string
    card: { eyebrow: string; heading: string; stats: { label: string; value: string }[] }
}

export function routes(): Route[] {
    const best = MODELS[0]
    const overview: Route = {
        path: '',
        title: `${BENCH.name} | Darkgrade`,
        description: BENCH.tagline,
        card: { eyebrow: 'Toolbench by Darkgrade', heading: BENCH.tagline, stats: best ? [{ label: 'Top model', value: best.name }, { label: 'Score', value: String(best.score ?? '–') }] : [] },
    }
    const models = MODELS.map(
        (model): Route => ({
            path: `${model.id}/`,
            title: `${model.name} tool-calling benchmark | ${BENCH.name} by Darkgrade`,
            description: `${model.name} by ${model.maker} scores ${model.score ?? '–'}/100 at controlling a camera by voice: ${percent(model.turnsPassed)} of turns right, ${seconds(model.decisionMedianMs)} typical wait.`,
            card: {
                eyebrow: `Toolbench · ${model.maker}`,
                heading: model.name,
                stats: [
                    { label: 'Score', value: `${model.score ?? '–'}/100` },
                    { label: 'Turns right', value: percent(model.turnsPassed) },
                    { label: 'Typical wait', value: seconds(model.decisionMedianMs) },
                ],
            },
        })
    )
    return [overview, ...models]
}
