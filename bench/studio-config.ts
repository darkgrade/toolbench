/**
 * The benchmark runs Darkgrade Studio's real tool code. Studio's tools import Studio's camera service and
 * Electron; this writes a TypeScript config that points those two imports at this repo's simulated camera
 * and Electron stand-in, and everything else at the darkgrade checkout (DARKGRADE_PATH, by default
 * ../darkgrade, which Outpost keeps beside this one). bench/run.ts runs with it.
 *
 *   bun run typecheck:bench     type-check the harness against Studio's code
 */
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '..')
export const DARKGRADE = resolve(process.env.DARKGRADE_PATH ?? join(ROOT, '..', 'darkgrade'))
export const STUDIO_CONFIG = join(ROOT, '.darkgrade-tsconfig.json')

/** Writes the config; fails with a clear message when there's no Studio checkout (or its packages aren't installed). */
export function writeStudioConfig(): string {
    const studio = join(DARKGRADE, 'apps', 'studio', 'src')
    if (!existsSync(join(studio, 'main', 'tools', 'studio-tools.ts'))) throw new Error(`No Darkgrade Studio checkout at ${DARKGRADE}: set DARKGRADE_PATH to one`)
    if (!existsSync(join(DARKGRADE, 'apps', 'studio', 'node_modules', 'zod')) && !existsSync(join(DARKGRADE, 'node_modules', 'zod'))) {
        const installed = spawnSync('bun', ['install'], { cwd: DARKGRADE, stdio: 'inherit' })
        if (installed.status !== 0) throw new Error(`bun install failed in ${DARKGRADE}`)
    }
    const zod = existsSync(join(DARKGRADE, 'apps', 'studio', 'node_modules', 'zod')) ? join(DARKGRADE, 'apps', 'studio', 'node_modules', 'zod', 'v4') : join(DARKGRADE, 'node_modules', 'zod', 'v4')
    writeFileSync(
        STUDIO_CONFIG,
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2023',
                    module: 'ESNext',
                    moduleResolution: 'bundler',
                    strict: true,
                    skipLibCheck: true,
                    noEmit: true,
                    types: ['node', 'bun'],
                    paths: {
                        electron: [join(ROOT, 'bench', 'electron-stand-in.ts')],
                        '@main/camera-service': [join(ROOT, 'bench', 'simulated-camera.ts')],
                        '@main/*': [join(studio, 'main', '*')],
                        '@shared/*': [join(studio, 'shared', '*')],
                        '@bench/*': [join(ROOT, 'bench', '*')],
                        // One copy of zod, Studio's, so schemas built by its tools convert with the same library.
                        'zod/v4': [zod],
                    },
                },
                include: [join(ROOT, 'bench', 'run.ts'), join(ROOT, 'bench', 'answer-key.ts'), join(ROOT, 'bench', 'simulated-camera.ts')],
            },
            null,
            4
        )
    )
    return STUDIO_CONFIG
}

if (import.meta.main) process.exit(spawnSync('npx', ['tsc', '-p', writeStudioConfig()], { cwd: ROOT, stdio: 'inherit' }).status ?? 1)
