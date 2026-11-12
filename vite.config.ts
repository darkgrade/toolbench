import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/** Served at darkgrade.com/toolbench/ (proxied to this project's Vercel deployment), so everything lives under it. */
export default defineConfig({
    base: '/toolbench/',
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist/toolbench', emptyOutDir: true },
    resolve: {
        alias: {
            '@site': fileURLToPath(new URL('./src', import.meta.url)),
            '@results': fileURLToPath(new URL('./results', import.meta.url)),
        },
    },
})
