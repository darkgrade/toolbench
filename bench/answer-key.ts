/**
 * The answer key in script/video-script.md as checks, one per turn. Each looks at what the turn changed
 * on the simulated camera and in Studio's view, relative to just before it, and at the tool calls made.
 * Request turns may make extra read-only calls; video turns ("none") may make no call at all.
 */
import type { CameraEvent } from '@bench/simulated-camera'
import { apertureToNumber, isoToNumber, shutterToNumber } from '@shared/exposure-stops'
import type { CameraState, StudioViewState } from '@shared/ipc'

export interface ToolCall {
    name: string
    arguments: Record<string, unknown>
    valid: boolean
    changesSomething: boolean
}

export interface TurnOutcome {
    before: { camera: CameraState; view: StudioViewState }
    after: { camera: CameraState; view: StudioViewState }
    events: CameraEvent[]
    calls: ToolCall[]
    reply: string
}

export type TurnKind = 'request' | 'question' | 'cannot-do' | 'video'

export interface Expectation {
    turn: number
    kind: TurnKind
    expected: string
    /** What a perfect assistant calls: run once to get the state every model starts each turn from. */
    perfect: { name: string; arguments: Record<string, unknown> }[]
    /** The reasons it failed; empty means it passed. */
    check(outcome: TurnOutcome): string[]
}

const kelvin = (camera: CameraState): number => Number(camera.controls?.colorTemperature?.value)
const mode = (camera: CameraState): string => camera.controls?.exposureProgram?.value ?? ''

/** Total exposure in stops (ISO + shutter + aperture), so a change by any of them counts. */
function exposureStops(camera: CameraState): number {
    const iso = Math.log2(isoToNumber(camera.settings.iso ?? '') ?? 100)
    const shutter = Math.log2(shutterToNumber(camera.settings.shutterSpeed ?? '') ?? 1)
    const aperture = -2 * Math.log2(apertureToNumber(camera.settings.aperture ?? '') ?? 1)
    return iso + shutter + aperture
}

type Change = 'exposure' | 'shutter' | 'kelvin' | 'whiteBalance' | 'mode' | 'focus' | 'photo' | 'recording' | 'liveView' | 'zoom' | 'overlay' | 'download' | 'scope' | 'zebras' | 'peaking' | 'otherSetting'

/** Everything a turn changed, in the answer key's terms. */
function changesIn(outcome: TurnOutcome): Set<Change> {
    const changes = new Set<Change>()
    const { before, after } = outcome
    if (Math.abs(exposureStops(after.camera) - exposureStops(before.camera)) > 0.01) changes.add('exposure')
    if (after.camera.settings.shutterSpeed !== before.camera.settings.shutterSpeed) changes.add('shutter')
    if (kelvin(after.camera) !== kelvin(before.camera)) changes.add('kelvin')
    if (after.camera.controls?.whiteBalance?.value !== before.camera.controls?.whiteBalance?.value) changes.add('whiteBalance')
    if (mode(after.camera) !== mode(before.camera)) changes.add('mode')
    if (after.camera.liveView !== before.camera.liveView) changes.add('liveView')
    if (after.camera.osdOverlay !== before.camera.osdOverlay) changes.add('overlay')
    if (after.view.scope !== before.view.scope) changes.add('scope')
    if (after.view.zebras !== before.view.zebras) changes.add('zebras')
    if (after.view.focusPeaking !== before.view.focusPeaking) changes.add('peaking')
    const known = ['iso', 'shutterSpeed', 'aperture', 'colorTemperature', 'whiteBalance', 'exposureProgram']
    for (const event of outcome.events) {
        if (event.kind === 'focus') changes.add('focus')
        if (event.kind === 'photo') changes.add('photo')
        if (event.kind === 'recording') changes.add('recording')
        if (event.kind === 'zoom') changes.add('zoom')
        if (event.kind === 'download') changes.add('download')
        if (event.kind === 'setting' && !known.includes(event.setting)) changes.add('otherSetting')
    }
    return changes
}

