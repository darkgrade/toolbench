/**
 * The story's pictures. Every point is one model on one turn (model rank × turn), and each layout
 * places all of them: a galaxy of models, the script as a grid, waits as strips, models by size, and
 * the field of accuracy against speed.
 */
import { BENCH, type ModelSummary } from '@site/data'
import type { Label, Mark, Scene, Space } from '@site/kit/story'
import { OUTCOMES, type Shoot, outcome, shortName, summary } from '@site/shoot'
import { fitLabels } from '@site/views/labels'

export const PALETTE = [OUTCOMES.right.color, OUTCOMES.minor.color, OUTCOMES.serious.color, OUTCOMES.timedOut.color]
const COLOR_INDEX = { right: 0, minor: 1, serious: 2, timedOut: 3 } as const

/** The script's stretches as a phone's width has room for them. */
const NARROW_ACT_LABELS: Record<string, string> = { 'Setting up': 'Setup', 'Between takes': '', 'Wrapping up': 'Wrap' }

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
/** The longest a model may take to decide, in milliseconds. */
const LIMIT = 10_000
const FASTEST = 300

/** A steady pseudo-random 0..1 for a point, so a layout is the same every time it is drawn. */
const scatter = (seed: number): number => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return value - Math.floor(value)
}

/** Where a wait falls between the fastest worth showing and the limit, on a log scale, 0..1. */
const waitPosition = (milliseconds: number | null): number => {
    const clamped = Math.min(LIMIT, Math.max(FASTEST, milliseconds ?? LIMIT))
    return Math.log(clamped / FASTEST) / Math.log(LIMIT / FASTEST)
}

export interface Layouts {
    count: number
    galaxy: (space: Space) => Scene
    grid: (space: Space, lit?: (turn: number, model: number) => boolean) => Scene
    waits: (space: Space) => Scene
    bySize: (space: Space) => Scene
    field: (space: Space) => Scene
}

