/**
 * The part of Electron Studio's tools touch (nativeImage, app), done with ffmpeg so the tools run
 * outside the app. Pictures are decoded to BGRA like Electron's toBitmap().
 */
import { execFileSync } from 'node:child_process'

interface Size {
    width: number
    height: number
}

function probeSize(jpeg: Buffer): Size {
    const output = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', '-i', 'pipe:0'], { input: jpeg })
    const [width, height] = output.toString().trim().split(',').map(Number)
    return { width, height }
}

class StandInImage {
    constructor(
        private readonly jpeg: Buffer,
        private readonly size: Size
    ) {}

    getSize(): Size {
        return this.size
    }

    resize(options: { width: number; quality?: string }): StandInImage {
        const height = Math.round((this.size.height * options.width) / this.size.width)
        const resized = execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `scale=${options.width}:${height}`, '-f', 'mjpeg', 'pipe:1'], { input: this.jpeg })
        return new StandInImage(resized, { width: options.width, height })
    }

    toBitmap(): Buffer {
        return execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'bgra', 'pipe:1'], { input: this.jpeg, maxBuffer: 1 << 28 })
    }

    toJPEG(_quality: number): Buffer {
        return this.jpeg
    }
}

export const nativeImage = {
    createFromBuffer(buffer: Buffer): StandInImage {
        return new StandInImage(buffer, probeSize(buffer))
    },
}

export const app = { isPackaged: false, getAppPath: () => process.cwd(), getPath: () => process.cwd() }
