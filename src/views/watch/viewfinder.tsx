/**
 * A drawn viewfinder: the creator at their desk, as the script's setup describes, with the camera's
 * settings and Studio's scopes laid over it. The picture gets brighter, warmer or wider as the
 * look says, and shows recording, focus, photos and live view going off.
 */
import { INK, TONE } from '@site/kit/theme'
import { type Look, brightnessStops } from '@site/views/watch/look'

const RECORDING = 'oklch(0.63 0.24 27)'
const PEAKING = 'oklch(0.7 0.25 20)'

function Scope({ kind }: { kind: string }) {
    if (kind === 'waveform')
        return (
            <svg viewBox="0 0 64 36" className="h-full w-full">
                {Array.from({ length: 32 }, (_, column) => {
                    const middle = 20 - Math.sin(column / 5) * 6 - (column > 22 ? 6 : 0)
                    return <rect key={column} x={column * 2} y={middle - 5} width={1.2} height={10 + (column % 3) * 2} fill="oklch(0.85 0.17 150 / 0.8)" />
                })}
            </svg>
        )
    return (
        <svg viewBox="0 0 64 36" className="h-full w-full">
            <path d="M0 36 L0 30 C8 28 12 10 20 12 C28 14 30 24 38 22 C46 20 50 30 64 33 L64 36 Z" fill="oklch(1 0 0 / 0.75)" />
        </svg>
    )
}

