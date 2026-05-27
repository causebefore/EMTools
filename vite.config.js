import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { emptyOutDir: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  }
})
