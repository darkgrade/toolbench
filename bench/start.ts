/**
 * Starts a toolbench run on the worker and prints its id. In Outpost, start runs from the app instead.
 *
 *   bun run bench [-- --models id,id] [--force]
 */
import { toolbench } from '@bench/workflow'

const listed = process.argv.includes('--models') ? process.argv[process.argv.indexOf('--models') + 1].split(',') : undefined
const { start } = await toolbench()
console.log(await start('toolbench', { ...(listed ? { models: listed } : {}), force: process.argv.includes('--force') }, { label: 'Toolbench' }))
process.exit(0)