export function Viewfinder({ look, flash }: { look: Look; flash: boolean }) {
    const brightness = Math.pow(2, brightnessStops(look) * 0.55)
    const warmth = Math.max(-1, Math.min(1, (look.kelvin - 5600) / 1500))
    const zoom = look.focalLengthMillimetres / 24
    const movie = /movie/i.test(look.mode)
    const changed = (name: string): string => (look.changed.has(name) ? 'text-[oklch(0.85_0.12_85)]' : '')
    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black ring-1 ring-white/10" style={{ containerType: 'inline-size' }}>
            {look.liveView ? (
                <svg viewBox="0 0 320 180" className="absolute inset-0 size-full" style={{ filter: `brightness(${brightness.toFixed(3)})`, transition: 'filter 0.6s' }} aria-hidden>
                    <defs>
                        <linearGradient id="wall" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0" stopColor="oklch(0.34 0.02 250)" />
                            <stop offset="1" stopColor="oklch(0.22 0.02 260)" />
                        </linearGradient>
                        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
                            <stop offset="0" stopColor="oklch(0.97 0.05 90)" />
                            <stop offset="0.35" stopColor="oklch(0.85 0.09 85 / 0.7)" />
                            <stop offset="1" stopColor="oklch(0.8 0.08 85 / 0)" />
                        </radialGradient>
                        <pattern id="zebra" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="2.2" height="5" fill="oklch(0.15 0 0 / 0.85)" />
                        </pattern>
                    </defs>
                    <g style={{ transform: `scale(${zoom.toFixed(3)})`, transformOrigin: '160px 96px', transition: 'transform 0.9s ease-in-out' }}>
                        <rect x="-80" y="-60" width="480" height="300" fill="url(#wall)" />
                        <rect x="34" y="34" width="62" height="8" rx="2" fill="oklch(0.2 0.02 260)" />
                        <rect x="40" y="18" width="7" height="16" fill="oklch(0.45 0.08 30)" />
                        <rect x="49" y="14" width="6" height="20" fill="oklch(0.5 0.07 150)" />
                        <rect x="57" y="20" width="9" height="14" fill="oklch(0.55 0.06 80)" />
                        <circle cx="262" cy="48" r="44" fill="url(#lamp)" />
                        <circle cx="262" cy="48" r="9" fill="oklch(0.99 0.02 95)" />
                        {look.zebras && <circle cx="262" cy="48" r="13" fill="url(#zebra)" />}
                        <path d="M118 180 C118 132 136 118 160 118 C184 118 202 132 202 180 Z" fill="oklch(0.42 0.05 255)" stroke={look.focusPeaking ? PEAKING : 'none'} strokeWidth="1.2" />
                        <rect x="151" y="100" width="18" height="22" rx="7" fill="oklch(0.62 0.06 55)" />
                        <ellipse cx="160" cy="80" rx="21" ry="25" fill="oklch(0.68 0.07 55)" stroke={look.focusPeaking ? PEAKING : 'none'} strokeWidth="1.2" />
                        <path d="M139 76 C139 52 181 52 181 76 C174 64 146 64 139 76 Z" fill="oklch(0.28 0.03 50)" />
                        <rect x="-80" y="156" width="480" height="90" fill="oklch(0.27 0.03 55)" stroke={look.focusPeaking ? PEAKING : 'none'} strokeWidth="0.8" />
                        <rect x="214" y="144" width="30" height="14" rx="2" fill="oklch(0.2 0.01 260)" />
                    </g>
                    <rect width="320" height="180" fill={warmth >= 0 ? 'oklch(0.75 0.16 70)' : 'oklch(0.7 0.14 250)'} opacity={Math.abs(warmth) * 0.4} style={{ mixBlendMode: 'soft-light', transition: 'opacity 0.6s' }} />
                    {look.focus && (
                        <rect key={`${look.focus.x}-${look.focus.y}`} x={look.focus.x * 320 - 16} y={look.focus.y * 180 - 16} width="32" height="32" fill="none" stroke="oklch(0.85 0.2 145)" strokeWidth="1.4" className="ks-focus" />
                    )}
                </svg>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[3.2cqw] text-muted-foreground">Live view off</div>
            )}
            {flash && <div className="ks-flash absolute inset-0 bg-white" />}
            <div className="absolute inset-0 flex flex-col justify-between p-[2.6cqw] font-mono text-[3cqw] leading-none text-white/90">
                <div className="flex items-start justify-between">
                    <span className={`flex items-center gap-[1.2cqw] rounded-sm px-[1.4cqw] py-[1cqw] ${look.recording ? 'bg-black/50' : 'bg-black/35 text-white/60'}`}>
                        <span className={`size-[2cqw] rounded-full ${look.recording ? 'animate-pulse' : ''}`} style={{ background: look.recording ? RECORDING : INK.axis }} />
                        {look.recording ? 'REC' : 'STBY'}
                    </span>
                    <span className={`rounded-sm bg-black/35 px-[1.4cqw] py-[1cqw] ${changed('exposureProgram')}`}>{movie ? 'MOVIE' : 'PHOTO'} · M</span>
                </div>
                <div className="flex items-end justify-between gap-[2cqw]">
                    {look.cameraDisplay ? (
                        <span className="flex flex-wrap gap-x-[2.4cqw] gap-y-[1cqw] rounded-sm bg-black/45 px-[1.6cqw] py-[1.2cqw]">
                            <span className={changed('shutterSpeed')}>{look.shutterSpeed}</span>
                            <span className={changed('aperture')}>{look.aperture}</span>
                            <span className={changed('iso')}>ISO {look.iso}</span>
                            <span className={changed('colorTemperature')}>{look.kelvin}K</span>
                            {look.exposureStops !== 0 && <span style={{ color: TONE.fair }}>{`${look.exposureStops > 0 ? '+' : '−'}${Math.abs(look.exposureStops).toFixed(2).replace(/0$/, '')} EV`}</span>}
                        </span>
                    ) : (
                        <span />
                    )}
                    {look.liveView && (look.scope === 'waveform' || look.scope === 'histogram') && (
                        <span className={`block h-[11cqw] w-[19cqw] rounded-sm bg-black/55 p-[0.8cqw] ${look.changed.has('view') ? 'ring-1 ring-[oklch(0.85_0.12_85)]' : ''}`}>
                            <Scope kind={look.scope} />
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
