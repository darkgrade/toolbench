/** The script's turns, read from script/video-script.md: everything said up to each pause, word for word. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const SCRIPT_PATH = resolve(import.meta.dirname, '..', 'script', 'video-script.md')

export function scriptTurns(): { turn: number; text: string }[] {
    const script = readFileSync(SCRIPT_PATH, 'utf8').split('## Answer key')[0]
    return [...script.matchAll(/^(\d+)\.\s+"(.*)"\s*$/gm)].map(match => ({ turn: Number(match[1]), text: match[2] }))
}
