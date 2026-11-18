/**
 * Starts a toolbench run on the worker and prints its id. In Outpost, start runs from the app (Run workflow) instead.
 *
 *   bun run bench [-- --models id,id] [--cloud] [--force]   (--cloud adds the 12 cloud models, off by default)
 */
import { toolbench } from '@bench/workflow'

const listed = process.argv.includes('--models') ? process.argv[process.argv.indexOf('--models') + 1].split(',') : undefined
const { start } = await toolbench()
console.log(await start('toolbench', { ...(listed ? { models: listed } : {}), force: process.argv.includes('--force'), cloud: process.argv.includes('--cloud') }, { label: 'Toolbench' }))
process.exit(0)
