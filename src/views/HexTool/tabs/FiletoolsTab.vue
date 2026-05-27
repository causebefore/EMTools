<script setup>
import { ref, computed, inject } from 'vue'
import {
  buildFillPreview,
  buildSlicePreview,
  convertFirmware,
  fillBuffer,
  parseFirmwareBytes,
  sliceBuffer,
} from '../../../utils/hex_filetools.js'

const copyText = inject('copyText', () => {})

// ===== 文件工具 =====
const convInputPath = ref('')
const convOutputFmt = ref('hex')
const convBaseAddr = ref('0x08000000')
const sliceInputPath = ref('')
const sliceFileSize = ref(0)
const sliceStart = ref('0x0')
const sliceEnd = ref('0x1000')
const sliceLength = ref('')
const fillInputPath = ref('')
const fillFileSize = ref(0)
const fillSize = ref('0x10000')
const fillValue = ref('0xFF')
const fillPos = ref('tail')

const slicePreview = computed(() => buildSlicePreview(sliceFileSize.value, {
  startText: sliceStart.value,
  endText: sliceEnd.value,
  lengthText: sliceLength.value,
}))

const fillPreview = computed(() => buildFillPreview(fillFileSize.value, {
  sizeText: fillSize.value,
  fillValueText: fillValue.value,
  position: fillPos.value,
}))

function formatSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatAddr(addr) {
  return '0x' + Number(addr || 0).toString(16).toUpperCase()
}

function formatRange(start, end) {
  return `${formatAddr(start)} - ${formatAddr(end)}`
}

function toHexText(value) {
  return '0x' + Number(value || 0).toString(16).toUpperCase()
}

// ===== 文件工具操作 =====
async function selectConvFile() {
  try {
    const r = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (r?.[0]) convInputPath.value = r[0]
  } catch (e) { console.error(e) }
}

async function selectSliceFile() {
  try {
    const r = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (r?.[0]) {
      sliceInputPath.value = r[0]
      const buf = await window.services.readFileBuffer(r[0])
      sliceFileSize.value = buf.length
      sliceEnd.value = toHexText(buf.length)
    }
  } catch (e) { console.error(e) }
}

async function selectFillFile() {
  try {
    const r = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (r?.[0]) {
      fillInputPath.value = r[0]
      const buf = await window.services.readFileBuffer(r[0])
      fillFileSize.value = buf.length
      fillSize.value = toHexText(buf.length)
    }
  } catch (e) { console.error(e) }
}

async function readFirmwareForConvert(path) {
  const buf = await window.services.readFileBuffer(path)
  return parseFirmwareBytes(buf, path)
}

async function doFileConvert() {
  if (!convInputPath.value) return
  const parsed = await readFirmwareForConvert(convInputPath.value)
  const converted = convertFirmware(parsed, {
    outputFmt: convOutputFmt.value,
    baseAddrText: convBaseAddr.value,
  })
  const path = await window.services.showSaveDialog({ defaultPath: `output.${converted.extension}` })
  if (path) await window.services.writeFile(path, converted.data)
}

async function doSlice() {
  if (!sliceInputPath.value) return
  const buf = await window.services.readFileBuffer(sliceInputPath.value)
  const sliced = sliceBuffer(buf, {
    startText: sliceStart.value,
    endText: sliceEnd.value,
    lengthText: sliceLength.value,
  })
  const path = await window.services.showSaveDialog({ defaultPath: 'slice.bin' })
  if (path) await window.services.writeFile(path, sliced)
}

async function doFill() {
  if (!fillInputPath.value) return
  const buf = await window.services.readFileBuffer(fillInputPath.value)
  const result = fillBuffer(buf, {
    sizeText: fillSize.value,
    fillValueText: fillValue.value,
    position: fillPos.value,
  })
  const path = await window.services.showSaveDialog({ defaultPath: 'filled.bin' })
  if (path) await window.services.writeFile(path, result)
}
</script>

