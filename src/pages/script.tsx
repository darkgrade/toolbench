import { Prose } from '@site/pages/method'
import script from '../../script/video-script.md?raw'

const [beforeKey] = script.split('## Answer key')
const setup = beforeKey.split('## Setup')[1]?.split('## Script')[0].trim() ?? ''

/** The script's stretches, each with its stage direction and its numbered turns. */
const stretches: { direction: string; turns: { number: number; said: string }[] }[] = []
for (const line of (beforeKey.split('## Script')[1] ?? '').split('\n').map(text => text.trim())) {
    if (/^\*—.*—\*$/.test(line)) stretches.push({ direction: line.replace(/^\*—\s*|\s*—\*$/g, ''), turns: [] })
    const turn = /^(\d+)\.\s+(.*)$/.exec(line)
    if (turn && stretches.length) stretches[stretches.length - 1].turns.push({ number: Number(turn[1]), said: turn[2] })
}

/** The script every model hears, turn by turn, with the take markers. */
export function Script() {
    return (
        <>
            <h2 id="script">The script</h2>
            <Prose text={setup} />
            {stretches.map(stretch => (
                <section key={stretch.direction}>
                    <h3>{stretch.direction}</h3>
                    <ol start={stretch.turns[0]?.number}>
                        {stretch.turns.map(turn => (
                            <li key={turn.number}>{turn.said}</li>
                        ))}
                    </ol>
                </section>
            ))}
            <p>
                The full answer key, turn by turn, is in <a href="https://github.com/darkgrade/toolbench/blob/main/script/video-script.md">the repository</a>.
            </p>
        </>
    )
}