function onlyChanged(outcome: TurnOutcome, allowed: Change[]): string[] {
    return [...changesIn(outcome)].filter(change => !allowed.includes(change)).map(change => `also changed ${change}`)
}

const count = (outcome: TurnOutcome, kind: CameraEvent['kind']): number => outcome.events.filter(event => event.kind === kind).length
const invalidCalls = (outcome: TurnOutcome): string[] => (outcome.calls.some(call => !call.valid) ? ['made an invalid tool call'] : [])

/** The video itself: no tool call of any kind. */
function none(outcome: TurnOutcome): string[] {
    return outcome.calls.length ? [`called ${outcome.calls.map(call => call.name).join(', ')} during the video`] : []
}

/** A question: a reply, nothing changed, optionally a required read-only call and something the reply must say. */
function answerOnly(options: { requires?: string; says?: RegExp } = {}) {
    return (outcome: TurnOutcome): string[] => {
        const failures = [...onlyChanged(outcome, []), ...invalidCalls(outcome)]
        if (outcome.calls.some(call => call.changesSomething)) failures.push(`called ${outcome.calls.filter(call => call.changesSomething).map(call => call.name).join(', ')}`)
        if (!outcome.reply.trim()) failures.push('gave no answer')
        if (options.requires && !outcome.calls.some(call => call.name === options.requires)) failures.push(`didn't call ${options.requires}`)
        if (options.says && !options.says.test(outcome.reply)) failures.push(`answer ${JSON.stringify(outcome.reply.slice(0, 100))} misses the point`)
        return failures
    }
}

const CANNOT = /\b(can't|cannot|can not|unable|not able|no (way|tool)|don't have|isn't (something|possible)|not (something|possible|supported)|doesn't (support|let))\b/i

function cannotDo(outcome: TurnOutcome): string[] {
    return answerOnly({ says: CANNOT })(outcome)
}

function exposureBy(minimumStops: number, maximumStops: number, also: Change[] = []) {
    return (outcome: TurnOutcome): string[] => {
        const stops = exposureStops(outcome.after.camera) - exposureStops(outcome.before.camera)
        const failures = [...onlyChanged(outcome, ['exposure', ...also]), ...invalidCalls(outcome)]
        if (stops < minimumStops || stops > maximumStops) failures.push(`exposure moved ${stops.toFixed(2)} stops, expected ${minimumStops} to ${maximumStops}`)
        return failures
    }
}

function recording(on: boolean) {
    return (outcome: TurnOutcome): string[] => {
        const failures = [...onlyChanged(outcome, ['recording']), ...invalidCalls(outcome)]
        if (outcome.after.camera.recording !== on) failures.push(on ? 'not recording' : 'still recording')
        return failures
    }
}

function view(change: Partial<StudioViewState>, changed: Change[]) {
    return (outcome: TurnOutcome): string[] => {
        const failures = [...onlyChanged(outcome, changed), ...invalidCalls(outcome)]
        for (const [key, value] of Object.entries(change)) {
            const actual = outcome.after.view[key as keyof StudioViewState]
            if (actual !== value) failures.push(`${key} is ${String(actual)}, expected ${String(value)}`)
        }
        return failures
    }
}

/** Index of the first event matching, or -1. */
const firstIndex = (outcome: TurnOutcome, match: (event: CameraEvent) => boolean): number => outcome.events.findIndex(match)

const call = (name: string, argumentsGiven: Record<string, unknown> = {}) => ({ name, arguments: argumentsGiven })

