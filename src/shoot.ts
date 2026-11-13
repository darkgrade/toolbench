/**
 * The whole shoot, as the overview's views read it: every model's every turn (scripts/build-data.ts
 * writes public/data/shoot.json from the published results). Loaded once, on first use, in the browser.
 */
import { BENCH, MODELS, type ModelSummary } from '@site/data'
import { TONE } from '@site/kit/theme'
import { useEffect, useState } from 'react'

export interface Call {
    name: string
    arguments: Record<string, unknown>
    invalid?: boolean
}

/** One model on one turn. */
export interface Cell {
    /** 1 right, ½ only minor mistakes, 0 any serious mistake. */
    credit: number
    /** Milliseconds until its first action or its answer; null when it never decided. */
    wait: number | null
    timedOut?: boolean
    failures?: string[]
    calls?: Call[]
}

export interface Turn {
    turn: number
    said: string
    kind: 'request' | 'question' | 'cannot-do' | 'video'
    expected: string
    /** Index into acts. */
    act: number
}

export interface Act {
    label: string
    from: number
    to: number
    recording: boolean
}

/** Where the camera and Studio's view are before a turn, from the perfect run. */
export interface TurnStart {
    turn: number
    mode: string
    iso: string
    shutterSpeed: string
    aperture: string
    kelvin: number
    focalLengthMillimetres: number
    recording: boolean
    liveView: boolean
    cameraDisplay: boolean
    scope: string
    zebras: boolean
    focusPeaking: boolean
    files: string[]
}

export interface Shoot {
    /** Model ids, best score first: the order of `runs`. */
    models: string[]
    acts: Act[]
    turns: Turn[]
    before: TurnStart[]
    runs: Cell[][]
}

let loading: Promise<Shoot> | undefined

export function loadShoot(): Promise<Shoot> {
    loading ??= fetch(`${BENCH.path}data/shoot.json`).then(response => {
        if (!response.ok) throw new Error(`shoot.json: ${response.status}`)
        return response.json() as Promise<Shoot>
    })
    return loading
}

/** The shoot once it has loaded; undefined until then, an Error if it couldn't be. */
export function useShoot(): Shoot | Error | undefined {
    const [shoot, setShoot] = useState<Shoot | Error>()
    useEffect(() => {
        let current = true
        loadShoot().then(
            loaded => current && setShoot(loaded),
            error => current && setShoot(error instanceof Error ? error : new Error(String(error)))
        )
        return () => {
            current = false
        }
    }, [])
    return shoot
}

export type Outcome = 'right' | 'minor' | 'serious' | 'timedOut'

export function outcome(cell: Cell): Outcome {
    if (cell.timedOut) return 'timedOut'
    return cell.credit === 1 ? 'right' : cell.credit === 0.5 ? 'minor' : 'serious'
}

export const OUTCOMES: Record<Outcome, { label: string; color: string }> = {
    right: { label: 'Right', color: TONE.good },
    minor: { label: 'Small slip', color: TONE.fair },
    serious: { label: 'Serious mistake', color: TONE.bad },
    timedOut: { label: 'Ran out of time', color: TONE.worst },
}

export const KIND_LABELS: Record<Turn['kind'], string> = { request: 'Request', question: 'Question', 'cannot-do': "Can't be done", video: 'The video' }

/** The summary row for a model id; the shoot lists only models that have one. */
export const summary = (id: string): ModelSummary => MODELS.find(model => model.id === id)!

/** A mistake as the results record it ("serious: still recording"), without its severity. */
export const mistake = (failure: string): string => failure.replace(/^(serious|minor): /, '')

/** A tool call as one short line: `adjust_exposure  stops 0.5 · using auto`. */
export function callArguments(call: Call): string {
    return Object.entries(call.arguments)
        .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`)
        .join(' · ')
}

const withoutFileFormat = (name: string): string => name.replace(/\s*\([^)]*\)$/, '')
const bareNames = MODELS.map(model => withoutFileFormat(model.name))

/** A model's name without its file format in brackets, for tight places; kept when two models differ only by it. */
export const shortName = (model: ModelSummary): string => {
    const bare = withoutFileFormat(model.name)
    return bareNames.filter(name => name === bare).length > 1 ? model.name : bare
}
