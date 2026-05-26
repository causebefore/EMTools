<script setup>
import { ref, inject } from 'vue'
import HexViewer from '../../components/HexViewer.vue'
import {
  searchHex, searchAscii
} from '../../utils/hextools.js'
import {
  convertFirmware,
  fillBuffer,
  mergeFirmwareSegments,
  parseFirmwareBytes,
  parseNumericText,
  replaceByte,
  sliceBuffer,
} from '../../utils/hex_filetools.js'

const copyText = inject('copyText', () => {})

const activeTab = ref('editor')

// ===== Hex编辑器 =====
const filePath = ref('')
const fileData = ref(new Uint8Array(0))
const fileBaseAddr = ref(0)
const fileFormat = ref('bin')
const hexViewer = ref(null)
const searchPattern = ref('')
const searchType = ref('hex')
const searchResults = ref([])
const currentSearchIdx = ref(-1)
const gotoAddr = ref('')
// ===== 文件工具 =====
const convInputPath = ref('')
const convOutputFmt = ref('hex')
const convBaseAddr = ref('0x08000000')
const sliceInputPath = ref('')
const sliceStart = ref('0x0')
const sliceEnd = ref('0x1000')
const sliceLength = ref('')
const fillInputPath = ref('')
const fillSize = ref('0x10000')
const fillValue = ref('0xFF')
const fillPos = ref('tail')
const mergeFiles = ref([])
const mergeMode = ref('address')
const mergeOutputFmt = ref('bin')
const mergeFillVal = ref('0xFF')

// ===== 编辑器操作 =====
async function openFile() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (!result?.[0]) return
    filePath.value = result[0]

    const buf = await window.services.readFileBuffer(result[0])
    const parsed = parseFirmwareBytes(buf, result[0])
    fileData.value = parsed.data
    fileBaseAddr.value = parsed.baseAddr
    fileFormat.value = formatFromPath(result[0])
    searchResults.value = []
    currentSearchIdx.value = -1
  } catch (e) { console.error(e) }
}

async function saveFile() {
  if (!fileData.value.length) return
  const path = await window.services.showSaveDialog({ defaultPath: filePath.value || 'output.bin' })
  if (!path) return
  const fmt = formatFromPath(path) || fileFormat.value || 'bin'
  const converted = convertFirmware(
    { baseAddr: fileBaseAddr.value, data: fileData.value },
    { outputFmt: fmt, baseAddrText: toHexText(fileBaseAddr.value) },
  )
  await window.services.writeFile(path, converted.data)
}

function doSearch() {
  const pat = searchPattern.value.trim()
  if (!pat || !fileData.value.length) return
  try {
    searchResults.value = searchType.value === 'hex' ? searchHex(fileData.value, pat) : searchAscii(fileData.value, pat)
    currentSearchIdx.value = searchResults.value.length ? 0 : -1
  } catch (e) {
    searchResults.value = []
    currentSearchIdx.value = -1
    console.error(e)
  }
}

function findNext() {
  if (!searchResults.value.length) return
  currentSearchIdx.value = (currentSearchIdx.value + 1) % searchResults.value.length
}

function findPrev() {
  if (!searchResults.value.length) return
  currentSearchIdx.value = currentSearchIdx.value <= 0 ? searchResults.value.length - 1 : currentSearchIdx.value - 1
}

function doGoto() {
  const addr = parseNumericText(gotoAddr.value, NaN)
  if (isNaN(addr)) return
  hexViewer.value?.gotoOffset(addr)
}

function handleDataChanged(offset, oldValue, newValue) {
  fileData.value = replaceByte(fileData.value, offset, newValue)
}

// ===== 文件工具 =====
async function selectFile(refKey) {
  const r = await window.services.showOpenDialog({ properties: ['openFile'] })
  if (r?.[0]) refKey.value = r[0]
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

async function mergeAddFiles() {
  const r = await window.services.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
  if (r) mergeFiles.value = r
}

async function doMerge() {
  if (mergeFiles.value.length < 2) return
  const segments = []
  for (const fp of mergeFiles.value) {
    const buf = await window.services.readFileBuffer(fp)
    segments.push(parseFirmwareBytes(buf, fp))
  }
  const merged = mergeFirmwareSegments(segments, {
    mode: mergeMode.value,
    outputFmt: mergeOutputFmt.value,
    fillValueText: mergeFillVal.value,
  })
  const path = await window.services.showSaveDialog({ defaultPath: `merged.${merged.extension}` })
  if (path) await window.services.writeFile(path, merged.data)
}

function formatFromPath(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'hex' || ext === 'ihx') return 'hex'
  if (ext === 's19' || ext === 'srec' || ext === 'mot') return 's19'
  if (ext === 'bin') return 'bin'
  return ''
}

function toHexText(value) {
  return '0x' + Number(value || 0).toString(16).toUpperCase()
}
</script>

