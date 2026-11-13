/**
 * What the viewfinder shows for a turn: the camera's true state before it (from the perfect run),
 * then what the model's tool calls asked for. Absolute settings are shown as set; relative ones
 * (brighter, warmer, zoom) as the change asked for, since which dial Studio moved isn't published.
 */
import type { Call, TurnStart } from '@site/shoot'

export interface Look extends TurnStart {
    /** Stops of brightness asked for this turn, on top of the settings. */
    exposureStops: number
    photos: number
    /** Where focus was last run, as fractions of the frame; null when it wasn't. */
    focus: { x: number; y: number } | null
    /** Files copied off the card this turn, or 'all'. */
    downloads: string[] | 'all' | null
    /** What changed this turn, for highlighting: setting names as the viewfinder labels them. */
    changed: Set<string>
}

/** Tools that only look, and never change the camera or the view. */
export const LOOKUPS = new Set(['get_camera_status', 'analyze_frame', 'get_frame', 'get_shooting_guidance', 'list_card_files'])

const START = { iso: 800, aperture: 4, shutterSeconds: 1 / 50 }
const number = (text: string): number => Number(/[\d.]+/.exec(text)?.[0] ?? NaN)
const shutterSeconds = (text: string): number => (text.includes('/') ? 1 / number(text.split('/')[1]) : number(text))

/** How much brighter than the script's opening settings the picture is, in stops. */
export function brightnessStops(look: Look): number {
    const iso = Math.log2(number(look.iso) / START.iso)
    const aperture = -2 * Math.log2(number(look.aperture) / START.aperture)
    const shutter = Math.log2(shutterSeconds(look.shutterSpeed) / START.shutterSeconds)
    const stops = iso + aperture + shutter + look.exposureStops
    return Number.isFinite(stops) ? stops : look.exposureStops
}

const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''))

function applySetting(look: Look, setting: string, value: string): void {
    if (setting === 'aperture') look.aperture = `F${number(value)}`
    else if (setting === 'iso') look.iso = /auto/i.test(value) ? 'Auto' : String(number(value))
    else if (setting === 'shutterSpeed') look.shutterSpeed = value
    else if (setting === 'colorTemperature') look.kelvin = number(value)
    else if (setting === 'exposureProgram') look.mode = value
    else return
    look.changed.add(setting)
}

/** Puts back what the request before this one changed: the settings as they were before the previous turn. */
function undo(look: Look, previous: TurnStart | undefined): void {
    if (!previous) return
    for (const key of ['iso', 'shutterSpeed', 'aperture', 'mode'] as const) {
        if (look[key] !== previous[key]) look.changed.add(key === 'mode' ? 'exposureProgram' : key)
        look[key] = previous[key]
    }
    if (look.kelvin !== previous.kelvin) look.changed.add('colorTemperature')
    look.kelvin = previous.kelvin
    look.exposureStops = 0
}

function apply(look: Look, call: Call, previous: TurnStart | undefined): void {
    const given = call.arguments
    if (call.name === 'set_setting') return applySetting(look, text(given.setting), text(given.value))
    if (call.name === 'undo_last_change') return undo(look, previous)
    if (call.name === 'adjust_exposure') {
        look.exposureStops += Number(given.stops) || 0
        look.changed.add('exposure')
    } else if (call.name === 'adjust_color_temperature') {
        look.kelvin += Number(given.kelvin) || 0
        look.changed.add('colorTemperature')
    } else if (call.name === 'set_recording') {
        look.recording = given.recording === true
        look.changed.add('recording')
    } else if (call.name === 'set_live_view') {
        look.liveView = given.on === true
        look.changed.add('liveView')
    } else if (call.name === 'set_camera_display_overlay') {
        look.cameraDisplay = given.on === true
        look.changed.add('cameraDisplay')
    } else if (call.name === 'zoom') {
        look.focalLengthMillimetres = Math.min(35, Math.max(16, look.focalLengthMillimetres + (given.direction === 'tele' ? 3 : -3)))
        look.changed.add('zoom')
    } else if (call.name === 'autofocus' || call.name === 'focus_at') {
        look.focus = { x: Number(given.x ?? 0.5), y: Number(given.y ?? 0.42) }
        look.changed.add('focus')
    } else if (call.name === 'take_photo') {
        look.photos += 1
        look.changed.add('photo')
    } else if (call.name === 'download_files') {
        look.downloads = given.all === true ? 'all' : Array.isArray(given.filenames) ? given.filenames.map(text) : []
        look.changed.add('download')
    } else if (call.name === 'set_studio_view') {
        if (typeof given.scope === 'string') look.scope = given.scope
        if (typeof given.zebras === 'boolean') look.zebras = given.zebras
        if (typeof given.focusPeaking === 'boolean') look.focusPeaking = given.focusPeaking
        look.changed.add('view')
    }
}

/**
 * The viewfinder after the first `count` of a turn's calls. Invalid calls and lookups change nothing.
 * `previous` is the turn before's start, which an undo goes back to.
 */
export function lookAfter(start: TurnStart, calls: Call[], count: number, previous: TurnStart | undefined): Look {
    const look: Look = { ...start, exposureStops: 0, photos: 0, focus: null, downloads: null, changed: new Set() }
    for (const call of calls.slice(0, count)) {
        if (call.invalid || LOOKUPS.has(call.name)) continue
        apply(look, call, previous)
    }
    return look
}
