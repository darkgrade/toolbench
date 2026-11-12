/**
 * The answer key in script/video-script.md as checks, one per turn. Outcome-based: what matters is where
 * the camera and Studio end up, relative to just before the turn, not which tools were used. Read-only
 * lookups never count, and an answer's wording isn't graded. Each mistake is serious (ruins a take or the
 * user's work) or minor (a small slip), as the script's answer key says.
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

/** A mistake and how much it matters: serious ruins a take or the user's work; minor is a small slip. */
export interface Mistake {
    severity: 'serious' | 'minor'
    reason: string
}

export interface Expectation {
    turn: number
    kind: TurnKind
    expected: string
    /** What a perfect assistant calls: run once to get the state every model starts each turn from. */
    perfect: { name: string; arguments: Record<string, unknown> }[]
    /** The mistakes made; none means the turn was right. */
    check(outcome: TurnOutcome): Mistake[]
}

/** A turn's credit: right 1, only minor mistakes ½, any serious mistake 0. */
export function turnCredit(mistakes: Mistake[]): number {
    if (mistakes.some(mistake => mistake.severity === 'serious')) return 0
    return mistakes.length ? 0.5 : 1
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

const count = (outcome: TurnOutcome, kind: CameraEvent['kind']): number => outcome.events.filter(event => event.kind === kind).length

/** Turns spoken during a take: only talk to camera, so nothing may change and recording must go on. */
const DURING_TAKE = new Set([15, 16, 17, 18, 24, 25, 26, 27])
const SERIOUS_ALWAYS: Change[] = ['recording', 'photo', 'download']
const SERIOUS_DURING_TAKE: Change[] = ['exposure', 'shutter', 'kelvin', 'whiteBalance', 'zoom', 'mode', 'liveView']
const CANNOT = /\b(can't|cannot|can not|unable|not able|isn't possible|not possible|no way|don't have)\b/i

const serious = (reason: string): Mistake => ({ severity: 'serious', reason })
const minor = (reason: string): Mistake => ({ severity: 'minor', reason })

/** Mistakes for anything changed beyond what the turn asked for, as the script's answer key's default rule says. */
function unrequested(outcome: TurnOutcome, turn: number, allowed: Change[]): Mistake[] {
    const mistakes: Mistake[] = []
    for (const change of changesIn(outcome)) {
        if (allowed.includes(change)) continue
        const isSerious = SERIOUS_ALWAYS.includes(change) || (DURING_TAKE.has(turn) && SERIOUS_DURING_TAKE.includes(change))
        mistakes.push(isSerious ? serious(`changed ${change} unasked`) : minor(`changed ${change} unasked`))
    }
    if (outcome.calls.some(call => !call.valid)) mistakes.push(minor('made an invalid tool call'))
    return mistakes
}

/** Talk to camera during a take: nothing changes and recording goes on. */
function video(turn: number) {
    return (outcome: TurnOutcome): Mistake[] => [
        ...unrequested(outcome, turn, []),
        ...(!outcome.after.camera.recording && !changesIn(outcome).has('recording') ? [serious('not recording during the take')] : []),
    ]
}

/** A question: nothing changes; any answer counts. */
function question(turn: number) {
    return (outcome: TurnOutcome): Mistake[] => [...unrequested(outcome, turn, []), ...(outcome.reply.trim() ? [] : [minor('gave no answer')])]
}

/** A request no tool can do: nothing changes, and the reply must not claim it was done. */
function cannotDo(turn: number, claim: RegExp) {
    return (outcome: TurnOutcome): Mistake[] => {
        const mistakes = unrequested(outcome, turn, [])
        if (claim.test(outcome.reply) && !CANNOT.test(outcome.reply)) mistakes.push(serious("claimed it did something it can't"))
        if (!outcome.reply.trim()) mistakes.push(minor('gave no answer'))
        return mistakes
    }
}

function exposure(turn: number, direction: 1 | -1) {
    return (outcome: TurnOutcome): Mistake[] => {
        const stops = (exposureStops(outcome.after.camera) - exposureStops(outcome.before.camera)) * direction
        const mistakes = unrequested(outcome, turn, ['exposure', 'shutter'])
        if (stops < -0.01) mistakes.push(minor(direction > 0 ? 'made it darker' : 'made it brighter'))
        else if (stops < 0.15) mistakes.push(minor('exposure unchanged'))
        else if (stops > 1.1) mistakes.push(minor(`changed exposure by ${stops.toFixed(1)} stops, more than a bit`))
        if (changesIn(outcome).has('shutter')) mistakes.push(minor('moved the shutter speed'))
        return mistakes
    }
}

function recording(turn: number, on: boolean) {
    return (outcome: TurnOutcome): Mistake[] => {
        const mistakes = unrequested(outcome, turn, ['recording', 'focus'])
        if (outcome.after.camera.recording !== on) mistakes.push(serious(on ? 'not recording' : 'still recording'))
        return mistakes
    }
}

function view(turn: number, change: Partial<StudioViewState>, changed: Change[]) {
    return (outcome: TurnOutcome): Mistake[] => {
        const mistakes = unrequested(outcome, turn, changed)
        for (const [key, value] of Object.entries(change)) {
            const actual = outcome.after.view[key as keyof StudioViewState]
            if (actual !== value) mistakes.push(minor(`${key} is ${String(actual)}, expected ${String(value)}`))
        }
        return mistakes
    }
}

/** A plain on/off or yes/no outcome on the camera. */
function cameraIs(turn: number, change: Change, holds: (camera: CameraState) => boolean, missed: string) {
    return (outcome: TurnOutcome): Mistake[] => [...unrequested(outcome, turn, [change]), ...(holds(outcome.after.camera) ? [] : [minor(missed)])]
}

const call = (name: string, argumentsGiven: Record<string, unknown> = {}) => ({ name, arguments: argumentsGiven })

export const ANSWER_KEY: Expectation[] = [
    { turn: 1, kind: 'question', expected: 'Any answer; nothing changes', perfect: [call('get_shooting_guidance')], check: question(1) },
    {
        turn: 2,
        kind: 'request',
        expected: 'Aperture f/5.6; ISO and shutter unchanged',
        perfect: [call('set_setting', { setting: 'aperture', value: 'f/5.6' })],
        check: cameraIs(2, 'exposure', camera => camera.settings.aperture === 'F5.6' && camera.settings.iso === '800' && camera.settings.shutterSpeed === '1/50', 'aperture is not f/5.6 (or ISO or shutter moved)'),
    },
    { turn: 3, kind: 'question', expected: 'Any answer; nothing changes', perfect: [call('analyze_frame')], check: question(3) },
    { turn: 4, kind: 'request', expected: 'A bit brighter; shutter stays', perfect: [call('adjust_exposure', { stops: 0.5 })], check: exposure(4, 1) },
    { turn: 5, kind: 'request', expected: 'Brighter again by a similar step', perfect: [call('adjust_exposure', { stops: 0.5 })], check: exposure(5, 1) },
    { turn: 6, kind: 'request', expected: 'Waveform scope', perfect: [call('set_studio_view', { scope: 'waveform' })], check: view(6, { scope: 'waveform' }, ['scope']) },
    { turn: 7, kind: 'request', expected: 'Zebras on', perfect: [call('set_studio_view', { zebras: true })], check: view(7, { zebras: true }, ['zebras']) },
    {
        turn: 8,
        kind: 'request',
        expected: 'A bit warmer',
        perfect: [call('adjust_color_temperature', { kelvin: 400 })],
        check: outcome => {
            const mistakes = unrequested(outcome, 8, ['kelvin', 'whiteBalance'])
            const change = kelvin(outcome.after.camera) - kelvin(outcome.before.camera)
            if (change <= 0) mistakes.push(minor(change < 0 ? 'made it cooler' : 'colour unchanged'))
            else if (change > 1000) mistakes.push(minor(`warmed by ${change} K, more than a bit`))
            return mistakes
        },
    },
    {
        turn: 9,
        kind: 'request',
        expected: 'The warming undone',
        perfect: [call('undo_last_change')],
        check: outcome => {
            // Each turn starts from a perfect run, whose warming step may differ from the model's own: check direction.
            const mistakes = unrequested(outcome, 9, ['kelvin'])
            const after = kelvin(outcome.after.camera)
            if (after >= kelvin(outcome.before.camera)) mistakes.push(minor('colour not undone'))
            else if (after < 5300) mistakes.push(minor(`cooled to ${after} K, past where it started`))
            return mistakes
        },
    },
    {
        turn: 10,
        kind: 'request',
        expected: 'A little wider',
        perfect: [call('zoom', { direction: 'wide', milliseconds: 500 })],
        check: outcome => {
            const mistakes = unrequested(outcome, 10, ['zoom'])
            const zooms = outcome.events.filter((event): event is Extract<CameraEvent, { kind: 'zoom' }> => event.kind === 'zoom')
            if (!zooms.some(event => event.direction === 'wide')) mistakes.push(minor('did not zoom out'))
            if (zooms.some(event => event.direction === 'tele')) mistakes.push(minor('zoomed in'))
            return mistakes
        },
    },
    { turn: 11, kind: 'request', expected: 'Focus peaking on', perfect: [call('set_studio_view', { focusPeaking: true })], check: view(11, { focusPeaking: true }, ['peaking']) },
    {
        turn: 12,
        kind: 'request',
        expected: 'Focuses on the creator',
        perfect: [call('autofocus')],
        check: outcome => [...unrequested(outcome, 12, ['focus']), ...(count(outcome, 'focus') ? [] : [minor('did not focus')])],
    },
    { turn: 13, kind: 'request', expected: "Camera's display hidden", perfect: [call('set_camera_display_overlay', { on: false })], check: cameraIs(13, 'overlay', camera => camera.osdOverlay === false, 'display still shown') },
    { turn: 14, kind: 'request', expected: 'Recording', perfect: [call('set_recording', { recording: true })], check: recording(14, true) },
    { turn: 15, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(15) },
    { turn: 16, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(16) },
    { turn: 17, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(17) },
    { turn: 18, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(18) },
    { turn: 19, kind: 'request', expected: 'Recording stops ("Cut.")', perfect: [call('set_recording', { recording: false })], check: recording(19, false) },
    { turn: 20, kind: 'cannot-do', expected: "Nothing deleted; doesn't claim it was", perfect: [], check: cannotDo(20, /\b(deleted|removed|erased)\b/i) },
    { turn: 21, kind: 'question', expected: 'Any answer; nothing changes', perfect: [call('get_camera_status')], check: question(21) },
    { turn: 22, kind: 'request', expected: 'A bit darker; shutter stays', perfect: [call('adjust_exposure', { stops: -0.5 })], check: exposure(22, -1) },
    { turn: 23, kind: 'request', expected: 'Recording', perfect: [call('set_recording', { recording: true })], check: recording(23, true) },
    { turn: 24, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(24) },
    { turn: 25, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(25) },
    { turn: 26, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(26) },
    { turn: 27, kind: 'video', expected: 'Nothing (the video); still recording', perfect: [], check: video(27) },
    { turn: 28, kind: 'request', expected: 'Recording stops ("Cut.")', perfect: [call('set_recording', { recording: false })], check: recording(28, false) },
    { turn: 29, kind: 'question', expected: 'Any answer about the card; nothing changes', perfect: [call('list_card_files')], check: question(29) },
    {
        turn: 30,
        kind: 'request',
        expected: 'C0009.MP4 and C0010.MP4 downloaded, nothing else',
        perfect: [call('download_files', { filenames: ['C0010.MP4', 'C0009.MP4'] })],
        check: outcome => {
            const mistakes = unrequested(outcome, 30, ['download'])
            const downloaded = outcome.events.flatMap(event => (event.kind === 'download' ? [event.filename] : []))
            const wanted = ['C0009.MP4', 'C0010.MP4']
            const wrong = downloaded.filter(file => !wanted.includes(file))
            if (wrong.length) mistakes.push(serious(`downloaded ${wrong.join(', ')}`))
            const missing = wanted.filter(file => !downloaded.includes(file))
            if (missing.length) mistakes.push(minor(`didn't download ${missing.join(', ')}`))
            return mistakes
        },
    },
    { turn: 31, kind: 'request', expected: 'Photo mode; no photo yet', perfect: [call('set_setting', { setting: 'exposureProgram', value: 'photo' })], check: cameraIs(31, 'mode', camera => !/^movie/i.test(mode(camera)), 'still in movie mode') },
    {
        turn: 32,
        kind: 'request',
        expected: 'One photo',
        perfect: [call('take_photo')],
        check: outcome => {
            const mistakes = unrequested(outcome, 32, ['photo', 'focus'])
            const photos = count(outcome, 'photo')
            if (photos !== 1) mistakes.push(minor(photos ? `took ${photos} photos` : 'took no photo'))
            return mistakes
        },
    },
    { turn: 33, kind: 'request', expected: 'Live view off', perfect: [call('set_live_view', { on: false })], check: cameraIs(33, 'liveView', camera => !camera.liveView, 'live view still on') },
]
