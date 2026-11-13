import { CodeBlock, CodeBlockContent } from '@kevinschaich/components'
import { BENCH, MODELS, RUN, sampleSentence } from '@site/data'

export const METHOD_SECTIONS: { id: string; heading: string }[] = [
    { id: 'input', heading: 'What each model hears' },
    { id: 'tools', heading: 'The tools' },
    { id: 'settings', heading: 'Settings' },
    { id: 'accuracy', heading: 'Right or wrong' },
    { id: 'latency', heading: 'Speed' },
    { id: 'timeLimit', heading: 'Time limit' },
    { id: 'score', heading: 'The score' },
    { id: 'runs', heading: 'Runs' },
    { id: 'isolation', heading: 'One model at a time' },
]

/** Text from the results file, with `code` in backticks set as code. */
export function Prose({ text }: { text: string }) {
    return <p>{text.split('`').map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part))}</p>
}

/** How the results were made, from the method recorded in the results file, and how to repeat it. */
export function Method() {
    const method = RUN.method ?? {}
    const areas = MODELS[0]?.reasons ?? []
    return (
        <>
            <h2 id="method">How we test</h2>
            <p>
                Every model hears the same script: a creator filming a video, with requests to Darkgrade Studio, their camera app, in between and during takes. Each model runs on one Mac, one
                at a time, with its default settings, and uses Studio's real tools on a simulated camera. Each turn is checked: did it do the right thing, leave the video alone, answer
                questions without acting, and say what it can't do?
            </p>
            <p>{sampleSentence()}</p>
            {METHOD_SECTIONS.filter(section => method[section.id]).map(section => (
                <section key={section.id}>
                    <h3 id={section.id}>{section.heading}</h3>
                    <Prose text={method[section.id]} />
                    {section.id === 'score' && areas.length > 0 && (
                        <table>
                            <thead>
                                <tr>
                                    <th>Area</th>
                                    <th>Counts for</th>
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map(area => (
                                    <tr key={area.area}>
                                        <td>{area.area}</td>
                                        <td>{area.weight}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            ))}
            {RUN.dropped && RUN.dropped.length > 0 && (
                <section>
                    <h3 id="dropped">Models we dropped</h3>
                    <ul>
                        {RUN.dropped.map(model => (
                            <li key={model.name}>
                                <strong>{model.name}</strong>: {model.why}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <section>
                <h3 id="repeat">Repeat it</h3>
                <p>
                    Everything is in <a href={`https://github.com/${BENCH.repository}`}>the repository</a>: the script, each recording's checksum, every model's source and file checksum, and
                    the exact engine versions. On an Apple Silicon Mac:
                </p>
                <div className="not-typeset">
                    <CodeBlock>
                        <CodeBlockContent>{`git clone https://github.com/${BENCH.repository}\ngit clone https://github.com/darkgrade/darkgrade\ncd toolbench\nbun install\nbun run bench`}</CodeBlockContent>
                    </CodeBlock>
                </div>
            </section>
        </>
    )
}
