import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/** Served at darkgrade.com/toolbench/ (proxied to this project's Vercel deployment), so everything lives under it. */
/** Serves results/raw/progress.json to the dev-only /progress page while a run writes it. */
function liveProgress(): Plugin {
    const path = fileURLToPath(new URL('./results/raw/progress.json', import.meta.url))
    return {
        name: 'live-progress',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/toolbench/progress.json', (_request, response) => {
                response.setHeader('content-type', 'application/json')
                response.setHeader('cache-control', 'no-store')
                response.end(existsSync(path) ? readFileSync(path) : 'null')
            })
        },
    }
}

export default defineConfig({
    base: '/toolbench/',
    plugins: [react(), tailwindcss(), liveProgress()],
    build: { outDir: 'dist/toolbench', emptyOutDir: true },
    resolve: {
        // One React, even when @kevinschaich/components is linked from a local checkout.
        dedupe: ['react', 'react-dom'],
        alias: {
            '@site': fileURLToPath(new URL('./src', import.meta.url)),
            '@results': fileURLToPath(new URL('./results', import.meta.url)),
            '@bench': fileURLToPath(new URL('./bench', import.meta.url)),
        },
    },
})
