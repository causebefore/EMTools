<script setup>
import { ref, inject, provide } from 'vue'
import EditorTab from './tabs/EditorTab.vue'
import FiletoolsTab from './tabs/FiletoolsTab.vue'
import MergeTab from './tabs/MergeTab.vue'
import {
  convertFirmware,
  parseFirmwareBytes,
} from '../../utils/hex_filetools.js'

const copyText = inject('copyText', () => {})

const activeTab = ref('editor')

// ===== Hex编辑器 =====
const filePath = ref('')
const fileData = ref(new Uint8Array(0))
const fileBaseAddr = ref(0)
const fileFormat = ref('bin')

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

provide('hexState', { fileData, filePath, fileBaseAddr, fileFormat, openFile, saveFile })

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
      <button :class="{ active: activeTab === 'merge' }" class="tab-btn" @click="activeTab = 'merge'">文件合并</button>
    </div>

    <!-- Hex编辑器 -->
    <EditorTab v-if="activeTab === 'editor'" />

    <!-- 文件工具 -->
    <FiletoolsTab v-if="activeTab === 'filetools'" />

    <!-- 文件合并 -->
    <MergeTab v-if="activeTab === 'merge'" />
  </div>
</template>

<style scoped>