<template>
  <div class="hex-tool">
    <h2 class="tool-title">Hex 工具</h2>

    <div class="tabs">
      <button :class="{ active: activeTab === 'editor' }" class="tab-btn" @click="activeTab = 'editor'">Hex编辑器</button>
      <button :class="{ active: activeTab === 'filetools' }" class="tab-btn" @click="activeTab = 'filetools'">文件工具</button>
    </div>

    <!-- Hex编辑器 -->
    <div v-if="activeTab === 'editor'" style="display:flex;flex-direction:column;height:calc(100vh - 140px)">
      <div class="card" style="margin-bottom:8px;padding:8px 12px">
        <div class="form-row" style="margin-bottom:4px">
          <input :value="filePath" readonly placeholder="打开文件或在下方输入Hex..." style="flex:1;background:var(--bg-secondary)" />
          <button class="btn btn-secondary btn-sm" @click="openFile">打开文件</button>
          <button class="btn btn-secondary btn-sm" @click="saveFile">另存为</button>
        </div>
        <div class="form-row" style="gap:4px">
          <input v-model="searchPattern" placeholder="搜索: FF 00 ?? 或 ASCII" style="width:180px" @keydown.enter="doSearch" />
          <select v-model="searchType" style="width:80px"><option value="hex">Hex</option><option value="ascii">ASCII</option></select>
          <button class="btn btn-secondary btn-sm" @click="doSearch">搜索</button>
          <button class="btn btn-sm" style="width:24px;padding:2px" @click="findPrev" :disabled="!searchResults.length">&lt;</button>
          <button class="btn btn-sm" style="width:24px;padding:2px" @click="findNext" :disabled="!searchResults.length">&gt;</button>
          <small style="color:var(--text-muted)">{{ searchResults.length ? `${currentSearchIdx+1}/${searchResults.length}` : '' }}</small>
          <span style="margin-left:12px">跳转:</span>
          <input v-model="gotoAddr" placeholder="0x..." style="width:100px" @keydown.enter="doGoto" />
          <button class="btn btn-secondary btn-sm" @click="doGoto">跳转</button>
        </div>
      </div>

      <div style="flex:1;min-height:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
        <HexViewer
          ref="hexViewer"
          :data="fileData" :baseOffset="fileBaseAddr" :bytesPerLine="16"
          :editable="true" :searchResults="searchResults" :currentSearchIdx="currentSearchIdx"
          @dataChanged="handleDataChanged"
        />
      </div>

    </div>

    <!-- 文件工具 -->
    <div v-if="activeTab === 'filetools'">
      <div class="card" style="margin-bottom:12px"><h4 style="margin:0 0 8px">格式转换</h4>
        <div class="form-row"><input :value="convInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" /><button class="btn btn-secondary btn-sm" @click="selectFile(convInputPath)">选择</button></div>
        <div class="form-row">
          <select v-model="convOutputFmt"><option value="hex">Intel HEX</option><option value="s19">Motorola S19</option><option value="bin">BIN</option></select>
          <input v-model="convBaseAddr" placeholder="基地址" style="width:120px" />
          <button class="btn btn-primary btn-sm" @click="doFileConvert">转换并保存</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:12px"><h4 style="margin:0 0 8px">文件切片</h4>
        <div class="form-row"><input :value="sliceInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" /><button class="btn btn-secondary btn-sm" @click="selectFile(sliceInputPath)">选择</button></div>
        <div class="form-row">起始:<input v-model="sliceStart" style="width:100px" /> 结束:<input v-model="sliceEnd" style="width:100px" /> 或长度:<input v-model="sliceLength" style="width:100px" placeholder="可选" /><button class="btn btn-primary btn-sm" @click="doSlice">切片保存</button></div>
      </div>
      <div class="card" style="margin-bottom:12px"><h4 style="margin:0 0 8px">文件填充</h4>
        <div class="form-row"><input :value="fillInputPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" /><button class="btn btn-secondary btn-sm" @click="selectFile(fillInputPath)">选择</button></div>
        <div class="form-row">目标大小:<input v-model="fillSize" style="width:100px" /> 填充值:<input v-model="fillValue" style="width:60px" />
          <select v-model="fillPos"><option value="tail">末尾填充</option><option value="head">头部填充</option><option value="align">对齐到大小</option></select>
          <button class="btn btn-primary btn-sm" @click="doFill">填充保存</button>
        </div>
      </div>
      <div class="card"><h4 style="margin:0 0 8px">文件合并</h4>
        <div class="form-row"><button class="btn btn-secondary btn-sm" @click="mergeAddFiles">添加文件</button><small style="color:var(--text-muted)">{{ mergeFiles.length }} 个文件</small></div>
        <div class="form-row">
          <select v-model="mergeMode"><option value="address">按地址合并</option><option value="concat">顺序拼接</option></select>
          <select v-model="mergeOutputFmt"><option value="bin">BIN</option><option value="hex">Intel HEX</option><option value="s19">Motorola S19</option></select>
          填充:<input v-model="mergeFillVal" style="width:60px" />
          <button class="btn btn-primary btn-sm" @click="doMerge" :disabled="mergeFiles.length<2">合并保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
