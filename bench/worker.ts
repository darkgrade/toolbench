/**
 * The toolbench worker: serves the workflow's tasks on this Mac (its GPU) until stopped. In Outpost it
 * runs from Outpost's checkout (with darkgrade's beside it) and restarts on new commits; on its own it
 * starts a development engine.
 *
 *   bun run worker
 */
import { toolbench } from '@bench/workflow'

const { serve } = await toolbench()
console.log('toolbench worker: ready')
await serve('toolbench', { slots: 8 })
