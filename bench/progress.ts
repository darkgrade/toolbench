/**
 * Progress from one pass of bench/run.ts: each event is one line on stdout, `progress {json}`, which the
 * workflow's pass task reads and puts in its log (what the run page shows under the task). A pass is
 * stopped by cancelling its run, which ends the process.
 */
const emit = (event: Record<string, unknown>): void => console.log(`progress ${JSON.stringify({ at: Date.now(), ...event })}`)

export function startModel(id: string, steps: number, label = 'Loading the model'): void {
    emit({ model: id, lines: steps, note: label })
}

/** One step of the current model done (a turn), with how it went. */
export function stepDone(id: string, step: number, steps: number, label: string, outcome: { passed?: boolean; note?: string } = {}): void {
    emit({ model: id, line: step, lines: steps, note: `${label}${outcome.note ? ` · ${outcome.note}` : ''}`, passed: outcome.passed })
}

export function finishModel(id: string, result: Record<string, string | number>): void {
    emit({ model: id, note: Object.entries(result).map(([key, value]) => `${key} ${value}`).join(' · ') })
}

export function failModel(id: string, error: string): void {
    emit({ model: id, note: `failed: ${error}` })
}

export function stopModel(id: string): void {
    emit({ model: id, note: 'stopped' })
}

/** Stopping is cancelling the run, which ends this process; nothing to check between turns. */
export function stopRequested(): boolean {
    return false
}
