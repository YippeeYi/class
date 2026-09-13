import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { protectedPaths } from './src/lib/app-route.ts'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'class'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${repositoryName}/` : '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'static-route-entries',
      enforce: 'post',
      generateBundle(_options, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset') throw new Error('Missing application HTML')
        // Each known BrowserRouter path gets the same empty application shell.
        // Pages resolves /class/qb to /class/qb/ without a 404 response.
        for (const route of [...protectedPaths, '/auth', '/404']) {
          if (route === '/') continue
          this.emitFile({
            type: 'asset',
            fileName: `${route.slice(1)}/index.html`,
            source: index.source,
          })
        }
        this.emitFile({ type: 'asset', fileName: '404.html', source: index.source })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
})