export const ANSWER_KEY: Expectation[] = [
    { turn: 1, kind: 'question', expected: 'Answer: a little dark, nothing clipped. Nothing changes.', perfect: [call('analyze_frame')], check: answerOnly({ says: /dark|under/i }) },
    { turn: 2, kind: 'request', expected: 'Exposure up about a third to two thirds of a stop; shutter stays at 1/50', perfect: [call('adjust_exposure', { stops: 0.33 })], check: exposureBy(0.15, 1.1) },
    { turn: 3, kind: 'request', expected: 'Exposure up again by a similar step', perfect: [call('adjust_exposure', { stops: 0.33 })], check: exposureBy(0.15, 1.1) },
    { turn: 4, kind: 'request', expected: 'Waveform scope and zebras on', perfect: [call('set_studio_view', { scope: 'waveform', zebras: true })], check: view({ scope: 'waveform', zebras: true }, ['scope', 'zebras']) },
    {
        turn: 5,
        kind: 'request',
        expected: 'Colour temperature up a touch (+150 to +500 K)', perfect: [call('adjust_color_temperature', { kelvin: 300 })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['kelvin']), ...invalidCalls(outcome)]
            const change = kelvin(outcome.after.camera) - kelvin(outcome.before.camera)
            if (change < 150 || change > 500) failures.push(`colour temperature moved ${change} K`)
            return failures
        },
    },
    { turn: 6, kind: 'request', expected: 'Focus peaking on', perfect: [call('set_studio_view', { focusPeaking: true })], check: view({ focusPeaking: true }, ['peaking']) },
    {
        turn: 7,
        kind: 'request',
        expected: 'The colour change from turn 5 undone (back to 5600 K); peaking stays on, exposure untouched', perfect: [call('undo_last_change')],
        check: outcome => {
            // Each turn starts from a perfect run's state, whose warming step may differ from the model's own,
            // so this checks the direction: cooler than before, but not cooler than the 5600 K it started at.
            const failures = [...onlyChanged(outcome, ['kelvin']), ...invalidCalls(outcome)]
            const after = kelvin(outcome.after.camera)
            if (after > kelvin(outcome.before.camera) - 100 || after < 5500) failures.push(`colour temperature is ${after} K: expected the warming undone, back towards 5600 K`)
            return failures
        },
    },
    {
        turn: 8,
        kind: 'request',
        expected: 'One short zoom out; never in', perfect: [call('zoom', { direction: 'wide', milliseconds: 500 })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['zoom']), ...invalidCalls(outcome)]
            const zooms = outcome.events.filter(event => event.kind === 'zoom')
            if (!zooms.some(event => event.kind === 'zoom' && event.direction === 'wide')) failures.push('did not zoom out')
            if (zooms.some(event => event.kind === 'zoom' && event.direction === 'tele')) failures.push('zoomed in')
            const long = outcome.calls.find(call => call.name === 'zoom' && Number(call.arguments.milliseconds ?? 500) > 1500)
            if (long) failures.push('zoomed for too long')
            return failures
        },
    },
    {
        turn: 9,
        kind: 'request',
        expected: "Camera's on-screen display hidden; live view and Studio's view untouched", perfect: [call('set_camera_display_overlay', { on: false })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['overlay']), ...invalidCalls(outcome)]
            if (outcome.after.camera.osdOverlay !== false) failures.push('overlay still on')
            return failures
        },
    },
    {
        turn: 10,
        kind: 'request',
        expected: 'Focus, then start recording', perfect: [call('autofocus'), call('set_recording', { recording: true })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['focus', 'recording']), ...invalidCalls(outcome)]
            const focused = firstIndex(outcome, event => event.kind === 'focus')
            const started = firstIndex(outcome, event => event.kind === 'recording' && event.on)
            if (focused === -1) failures.push('did not focus')
            if (started === -1 || !outcome.after.camera.recording) failures.push('not recording')
            if (focused !== -1 && started !== -1 && started < focused) failures.push('started recording before focusing')
            return failures
        },
    },
    { turn: 11, kind: 'video', expected: 'Nothing (the video)', perfect: [], check: none },
    { turn: 12, kind: 'video', expected: 'Nothing (the video)', perfect: [], check: none },
    { turn: 13, kind: 'video', expected: 'Nothing ("cut" inside a sentence)', perfect: [], check: none },
    { turn: 14, kind: 'request', expected: 'Recording stops ("Cut.")', perfect: [call('set_recording', { recording: false })], check: recording(false) },
    { turn: 15, kind: 'cannot-do', expected: "Says it can't delete files; nothing changes", perfect: [], check: cannotDo },
    { turn: 16, kind: 'cannot-do', expected: "Says it can't change the mic level; nothing changes", perfect: [], check: cannotDo },
    { turn: 17, kind: 'question', expected: 'Answer: yes, 1/50 at 25p follows the 180° rule. Nothing changes.', perfect: [call('get_camera_status')], check: answerOnly({ says: /\b(yes|right|correct|good|fine|perfect|180)\b/i }) },
    { turn: 18, kind: 'question', expected: 'Answer from the picture. Nothing changes.', perfect: [call('get_frame')], check: answerOnly() },
    { turn: 19, kind: 'request', expected: 'Recording starts', perfect: [call('set_recording', { recording: true })], check: recording(true) },
    { turn: 20, kind: 'video', expected: 'Nothing (advice to the viewer)', perfect: [], check: none },
    {
        turn: 21,
        kind: 'request',
        expected: 'Exposure down a little; recording keeps going; shutter stays', perfect: [call('adjust_exposure', { stops: -0.33 })],
        check: outcome => {
            const failures = exposureBy(-1.1, -0.15)(outcome)
            if (!outcome.after.camera.recording) failures.push('stopped recording')
            return failures
        },
    },
    { turn: 22, kind: 'video', expected: 'Nothing (advice to the viewer)', perfect: [], check: none },
    { turn: 23, kind: 'video', expected: 'Nothing ("stop recording" inside a sentence)', perfect: [], check: none },
    { turn: 24, kind: 'request', expected: 'Recording stops ("Cut.")', perfect: [call('set_recording', { recording: false })], check: recording(false) },
    {
        turn: 25,
        kind: 'request',
        expected: 'Focus at the lamp: left of the frame, mid-height', perfect: [call('focus_at', { x: 0.15, y: 0.5 })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['focus']), ...invalidCalls(outcome)]
            const point = outcome.events.find((event): event is Extract<CameraEvent, { kind: 'focus' }> => event.kind === 'focus' && event.x !== undefined)
            if (!point) failures.push('did not focus at a point')
            else if (point.x! < 0.05 || point.x! > 0.4 || point.y! < 0.2 || point.y! > 0.8) failures.push(`focused at ${point.x}, ${point.y}, not the lamp`)
            return failures
        },
    },
    {
        turn: 26,
        kind: 'request',
        expected: 'Photo mode, then one photo', perfect: [call('set_setting', { setting: 'exposureProgram', value: 'photo' }), call('take_photo')],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['mode', 'photo', 'focus']), ...invalidCalls(outcome)]
            if (/^movie/i.test(mode(outcome.after.camera))) failures.push(`mode is ${mode(outcome.after.camera)}`)
            if (count(outcome, 'photo') !== 1) failures.push(`took ${count(outcome, 'photo')} photos`)
            const switched = firstIndex(outcome, event => event.kind === 'setting' && event.setting === 'exposureProgram')
            const photo = firstIndex(outcome, event => event.kind === 'photo')
            if (switched !== -1 && photo !== -1 && photo < switched) failures.push('took the photo before switching mode')
            return failures
        },
    },
    { turn: 27, kind: 'question', expected: 'Answer from the card listing. Nothing changes.', perfect: [call('list_card_files')], check: answerOnly({ requires: 'list_card_files' }) },
    {
        turn: 28,
        kind: 'request',
        expected: 'Download C0010.MP4 and C0009.MP4 only', perfect: [call('download_files', { filenames: ['C0010.MP4', 'C0009.MP4'] })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['download']), ...invalidCalls(outcome)]
            const downloaded = outcome.events.flatMap(event => (event.kind === 'download' ? [event.filename] : [])).sort()
            if (downloaded.join(',') !== 'C0009.MP4,C0010.MP4') failures.push(`downloaded ${downloaded.join(', ') || 'nothing'}`)
            return failures
        },
    },
    {
        turn: 29,
        kind: 'request',
        expected: 'Live view off', perfect: [call('set_live_view', { on: false })],
        check: outcome => {
            const failures = [...onlyChanged(outcome, ['liveView']), ...invalidCalls(outcome)]
            if (outcome.after.camera.liveView) failures.push('live view still on')
            return failures
        },
    },
]
