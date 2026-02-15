import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/WayMe/' : '/',
  plugins: [svelte()],
  build: {
    target: 'esnext',
    minify: 'terser'
  }
})
