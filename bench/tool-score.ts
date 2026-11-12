/**
 * Toolbench's 0–100 score: how often a model does exactly the right thing, how cleanly it calls tools,
 * and how long it takes to act. Fixed scales, so a score doesn't change when other models are added.
 */
import { type Area, type Score, linear, logScale, scoreWith } from '@bench/rubric'

export interface ToolMeasurements {
    /** Share of turn credit earned, 0–1 (a turn is 1 right, ½ with only minor mistakes, 0 with a serious one). */
    turnsPassed?: number
    /** Share of turns with a serious mistake, 0–1. */
    seriousShare?: number
    /** Share of tool calls that were invalid (unknown tool, bad arguments), 0–1. */
    invalidCallShare?: number
    decisionMedianMs?: number | null
    decisionP90Ms?: number | null
}

const percent = (value: number): string => `${Math.round(value * 100)}%`
const seconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)} s`

export const TOOL_AREAS: Area<ToolMeasurements>[] = [
    // Half the turns' credit scores 0, all of it 100.
    { area: 'Right outcome', weight: 45, score: ({ turnsPassed }) => (turnsPassed === undefined ? null : { value: linear(turnsPassed, 0.5, 1), why: `${percent(turnsPassed)} of turns right` }) },
    // A serious mistake (a ruined take, an unasked photo or download …) on a quarter of turns scores 0, none 100.
    { area: 'Serious mistakes', weight: 15, score: ({ seriousShare }) => (seriousShare === undefined ? null : { value: linear(seriousShare, 0.25, 0), why: `serious mistakes on ${percent(seriousShare)} of turns` }) },
    // One call in five invalid scores 0, none 100.
    { area: 'Clean tool calls', weight: 5, score: ({ invalidCallShare }) => (invalidCallShare === undefined ? null : { value: linear(invalidCallShare, 0.2, 0), why: `${percent(invalidCallShare)} of calls invalid` }) },
    // From the end of a turn to the model's decision: 10 s scores 0, 0.3 s scores 100.
    { area: 'Typical wait', weight: 25, score: ({ decisionMedianMs }) => (decisionMedianMs == null ? null : { value: logScale(Math.max(decisionMedianMs, 1), 10_000, 300), why: `${seconds(decisionMedianMs)} typical wait` }) },
    // The slowest 1 in 10: 10 s (the limit) scores 0, 1 s scores 100.
    { area: 'Slow wait', weight: 10, score: ({ decisionP90Ms }) => (decisionP90Ms == null ? null : { value: logScale(Math.max(decisionP90Ms, 1), 10_000, 1000), why: `${seconds(decisionP90Ms)} for the slowest 1 in 10` }) },
]

export function toolScore(measurements: ToolMeasurements): Score {
    return scoreWith(TOOL_AREAS, measurements)
}