<template>
  <div class="filetools-page">
    <div class="card filetool-card">
      <div class="filetool-head">
        <h4>格式转换</h4>
        <button class="btn btn-primary btn-sm" @click="doFileConvert" :disabled="!convInputPath">转换并保存</button>
      </div>
      <div class="form-row">
        <input :value="convInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary btn-sm" @click="selectConvFile">选择</button>
      </div>
      <div class="filetool-inline">
        <label>输出格式</label>
        <select v-model="convOutputFmt"><option value="hex">Intel HEX</option><option value="s19">Motorola S19</option><option value="bin">BIN</option></select>
        <label>基地址</label>
        <input v-model="convBaseAddr" placeholder="基地址" style="width:120px" />
      </div>
      <div class="convert-summary">
        <span>{{ convInputPath ? '已选择输入文件' : '等待选择输入文件' }}</span>
        <strong>{{ convOutputFmt.toUpperCase() }}</strong>
        <span class="mono">base {{ convBaseAddr }}</span>
      </div>
    </div>

    <div class="card filetool-card">
      <div class="filetool-head">
        <h4>文件切片</h4>
        <button class="btn btn-primary btn-sm" @click="doSlice" :disabled="!sliceInputPath">切片保存</button>
      </div>
      <div class="form-row">
        <input :value="sliceInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary btn-sm" @click="selectSliceFile">选择</button>
      </div>
      <div class="filetool-inline">
        <label>起始</label><input v-model="sliceStart" class="mono" style="width:100px" />
        <label>结束</label><input v-model="sliceEnd" class="mono" style="width:100px" />
        <label>长度</label><input v-model="sliceLength" class="mono" style="width:100px" placeholder="可选" />
      </div>
      <div class="range-preview" :class="{ empty: !sliceFileSize }">
        <div class="range-segment range-before" :style="{ width: slicePreview.selectionLeftPct + '%' }"></div>
        <div class="range-segment range-selected" :style="{ width: slicePreview.selectionWidthPct + '%' }"></div>
        <div class="range-segment range-after" :style="{ flex: 1 }"></div>
      </div>
      <div class="filetool-stats">
        <span>原始 {{ formatSize(slicePreview.totalSize) }}</span>
        <span class="mono">{{ formatRange(slicePreview.start, slicePreview.endInclusive) }}</span>
        <span>输出 {{ formatSize(slicePreview.outputSize) }}</span>
        <span>丢弃 {{ formatSize(slicePreview.beforeSize + slicePreview.afterSize) }}</span>
      </div>
    </div>

    <div class="card filetool-card">
      <div class="filetool-head">
        <h4>文件填充</h4>
        <button class="btn btn-primary btn-sm" @click="doFill" :disabled="!fillInputPath">填充保存</button>
      </div>
      <div class="form-row">
        <input :value="fillInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary btn-sm" @click="selectFillFile">选择</button>
      </div>
      <div class="filetool-inline">
        <label>目标大小</label><input v-model="fillSize" class="mono" style="width:100px" />
        <label>填充值</label><input v-model="fillValue" class="mono" style="width:70px" />
        <select v-model="fillPos"><option value="tail">末尾填充</option><option value="head">头部填充</option><option value="align">对齐到大小</option></select>
      </div>
      <div class="fill-preview" :class="{ truncate: fillPreview.truncated, empty: !fillFileSize }">
        <div v-for="(segment, segmentIdx) in fillPreview.segments" :key="segmentIdx"
          class="fill-segment"
          :class="segment.kind === 'fill' ? 'fill-area' : 'data-area'"
          :style="{ width: segment.widthPct + '%' }">
          <span v-if="segment.widthPct > 18">{{ segment.kind === 'fill' ? '填充' : '原文件' }}</span>
        </div>
      </div>
      <div class="filetool-stats">
        <span>原始 {{ formatSize(fillPreview.inputSize) }}</span>
        <span>目标 {{ formatSize(fillPreview.targetSize) }}</span>
        <span v-if="!fillPreview.truncated">填充 {{ formatSize(fillPreview.fillSize) }}</span>
        <span v-else class="danger">截断 {{ formatSize(fillPreview.truncatedSize) }}</span>
        <span class="mono">值 {{ formatAddr(fillPreview.fillValue) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filetools-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filetool-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filetool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filetool-head h4 {
  margin: 0;
}
.filetool-inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.filetool-inline label {
  color: var(--text-secondary);
  font-weight: 500;
}
.convert-summary,
.filetool-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  min-height: 26px;
  padding: 5px 8px;
  border-radius: var(--radius);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
}
.convert-summary strong {
  color: var(--accent);
  font-size: 13px;
}
.range-preview,
.fill-preview {
  display: flex;
  width: 100%;
  height: 30px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
}
.range-preview.empty,
.fill-preview.empty {
  opacity: 0.55;
}
.range-segment,
.fill-segment {
  height: 100%;
  min-width: 0;
}
.range-before,
.range-after {
  background: repeating-linear-gradient(
    -45deg,
    rgba(120, 120, 120, 0.14) 0,
    rgba(120, 120, 120, 0.14) 4px,
    transparent 4px,
    transparent 8px
  );
}
.range-selected {
  background: #1e88e5;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}
.fill-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
}
.data-area {
  background: #3498db;
}
.fill-area {
  color: var(--text-secondary);
  background: repeating-linear-gradient(
    -45deg,
    rgba(0, 150, 136, 0.2) 0,
    rgba(0, 150, 136, 0.2) 5px,
    rgba(0, 150, 136, 0.08) 5px,
    rgba(0, 150, 136, 0.08) 10px
  );
}
.fill-preview.truncate .data-area {
  background: #e67e22;
}
.danger {
  color: #e74c3c;
}
</style>
