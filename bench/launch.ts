/**
 * Runs the benchmark against Darkgrade Studio's real tool code. Studio's tools import Studio's camera
 * service and Electron; this writes a TypeScript config that points those two imports at this repo's
 * simulated camera and Electron stand-in, and everything else at the darkgrade checkout
 * (DARKGRADE_PATH, by default ../darkgrade), then starts bench/run.ts with it.
 *
 *   bun run bench [-- --models id,id]
 */
import { TEXT_MODELS } from '@bench/models'
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const darkgrade = resolve(process.env.DARKGRADE_PATH ?? join(root, '..', 'darkgrade'))
const studio = join(darkgrade, 'apps', 'studio', 'src')
if (!existsSync(join(studio, 'main', 'tools', 'studio-tools.ts'))) {
    console.error(`No Darkgrade Studio checkout at ${darkgrade}. Set DARKGRADE_PATH to it.`)
    process.exit(2)
}
const config = join(root, '.darkgrade-tsconfig.json')
writeFileSync(
    config,
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
                    electron: [join(root, 'bench', 'electron-stand-in.ts')],
                    '@main/camera-service': [join(root, 'bench', 'simulated-camera.ts')],
                    '@main/*': [join(studio, 'main', '*')],
                    '@shared/*': [join(studio, 'shared', '*')],
                    '@bench/*': [join(root, 'bench', '*')],
                    // One copy of zod, Studio's, so schemas built by its tools convert with the same library.
                    'zod/v4': [join(darkgrade, 'apps', 'studio', 'node_modules', 'zod', 'v4')],
                },
            },
            include: [join(root, 'bench', '**', '*.ts')],
        },
        null,
        4
    )
)
if (process.argv.includes('--typecheck')) process.exit(spawnSync('npx', ['tsc', '-p', config], { cwd: root, stdio: 'inherit' }).status ?? 1)

const run = (...argumentsGiven: string[]): number =>
    spawnSync('bun', ['--tsconfig-override', config, join(root, 'bench', 'run.ts'), ...argumentsGiven], { cwd: root, stdio: 'inherit', env: { ...process.env, DARKGRADE_PATH: darkgrade } }).status ?? 1

// Studio's tools keep their undo history in memory, so each model gets a fresh process.
if (run('--perfect') !== 0) process.exit(1)
const listed = process.argv.includes('--models') ? process.argv[process.argv.indexOf('--models') + 1].split(',') : null
for (const model of TEXT_MODELS.filter(candidate => !listed || listed.includes(candidate.id))) {
    if (run('--models', model.id) !== 0) process.exit(1)
}
