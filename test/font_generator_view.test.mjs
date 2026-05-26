import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const viewPath = new URL('../src/views/FontGenerator/index.vue', import.meta.url)

test('font generator output directory button lets users choose a folder', async () => {
  const source = await readFile(viewPath, 'utf-8')

  assert.match(source, /async function pickOutputDir\(\)/)
  assert.match(source, /window\.services\.showOpenDialog\(\{ properties: \['openDirectory'\] \}\)/)
  assert.match(source, /@click="pickOutputDir">选择目录<\/button>/)
  assert.doesNotMatch(source, /@click="useDownloadsDir">使用下载目录<\/button>/)
})

test('font generator exposes rendering controls and passes them to bitmap generation', async () => {
  const source = await readFile(viewPath, 'utf-8')

  assert.match(source, /const fontFamily = ref\('SimSun'\)/)
  assert.match(source, /const xOffset = ref\(0\)/)
  assert.match(source, /const yOffset = ref\(0\)/)
  assert.match(source, /const threshold = ref\(128\)/)
  assert.match(source, /const isBold = ref\(false\)/)
  assert.match(source, /fontFamily: fontFamily\.value/)
  assert.match(source, /xOffset: xOffset\.value/)
  assert.match(source, /yOffset: yOffset\.value/)
  assert.match(source, /threshold: threshold\.value/)
  assert.match(source, /bold: isBold\.value/)
  assert.match(source, /FONT_FAMILIES/)
  assert.match(source, /<option v-for="f in FONT_FAMILIES" :key="f\.value" :value="f\.value">\{\{ f\.name \}\}<\/option>/)
  assert.match(source, /v-model\.number="xOffset"/)
  assert.match(source, /v-model\.number="yOffset"/)
  assert.match(source, /v-model\.number="threshold"/)
  assert.match(source, /v-model="isBold"/)
})

test('font generator draws the preview when the view mounts', async () => {
  const source = await readFile(viewPath, 'utf-8')

  assert.match(source, /import \{ ref, watch, nextTick, computed, inject, onMounted \} from 'vue'/)
  assert.match(source, /onMounted\(\(\) => nextTick\(drawPreview\)\)/)
})

test('font generator uses scoped layout classes to keep controls inside the sidebar', async () => {
  const source = await readFile(viewPath, 'utf-8')

  assert.match(source, /class="font-gen-layout"/)
  assert.match(source, /class="font-sidebar"/)
  assert.match(source, /class="setting-row"/)
  assert.match(source, /class="size-buttons"/)
  assert.match(source, /class="offset-grid"/)
  assert.match(source, /class="threshold-controls"/)
  assert.match(source, /\.font-sidebar\s+\{/)
  assert.match(source, /\.size-buttons\s+\{/)
  assert.match(source, /\.preview-canvas\s+\{/)
})
