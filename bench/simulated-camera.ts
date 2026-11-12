/**
 * A camera that lives in memory, set up as the script's opening describes (script/video-script.md,
 * "Setup"). Toolbench swaps it in for Studio's `@main/camera-service`, so Studio's real tool code
 * (relative exposure, undo, mode switching, status) runs unchanged without a camera or the app.
 */
import type { CameraControl, CameraControlName, CameraState, FileEntry } from '@shared/ipc'
import { CAMERA_CONTROL_NAMES } from '@shared/ipc'
import { readFileSync } from 'node:fs'

export type CameraEvent =
    | { kind: 'setting'; setting: string; from: string | null; to: string }
    | { kind: 'focus'; x?: number; y?: number }
    | { kind: 'photo' }
    | { kind: 'recording'; on: boolean }
    | { kind: 'liveView'; on: boolean }
    | { kind: 'zoom'; direction: 'wide' | 'tele' }
    | { kind: 'overlay'; on: boolean }
    | { kind: 'download'; filename: string }

const ISO_VALUES = ['Auto', '100', '125', '160', '200', '250', '320', '400', '500', '640', '800', '1000', '1250', '1600', '2000', '2500', '3200', '4000', '5000', '6400', '8000', '10000', '12800']
const SHUTTER_VALUES = ['1/8000', '1/4000', '1/2000', '1/1000', '1/500', '1/250', '1/200', '1/160', '1/125', '1/100', '1/80', '1/60', '1/50', '1/40', '1/30', '1/25', '1/15', '1/8', '1/4', '1/2', '1"']
const APERTURE_VALUES = ['F4.0', 'F4.5', 'F5.0', 'F5.6', 'F6.3', 'F7.1', 'F8.0', 'F9.0', 'F10', 'F11', 'F13', 'F14', 'F16', 'F18', 'F20', 'F22']
const KELVIN_VALUES = Array.from({ length: 75 }, (_, index) => String(2500 + index * 100))
const MODES = ['Program Auto', 'Aperture Priority', 'Shutter Priority', 'Manual', 'Movie Program Auto', 'Movie Aperture Priority', 'Movie Shutter Priority', 'Movie Manual']

function control(value: string, options: string[]): CameraControl {
    return { value, options, enabled: true }
}

function startingControls(): Record<CameraControlName, CameraControl | null> {
    const controls = Object.fromEntries(CAMERA_CONTROL_NAMES.map(name => [name, null])) as Record<CameraControlName, CameraControl | null>
    return {
        ...controls,
        exposureProgram: control('Movie Manual', MODES),
        iso: control('800', ISO_VALUES),
        shutterSpeed: control('1/50', SHUTTER_VALUES),
        aperture: control('F4.0', APERTURE_VALUES),
        whiteBalance: control('Color Temp./Filter', ['Auto', 'Daylight', 'Shade', 'Cloudy', 'Incandescent', 'Fluor.: Warm White', 'Flash', 'Color Temp./Filter', 'Custom 1']),
        colorTemperature: control('5600', KELVIN_VALUES),
        focusMode: control('AF-C', ['AF-S', 'AF-C', 'DMF', 'MF']),
        focusArea: control('Wide', ['Wide', 'Zone', 'Center Fix', 'Spot: S', 'Spot: M', 'Spot: L']),
        subjectRecognition: control('On', ['On', 'Off']),
        recognitionTarget: control('Human', ['Human', 'Animal', 'Bird', 'Insect', 'Car/Train', 'Airplane']),
        movieFrameRate: control('25p', ['24p', '25p', '50p', '100p']),
        movieFormat: control('XAVC S 4K', ['XAVC S 4K', 'XAVC S HD', 'XAVC HS 4K', 'XAVC S-I 4K']),
    }
}

function startingFiles(): FileEntry[] {
    const file = (handle: number, filename: string, sizeBytes: number, captureDate: string): FileEntry => ({
        storageId: 0x10001,
        storageDescription: 'SLOT 1',
        objectHandle: handle,
        filename,
        sizeBytes,
        format: filename.endsWith('MP4') ? 'MP4' : 'JPEG',
        captureDate,
    })
    return [file(1, 'C0007.MP4', 912_000_000, '2026-11-10T16:02:11'), file(2, 'C0008.MP4', 874_000_000, '2026-11-10T16:20:40')]
}

export interface CameraSnapshot {
    state: CameraState
    files: FileEntry[]
    focalLengthMillimetres: number
    photoNumber: number
    clipNumber: number
}

/** Stands in for `cameraService` with the subset of its interface Studio's tools use. */
class SimulatedCamera {
    events: CameraEvent[] = []
    latestLiveViewFrame: Uint8Array | null = null
    private state!: CameraState
    private files: FileEntry[] = []
    private focalLengthMillimetres = 24
    private zoomDirection: 'wide' | 'tele' | null = null
    /** The answer key expects the photo to be DSC00042.JPG and the two takes C0009.MP4 and C0010.MP4. */
    private photoNumber = 42
    private clipNumber = 9

    constructor() {
        this.reset()
    }

