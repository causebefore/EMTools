<script setup>
import { ref, inject, watch } from 'vue'
import HexViewer from '../../../components/HexViewer.vue'
import {
  searchHex, searchAscii
} from '../../../utils/hextools.js'
import {
  parseNumericText,
  replaceByte,
} from '../../../utils/hex_filetools.js'

const { fileData, fileBaseAddr, filePath, openFile, saveFile } = inject('hexState')

const hexViewer = ref(null)
const searchPattern = ref('')
const searchType = ref('hex')
const searchResults = ref([])
const currentSearchIdx = ref(-1)
const gotoAddr = ref('')

// 文件切换时重置搜索状态
watch(filePath, () => {
  searchResults.value = []
  currentSearchIdx.value = -1
})

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
</script>

<template>
  <div style="display:flex;flex-direction:column;height:calc(100vh - 140px)">
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
</template>
