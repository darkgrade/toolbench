/**
 * The toolbench worker: serves the workflow's tasks on this Mac (its GPU) until stopped. Outpost runs it
 * from its own copy of this repository (with darkgrade's beside it) and restarts it on new commits; on its own it
 * starts a development engine.
 *
 *   bun run worker
 */
import { toolbench } from '@bench/workflow'

const { serve } = await toolbench()
console.log('toolbench worker: ready')
await serve('toolbench', { slots: 8 })
