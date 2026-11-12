import { Card, CardContent, CardHeader, CardTitle, CodeBlock, CodeBlockContent } from '@kevinschaich/components'
import { BENCH, RUN, sampleSentence } from '@site/data'

const HEADINGS: Record<string, string> = {
    settings: 'Settings',
    input: 'What each model hears',
    tools: 'The tools',
    accuracy: 'Right or wrong',
    latency: 'Speed',
    score: 'The score',
    isolation: 'One model at a time',
    runs: 'Runs',
}

/** How the results were made, from the method recorded in the results file, and how to repeat it. */
export function Method() {
    const hardware = RUN.hardware
    return (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="typeset typeset-kevinschaich">
                <h2>How we test</h2>
                <p>
                    Every model hears the same script: a creator filming a video, with requests to Darkgrade Studio, their camera app, in between and during takes. Each model
                    runs on one Mac, one at a time, with its default settings, and uses Studio's real tools on a simulated camera. Each turn is checked: did it do the right
                    thing, leave the video alone, answer questions without acting, and say what it can't do?
                </p>
                <p>{sampleSentence()}</p>
                {Object.entries(RUN.method ?? {}).map(([key, text]) => (
                    <section key={key}>
                        <h3>{HEADINGS[key] ?? key}</h3>
                        <p>{text}</p>
                    </section>
                ))}
                <h3>Repeat it</h3>
                <p>
                    Everything is in <a href={`https://github.com/${BENCH.repository}`}>the repository</a>: the script, each recording's checksum, every model's source and file
                    checksum, and the exact engine versions. On an Apple Silicon Mac:
                </p>
                <div className="not-typeset">
                    <CodeBlock>
                        <CodeBlockContent>{`git clone https://github.com/${BENCH.repository}\ngit clone https://github.com/darkgrade/darkgrade\ncd toolbench\nbun install\nbun run bench`}</CodeBlockContent>
                    </CodeBlock>
                </div>
            </div>
            <div className="flex flex-col gap-4">
                {hardware && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hardware</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            {hardware.chip}, {hardware.memoryGigabytes} GB, macOS {hardware.macOS}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
