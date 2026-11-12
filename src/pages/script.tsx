import script from '../../script/video-script.md?raw'

const [beforeKey] = script.split('## Answer key')
const setup = beforeKey.split('## Setup')[1]?.split('## Script')[0].trim() ?? ''
const lines = beforeKey
    .split('## Script')[1]
    ?.split('\n')
    .map(line => line.trim())
    .filter(line => /^\d+\.\s/.test(line) || /^\*—.*—\*$/.test(line)) ?? []

/** The script every model hears, turn by turn, with the take markers. */
export function Script() {
    return (
        <div className="typeset typeset-kevinschaich max-w-3xl">
            <h2>The script</h2>
            <p>{setup}</p>
            {lines.map(line =>
                line.startsWith('*') ? (
                    <h3 key={line}>{line.replace(/^\*—\s*|\s*—\*$/g, '')}</h3>
                ) : (
                    <p key={line}>{line}</p>
                )
            )}
            <p>
                The full answer key, turn by turn, is in <a href="https://github.com/darkgrade/toolbench/blob/main/script/video-script.md">the repository</a>.
            </p>
        </div>
    )
}
