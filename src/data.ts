/**
 * The published results' summary, bundled at build time: results/toolbench.json. Every page is
 * prerendered from it, so the site needs no server and search engines see the numbers. Each model's
 * turns are in src/details.ts (its own page) and src/shoot.ts (the overview's views).
 */
import results from '@results/toolbench.json'

export const BENCH = {
    name: 'Toolbench',
    tagline: 'Which local AI models nail tool calls, and how fast?',
    repository: 'darkgrade/toolbench',
    /** Where the site is served; also Vite's base. */
    path: '/toolbench/',
    origin: 'https://darkgrade.com',
    /** What it is, in search terms: names like Toolbench are shared with academic benchmarks. */
    subject: 'Local LLM tool-calling benchmark',
}

/** The overview's views; each after the first is its own page at BENCH.path + id. */
export const TABS = [
    { id: 'story', label: 'Story' },
    { id: 'watch', label: 'Watch' },
    { id: 'turns', label: 'Turns' },
    { id: 'tradeoff', label: 'Field' },
    { id: 'compare', label: 'Compare' },
    { id: 'results', label: 'Table' },
    { id: 'method', label: 'Method' },
]

/** What each view is, for its page title and description. */
const TAB_PAGES: Record<string, { title: string; description: string }> = {
    watch: { title: 'Watch a model run the shoot', description: 'Replay the whole shoot turn by turn: what was said, what each model did to the camera, and how long it made you wait.' },
    turns: { title: 'Every turn, every model', description: 'Which lines of the script local models get right, where they slip, and what each one did instead.' },
    tradeoff: { title: 'Accuracy vs. speed', description: 'Every model by how often it does the right thing and how long it makes you wait.' },
    compare: { title: 'Compare two models', description: 'Two local models side by side: their scores, their waits, and every turn they handled differently.' },
    results: { title: 'Results', description: 'Every model ranked by score, with turns right, waits, download size and licence.' },
    method: { title: 'How we test', description: 'The script, the tools, the checks and the hardware behind every score, and how to repeat the run.' },
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
    /** Every run's score, in run order; the published numbers are from the median run. */
    passScores?: (number | null)[]
    strengths?: string[]
    weaknesses?: string[]
    name: string
    modelClass?: 'small' | 'mixture of experts'
    maker: string
    licence?: string
    source?: string
    files?: { name: string; bytes: number; sha256: string }[]
    sizeGigabytes?: number
    error?: string
    turnsPassed?: number
    seriousMistakes?: number
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
    dropped?: { name: string; why: string }[]
    models: ModelSummary[]
}

export interface TurnDetail {
    turn: number
    said: string
    kind: string
    expected: string
    passed: boolean
    /** 1 right, ½ only minor mistakes, 0 any serious mistake. */
    credit?: number
    failures: string[]
    reply: string
    calls: { name: string; arguments: Record<string, unknown>; valid: boolean }[]
    decisionMs: number | null
    timedOut?: boolean
}

export interface ModelDetail {
    id: string
    turns: TurnDetail[]
}

export const RUN = results as RunDetails
export const MODELS = RUN.models.filter(model => !model.error && model.score !== undefined)

/** The model a path names, if it is a model's own page. */
export function modelFromPath(path: string): ModelSummary | undefined {
    const id = path.replace(BENCH.path, '').replace(/\/$/, '')
    return id ? MODELS.find(candidate => candidate.id === id) : undefined
}

/** One row of filters per category, each a one-of-a-few choice. */
export const FILTERS: { id: string; label: string; options: { id: string; label: string; matches: (model: ModelSummary) => boolean }[] }[] = [
    {
        id: 'class',
        label: 'Kind of model',
        options: [
            { id: 'all', label: 'All models', matches: () => true },
            { id: 'small', label: 'Small', matches: model => model.modelClass === 'small' },
            { id: 'moe', label: 'Mixture of experts', matches: model => model.modelClass === 'mixture of experts' },
        ],
    },
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

/** "One script, 33 turns, English only." */
export function sampleSentence(): string {
    return `English only for now: one script of ${RUN.input?.turns ?? 33} turns, small models run three times with the median published, the others once. Treat scores within a few points of each other as ties.`
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
        title: `${BENCH.name} by Darkgrade: ${BENCH.subject}`,
        description: BENCH.tagline,
        card: { eyebrow: 'Toolbench', heading: BENCH.tagline, stats: best ? [{ label: 'Top model', value: best.name }, { label: 'Score', value: String(best.score ?? '–') }] : [] },
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
    // Each view gets a card of its own: spreading the overview gave every one of them the bench's
    // tagline and the same two stats, so /watch and /turns shared a card that named neither.
    const tabs = TABS.slice(1).map(
        (tab): Route => ({
            ...overview,
            path: `${tab.id}/`,
            title: `${TAB_PAGES[tab.id].title} | ${BENCH.name} by Darkgrade`,
            description: TAB_PAGES[tab.id].description,
            card: { eyebrow: 'Toolbench', heading: TAB_PAGES[tab.id].title, stats: [] },
        })
    )
    // The script had its own tab before it joined the method; its address still works.
    const script: Route = {
        ...overview,
        path: 'script/',
        title: `The script | ${BENCH.name} by Darkgrade`,
        description: 'The script every model hears, turn by turn, with the take markers.',
        card: { eyebrow: 'Toolbench', heading: 'The script', stats: [] },
    }
    return [overview, ...tabs, script, ...models]
}