export function makeLayouts(shoot: Shoot): Layouts {
    const models: ModelSummary[] = shoot.models.map(summary)
    const modelCount = models.length
    const turnCount = shoot.turns.length
    const count = modelCount * turnCount
    const color = new Uint8Array(count)
    shoot.runs.forEach((run, model) => run.forEach((cell, turn) => (color[model * turnCount + turn] = COLOR_INDEX[outcome(cell)])))
    const arrays = () => ({ x: new Float32Array(count), y: new Float32Array(count) })

    /** Room on the left of row layouts for model names, as a share of the plot's width. */
    const gutter = (space: Space): number => (space.wide ? Math.min(0.3, 150 / space.width) : 0.09)
    const rowCentre = (model: number): number => 0.045 + ((model + 0.5) / modelCount) * 0.955

    function rowLabels(space: Space): Label[] {
        const left = gutter(space)
        const every = space.height / modelCount >= 12 ? 1 : space.height / modelCount >= 6 ? 2 : 4
        return models.flatMap((model, index): Label[] =>
            index % every === 0 || index === modelCount - 1
                ? [{ u: left - 0.012, v: rowCentre(index), text: space.wide ? shortName(model) : String(index + 1), align: 'end', href: space.wide ? `${BENCH.path}${model.id}/` : undefined }]
                : []
        )
    }

    /** Each turn's column across the grid, with a gap between the script's stretches. */
    function columns(space: Space): number[] {
        const left = gutter(space)
        const gap = 0.9
        const units = turnCount + (shoot.acts.length - 1) * gap
        return shoot.turns.map((turn, index) => left + ((index + turn.act * gap + 0.5) / units) * (1 - left))
    }

    function galaxy(space: Space): Scene {
        const { x, y } = arrays()
        const reachX = space.width * 0.46
        const reachY = space.height * 0.46
        const cluster = 0.47 * Math.sqrt((reachX * reachY) / modelCount)
        for (let model = 0; model < modelCount; model++) {
            const distance = Math.sqrt((model + 0.6) / modelCount)
            const angle = model * GOLDEN_ANGLE
            const centreX = space.width / 2 + Math.cos(angle) * distance * reachX
            const centreY = space.height / 2 + Math.sin(angle) * distance * reachY
            for (let turn = 0; turn < turnCount; turn++) {
                const spread = Math.sqrt((turn + 0.5) / turnCount) * cluster
                const index = model * turnCount + turn
                x[index] = (centreX + Math.cos(turn * GOLDEN_ANGLE) * spread) / space.width
                y[index] = (centreY + Math.sin(turn * GOLDEN_ANGLE) * spread) / space.height
            }
        }
        const labels: Label[] = [0, 1, 2].map(model => {
            const index = model * turnCount
            return { u: x[index], v: y[index] + (cluster * 1.25) / space.height, text: shortName(models[model]), tone: 'strong' as const }
        })
        return { x, y, color, radius: Math.max(1.6, cluster / 8.2), labels }
    }

    function grid(space: Space, lit?: (turn: number, model: number) => boolean): Scene {
        const { x, y } = arrays()
        const bright = new Float32Array(count)
        const column = columns(space)
        for (let model = 0; model < modelCount; model++) {
            for (let turn = 0; turn < turnCount; turn++) {
                const index = model * turnCount + turn
                x[index] = column[turn]
                y[index] = rowCentre(model)
                bright[index] = !lit || lit(turn, model) ? 1 : 0.12
            }
        }
        const step = column[1] - column[0]
        const labels: Label[] = [
            ...rowLabels(space),
            ...shoot.acts.map((act): Label => ({ u: (column[act.from - 1] + column[act.to - 1]) / 2, v: 0, text: space.wide ? act.label : (NARROW_ACT_LABELS[act.label] ?? act.label), tone: act.recording ? 'accent' : 'muted' })),
        ]
        const marks: Mark[] = shoot.acts
            .filter(act => act.recording)
            .map(act => ({ u0: column[act.from - 1] - step * 0.6, v0: 0.03, u1: column[act.to - 1] + step * 0.6, v1: 1.01, tone: 'band' }))
        const radius = Math.max(1.5, Math.min((step * space.width) / 2, (space.height * 0.955) / modelCount / 2) * 0.92)
        return { x, y, color, bright, radius, shape: 'cell', labels, marks }
    }

    function waits(space: Space): Scene {
        const { x, y } = arrays()
        const left = gutter(space)
        const across = (milliseconds: number | null): number => left + waitPosition(milliseconds) * (1 - left - 0.02)
        const rowHeight = 0.955 / modelCount
        shoot.runs.forEach((run, model) =>
            run.forEach((cell, turn) => {
                const index = model * turnCount + turn
                x[index] = across(cell.timedOut ? LIMIT : cell.wait)
                y[index] = rowCentre(model) + (scatter(index) - 0.5) * rowHeight * 0.7
            })
        )
        const ticks = [
            { at: 300, text: '0.3 s' },
            { at: 1000, text: '1 s' },
            { at: 3000, text: '3 s' },
            { at: LIMIT, text: space.wide ? '10 s, the limit' : '10 s' },
        ]
        return {
            x,
            y,
            color,
            radius: Math.max(1.6, Math.min(3.4, (space.height / modelCount) * 0.24)),
            labels: [...rowLabels(space), ...ticks.map((tick): Label => ({ u: across(tick.at), v: 0, text: tick.text, tone: tick.at === LIMIT ? 'accent' : 'muted', align: tick.at === LIMIT ? 'end' : 'center' }))],
            marks: ticks.slice(1).map((tick): Mark => ({ u0: across(tick.at), v0: 0.03, u1: across(tick.at), v1: 1.01, tone: tick.at === LIMIT ? 'accent' : 'line' })),
        }
    }

    function bySize(space: Space): Scene {
        const { x, y } = arrays()
        const order = models.map((_, index) => index).sort((first, second) => (models[first].sizeGigabytes ?? 0) - (models[second].sizeGigabytes ?? 0))
        const rank = { right: 0, minor: 1, serious: 2, timedOut: 3 }
        const top = 0.06
        const bottom = 0.93
        order.forEach((model, column) => {
            const stack = shoot.runs[model].map((cell, turn) => ({ turn, rank: rank[outcome(cell)] })).sort((first, second) => first.rank - second.rank || first.turn - second.turn)
            stack.forEach(({ turn }, level) => {
                const index = model * turnCount + turn
                x[index] = (column + 0.5) / modelCount
                y[index] = bottom - ((level + 0.5) / turnCount) * (bottom - top)
            })
        })
        const marked = [0, Math.round(modelCount * 0.25), Math.round(modelCount * 0.5), Math.round(modelCount * 0.75), modelCount - 1]
        const labels: Label[] = marked.map(column => ({ u: (column + 0.5) / modelCount, v: 0.975, text: `${(models[order[column]].sizeGigabytes ?? 0).toFixed(models[order[column]].sizeGigabytes! < 1 ? 2 : 0)} GB` }))
        labels.push({ u: 0, v: 0.01, text: 'Smallest download', align: 'start' }, { u: 1, v: 0.01, text: 'Largest', align: 'end' })
        const radius = Math.max(1.5, Math.min(space.width / modelCount / 2, (space.height * (bottom - top)) / turnCount / 2) * 0.9)
        return { x, y, color, radius, shape: 'cell', labels }
    }

    function field(space: Space): Scene {
        const { x, y } = arrays()
        const left = space.wide ? 0.07 : 0.12
        const lowest = Math.min(...models.map(model => model.turnsPassed ?? 1))
        const floor = Math.floor(lowest * 10) / 10
        const across = (milliseconds: number | null | undefined): number => left + waitPosition(milliseconds ?? LIMIT) * (1 - left - 0.04)
        const up = (share: number): number => 0.93 - ((share - floor) / (1 - floor)) * 0.86
        const blob = Math.min(space.width, space.height) * 0.02
        models.forEach((model, modelIndex) => {
            const centreX = across(model.decisionMedianMs) * space.width
            const centreY = up(model.turnsPassed ?? floor) * space.height
            for (let turn = 0; turn < turnCount; turn++) {
                const spread = Math.sqrt((turn + 0.5) / turnCount) * blob
                const index = modelIndex * turnCount + turn
                x[index] = (centreX + Math.cos(turn * GOLDEN_ANGLE) * spread) / space.width
                y[index] = (centreY + Math.sin(turn * GOLDEN_ANGLE) * spread) / space.height
            }
        })
        const names = fitLabels(
            models.slice(0, space.wide ? 12 : 5).map(model => ({ x: across(model.decisionMedianMs) * space.width, y: up(model.turnsPassed ?? floor) * space.height, clearance: blob * 1.5, text: shortName(model), model })),
            space.width,
            space.height
        )
        const labels: Label[] = [
            ...names.map((name): Label => ({ u: name.x / space.width, v: name.y / space.height, text: name.item.text, tone: 'strong', align: name.anchor === 'middle' ? 'center' : name.anchor, href: `${BENCH.path}${name.item.model.id}/` })),
            ...[1000, 3000, LIMIT].map((at): Label => ({ u: across(at), v: 0.985, text: at === LIMIT ? '10 s' : `${at / 1000} s` })),
            { u: left, v: 0.985, text: 'Typical wait →', align: 'start' },
            ...[floor, (1 + floor) / 2, 1].map((share): Label => ({ u: left - 0.015, v: up(share), text: `${Math.round(share * 100)}%`, align: 'end' })),
            { u: left - 0.015, v: 0.02, text: 'Turns right', align: space.wide ? 'end' : 'start' },
        ]
        const marks: Mark[] = [
            { u0: left, v0: up(1), u1: 0.97, v1: up(1), tone: 'line' },
            { u0: across(1000), v0: 0.05, u1: across(1000), v1: 0.95, tone: 'line' },
        ]
        return { x, y, color, radius: Math.max(1.5, blob / 7.5), labels, marks }
    }

    return { count, galaxy, grid, waits, bySize, field }
}
