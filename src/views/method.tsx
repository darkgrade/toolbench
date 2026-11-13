/** Method: how the results were made and the script every model hears, set as an article with its contents beside it. */
import { BENCH, RUN } from '@site/data'
import { TYPE } from '@site/kit/theme'
import { Method, METHOD_SECTIONS } from '@site/pages/method'
import { Script } from '@site/pages/script'
import { useEffect } from 'react'

const CONTENTS = [{ id: 'method', heading: 'How we test' }, ...METHOD_SECTIONS, { id: 'dropped', heading: 'Models we dropped' }, { id: 'repeat', heading: 'Repeat it' }, { id: 'script', heading: 'The script' }]

export function MethodView({ path }: { path: string }) {
    // The script had its own address before it joined this page; that address opens it here.
    useEffect(() => {
        if (path.replace(BENCH.path, '').replace(/\/$/, '') === 'script') document.getElementById('script')?.scrollIntoView()
    }, [path])
    const hardware = RUN.hardware
    return (
        <div className="h-full overflow-y-auto scroll-smooth">
            <div className="mx-auto grid max-w-5xl gap-x-16 gap-y-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,37em)_1fr]">
                <article className="typeset typeset-kevinschaich">
                    <Method />
                    <Script />
                </article>
                <aside className="row-start-1 flex flex-col gap-6 text-sm lg:sticky lg:top-8 lg:col-start-2 lg:self-start">
                    {hardware && (
                        <div className="flex flex-col gap-1">
                            <p className={TYPE.label}>Tested on</p>
                            <p>
                                {hardware.chip}, {hardware.memoryGigabytes} GB
                            </p>
                            <p className="text-muted-foreground">macOS {hardware.macOS}</p>
                            {RUN.date && <p className="text-muted-foreground">{new Date(RUN.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>}
                        </div>
                    )}
                    <nav className="hidden flex-col gap-1.5 lg:flex" aria-label="On this page">
                        <p className={TYPE.label}>On this page</p>
                        {CONTENTS.map(item => (
                            <a key={item.id} href={`#${item.id}`} className="text-muted-foreground hover:text-foreground">
                                {item.heading}
                            </a>
                        ))}
                    </nav>
                </aside>
            </div>
        </div>
    )
}