    /** Back to the script's start state: Movie Manual, 1/50, f/4, ISO 800, 5600 K, live view and the camera's display overlay on, not recording. */
    reset(): void {
        this.events = []
        this.files = startingFiles()
        this.focalLengthMillimetres = 24
        this.photoNumber = 42
        this.clipNumber = 9
        this.state = {
            connected: true,
            phase: 'connected',
            vendor: 'Sony',
            model: 'α7 V',
            battery: { percent: 80, level: 'high', powerSource: 'battery', remainingMinutes: 105 },
            card: { freeBytes: null, remainingPhotos: 1840, remainingVideoSeconds: 5400 },
            lens: { name: 'FE PZ 16-35mm F4 G', focalLengthMillimetres: 24 },
            clock: null,
            controls: startingControls(),
            osdOverlay: true,
            liveView: true,
            recording: false,
            settings: { iso: '800', shutterSpeed: '1/50', aperture: 'F4.0' },
            downloadDir: '/tmp/toolbench-downloads',
            platform: 'darwin',
        } as CameraState
    }

    /** Puts the camera into a given state (used to line every model up with the answer key). */
    restore(snapshot: CameraSnapshot): void {
        this.state = structuredClone(snapshot.state)
        this.files = structuredClone(snapshot.files)
        this.focalLengthMillimetres = snapshot.focalLengthMillimetres
        this.photoNumber = snapshot.photoNumber
        this.clipNumber = snapshot.clipNumber
    }

    snapshot(): CameraSnapshot {
        return { state: structuredClone(this.state), files: structuredClone(this.files), focalLengthMillimetres: this.focalLengthMillimetres, photoNumber: this.photoNumber, clipNumber: this.clipNumber }
    }

    useFrame(path: string): void {
        this.latestLiveViewFrame = new Uint8Array(readFileSync(path))
    }

    getState(): CameraState {
        return this.state
    }

    async setControl(name: CameraControlName, value: string): Promise<CameraState> {
        const current = this.state.controls?.[name]
        if (!current) throw new Error(`${name} is not available`)
        if (!current.options.includes(value)) throw new Error(`${name} has no value ${value}`)
        this.events.push({ kind: 'setting', setting: name, from: current.value, to: value })
        // A new state each change, as the real service publishes, so readers holding the old one see the old value.
        const controls = { ...this.state.controls, [name]: { ...current, value } } as CameraState['controls']
        const settings = name === 'iso' || name === 'shutterSpeed' || name === 'aperture' ? { ...this.state.settings, [name]: value } : this.state.settings
        this.state = { ...this.state, controls, settings }
        return this.state
    }

    setIso(value: string): Promise<CameraState> {
        return this.setControl('iso', value)
    }

    setShutterSpeed(value: string): Promise<CameraState> {
        return this.setControl('shutterSpeed', value)
    }

    setAperture(value: string): Promise<CameraState> {
        return this.setControl('aperture', value)
    }

    async focus(): Promise<string> {
        this.events.push({ kind: 'focus' })
        return 'focused'
    }

    async focusAt(x: number, y: number): Promise<string> {
        this.events.push({ kind: 'focus', x, y })
        return 'focused'
    }

    async capture(_options: { autofocus: boolean }): Promise<{ filename: string; savedPath: string; sizeBytes: number }> {
        if (this.state.recording) throw new Error('The camera is recording')
        this.events.push({ kind: 'photo' })
        const filename = `DSC${String(this.photoNumber++).padStart(5, '0')}.JPG`
        this.files.push({ ...this.files[0], objectHandle: this.files.length + 1, filename, captureDate: new Date().toISOString() })
        return { filename, savedPath: `${this.state.downloadDir}/${filename}`, sizeBytes: 11_200_000 }
    }

    async startRecording(): Promise<CameraState> {
        this.events.push({ kind: 'recording', on: true })
        this.state.recording = true
        return this.state
    }

    async stopRecording(): Promise<CameraState> {
        if (this.state.recording) {
            const filename = `C${String(this.clipNumber++).padStart(4, '0')}.MP4`
            this.files.push({ ...this.files[1], objectHandle: this.files.length + 1, filename, captureDate: new Date().toISOString() })
        }
        this.events.push({ kind: 'recording', on: false })
        this.state.recording = false
        return this.state
    }

    async startLiveView(): Promise<CameraState> {
        this.events.push({ kind: 'liveView', on: true })
        this.state.liveView = true
        return this.state
    }

    async stopLiveView(): Promise<CameraState> {
        this.events.push({ kind: 'liveView', on: false })
        this.state.liveView = false
        return this.state
    }

    async zoomStart(direction: 'wide' | 'tele'): Promise<void> {
        this.zoomDirection = direction
    }

    async zoomStop(): Promise<void> {
        if (!this.zoomDirection) return
        this.events.push({ kind: 'zoom', direction: this.zoomDirection })
        const step = this.zoomDirection === 'tele' ? 3 : -3
        this.focalLengthMillimetres = Math.min(35, Math.max(16, this.focalLengthMillimetres + step))
        this.state.lens = { name: this.state.lens?.name ?? null, focalLengthMillimetres: this.focalLengthMillimetres }
        this.zoomDirection = null
    }

    async setOsdOverlay(on: boolean): Promise<CameraState> {
        this.events.push({ kind: 'overlay', on })
        this.state.osdOverlay = on
        return this.state
    }

    async listFiles(): Promise<FileEntry[]> {
        return this.files
    }

    async downloadFile(file: FileEntry): Promise<string> {
        this.events.push({ kind: 'download', filename: file.filename })
        return `${this.state.downloadDir}/${file.filename}`
    }

    async downloadAll(): Promise<string[]> {
        return Promise.all(this.files.map(file => this.downloadFile(file)))
    }
}

export const cameraService = new SimulatedCamera()
