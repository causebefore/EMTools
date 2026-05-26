<script setup>
import { ref, watch, inject } from 'vue'
import { CRC_PRESETS, crcCompute, crcGenerateCCode, parseHexData } from '../../utils/crc.js'
import { checksumXor, checksumSumLow, checksumTwosComplement, checksumFletcher16 } from '../../utils/checksum.js'

const presets = Object.keys(CRC_PRESETS)
const activeTab = ref('checksum')
const selectedPreset = ref('CRC-32')
const customParams = ref({ ...CRC_PRESETS['CRC-32'] })

const dataInput = ref('')
const crcHex = ref('')
const crcDec = ref('')
const crcBin = ref('')

// 文件 CRC
const filePath = ref('')
const fileCrcHex = ref('')
const fileCrcDec = ref('')
const fileSize = ref('')

// 代码生成
const codePreset = ref('CRC-32')
const generatedCode = ref('')

function loadPreset(name) {
  if (CRC_PRESETS[name]) {
    customParams.value = { ...CRC_PRESETS[name] }
    updateParamTexts()
  }
}
watch(selectedPreset, (name) => {
  loadPreset(name)
  if (activeTab.value !== 'code') codePreset.value = name
})

// 自定义参数 hex 文本 ↔ 数字同步
const polyText = ref('')
const initText = ref('')
const xorOutText = ref('')

function formatParamHex(v) {
  return '0x' + (Number(v) || 0).toString(16).toUpperCase()
}

function updateParamTexts() {
  polyText.value = formatParamHex(customParams.value.poly)
  initText.value = formatParamHex(customParams.value.init)
  xorOutText.value = formatParamHex(customParams.value.xorOut)
}
updateParamTexts()

function applyPoly(v) { customParams.value.poly = parseInt(v, 16) || 0 }
function applyInit(v) { customParams.value.init = parseInt(v, 16) || 0 }
function applyXor(v) { customParams.value.xorOut = parseInt(v, 16) || 0 }

function calcCrc() {
  try {
    const data = parseHexData(dataInput.value)
    if (!data.length) { crcHex.value = ''; crcDec.value = ''; crcBin.value = ''; return }
    const params = customParams.value
    const result = crcCompute(data, params)
    const hexLen = params.width / 4
    crcHex.value = '0x' + result.toString(16).toUpperCase().padStart(hexLen, '0')
    crcDec.value = result.toString()
    crcBin.value = result.toString(2).padStart(params.width, '0')
  } catch (e) {
    crcHex.value = '错误: ' + e.message
  }
}

async function selectFile() {
  try {
    const result = await window.services.showOpenDialog({
      properties: ['openFile']
    })
    if (result && result[0]) {
      filePath.value = result[0]
      const buf = await window.services.readFileBuffer(result[0])
      fileSize.value = formatSize(buf.length)
      const crc = crcCompute(new Uint8Array(buf), customParams.value)
      const hexLen = customParams.value.width / 4
      fileCrcHex.value = '0x' + crc.toString(16).toUpperCase().padStart(hexLen, '0')
      fileCrcDec.value = crc.toString()
    }
  } catch (e) {
    fileCrcHex.value = '错误: ' + e.message
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1048576).toFixed(2) + ' MB'
}

function generateCode() {
  generatedCode.value = crcGenerateCCode(codePreset.value)
}

function openCodeTab() {
  activeTab.value = 'code'
  if (!generatedCode.value) generateCode()
}

// 校验和
const checksumType = ref('xor')
const checksumInput = ref('')
const checksumHex = ref('')
const checksumDec = ref('')
const fletcherSum1 = ref('')
const fletcherSum2 = ref('')
const fletcherCombined = ref('')

// 文件校验和
const fileChecksumPath = ref('')
const fileChecksumSize = ref('')
const fileChecksumResult = ref('')

const checksumFnMap = {
  xor: checksumXor,
  'sum-low': checksumSumLow,
  'twos-complement': checksumTwosComplement,
}

function calcChecksum() {
  try {
    const data = parseHexData(checksumInput.value)
    if (!data.length) {
      checksumHex.value = ''; checksumDec.value = ''
      fletcherSum1.value = ''; fletcherSum2.value = ''; fletcherCombined.value = ''
      return
    }
    const bytes = new Uint8Array(data)
    if (checksumType.value === 'fletcher16') {
      const r = checksumFletcher16(bytes)
      fletcherSum1.value = '0x' + r.sum1.toString(16).toUpperCase().padStart(2, '0')
      fletcherSum2.value = '0x' + r.sum2.toString(16).toUpperCase().padStart(2, '0')
      fletcherCombined.value = '0x' + r.combined.toString(16).toUpperCase().padStart(4, '0')
      checksumHex.value = ''; checksumDec.value = ''
    } else {
      const fn = checksumFnMap[checksumType.value]
      const result = fn(bytes)
      checksumHex.value = '0x' + result.toString(16).toUpperCase().padStart(2, '0')
      checksumDec.value = String(result)
      fletcherSum1.value = ''; fletcherSum2.value = ''; fletcherCombined.value = ''
    }
  } catch (e) {
    checksumHex.value = '错误: ' + e.message
  }
}

watch(checksumType, () => {
  checksumHex.value = ''; checksumDec.value = ''
  fletcherSum1.value = ''; fletcherSum2.value = ''; fletcherCombined.value = ''
  fileChecksumResult.value = ''; fileChecksumPath.value = ''; fileChecksumSize.value = ''
})

async function selectChecksumFile() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (result && result[0]) {
      fileChecksumPath.value = result[0]
      const buf = await window.services.readFileBuffer(result[0])
      fileChecksumSize.value = formatSize(buf.length)
      const bytes = new Uint8Array(buf)
      if (checksumType.value === 'fletcher16') {
        const r = checksumFletcher16(bytes)
        fileChecksumResult.value = '0x' + r.combined.toString(16).toUpperCase().padStart(4, '0')
      } else {
        const fn = checksumFnMap[checksumType.value]
        fileChecksumResult.value = '0x' + fn(bytes).toString(16).toUpperCase().padStart(2, '0')
      }
    }
  } catch (e) {
    fileChecksumResult.value = '错误: ' + e.message
  }
}

const copyText = inject('copyText', () => {})
</script>

<template>
  <div class="crc-page">
    <h2 class="tool-title">校验计算</h2>

    <div class="tabs">
      <button :class="{ active: activeTab === 'checksum' }" class="tab-btn" @click="activeTab = 'checksum'">校验和</button>
      <button :class="{ active: activeTab === 'calculate' }" class="tab-btn" @click="activeTab = 'calculate'">CRC 计算</button>
      <button :class="{ active: activeTab === 'code' }" class="tab-btn" @click="openCodeTab">代码生成</button>
    </div>

    <!-- 校验和 -->
    <template v-if="activeTab === 'checksum'">
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">校验和类型</h4>
      <div class="form-row">
        <label>类型:</label>
        <select v-model="checksumType">
          <option value="xor">XOR 校验</option>
          <option value="sum-low">求和取低字节</option>
          <option value="twos-complement">补码和</option>
          <option value="fletcher16">Fletcher-16</option>
        </select>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">数据输入</h4>
      <div class="form-row">
        <textarea v-model="checksumInput" class="mono" placeholder="如: 01 02 03 04 或 0x01, 0x02, 0x03" rows="3" style="flex:1"></textarea>
        <button class="btn btn-primary" @click="calcChecksum">计算</button>
      </div>

      <template v-if="checksumType !== 'fletcher16'">
        <div class="form-row">
          <label>Hex:</label>
          <input :value="checksumHex" readonly class="mono" style="width:120px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(checksumHex)" v-if="checksumHex">复制</button>
        </div>
        <div class="form-row">
          <label>Dec:</label>
          <input :value="checksumDec" readonly class="mono" style="width:80px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(checksumDec)" v-if="checksumDec">复制</button>
        </div>
      </template>

      <template v-else>
        <div class="form-row">
          <label>Sum1:</label>
          <input :value="fletcherSum1" readonly class="mono" style="width:100px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(fletcherSum1)" v-if="fletcherSum1">复制</button>
        </div>
        <div class="form-row">
          <label>Sum2:</label>
          <input :value="fletcherSum2" readonly class="mono" style="width:100px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(fletcherSum2)" v-if="fletcherSum2">复制</button>
        </div>
        <div class="form-row">
          <label>Combined:</label>
          <input :value="fletcherCombined" readonly class="mono" style="width:140px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(fletcherCombined)" v-if="fletcherCombined">复制</button>
        </div>
      </template>
    </div>

    <div class="card">
      <h4 style="margin:0 0 10px">文件校验和</h4>
      <div class="form-row">
        <label>文件:</label>
        <input :value="fileChecksumPath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary" @click="selectChecksumFile">选择文件</button>
      </div>
      <div class="form-row">
        <label>大小:</label>
        <input :value="fileChecksumSize" readonly class="mono" style="background:var(--bg-secondary);width:120px" />
        <label>结果:</label>
        <input :value="fileChecksumResult" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
        <button class="copy-btn" @click="copyText(fileChecksumResult)" v-if="fileChecksumResult">复制</button>
      </div>
    </div>
    </template>

    <template v-if="activeTab === 'calculate'">
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">CRC 参数</h4>
      <div class="form-row">
        <label>预设:</label>
        <select v-model="selectedPreset">
          <option v-for="p in presets" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
      <div class="form-row" style="flex-wrap:wrap;gap:6px 12px">
        <div class="result-field"><label style="min-width:auto">位宽:</label>
          <select v-model.number="customParams.width" style="width:70px">
            <option :value="8">8</option><option :value="16">16</option><option :value="32">32</option>
          </select></div>
        <div class="result-field"><label style="min-width:auto">多项式:</label>
          <input :value="polyText" @change="e => { polyText = e.target.value; applyPoly(e.target.value) }" class="mono" style="width:110px" /></div>
        <div class="result-field"><label style="min-width:auto">初始值:</label>
          <input :value="initText" @change="e => { initText = e.target.value; applyInit(e.target.value) }" class="mono" style="width:110px" /></div>
        <div class="result-field"><label style="min-width:auto">输入反转:</label>
          <input type="checkbox" v-model="customParams.refIn" /></div>
        <div class="result-field"><label style="min-width:auto">输出反转:</label>
          <input type="checkbox" v-model="customParams.refOut" /></div>
        <div class="result-field"><label style="min-width:auto">输出异或:</label>
          <input :value="xorOutText" @change="e => { xorOutText = e.target.value; applyXor(e.target.value) }" class="mono" style="width:110px" /></div>
      </div>
    </div>

    <!-- 文本 CRC -->
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">数据输入</h4>
      <div class="form-row">
        <textarea v-model="dataInput" class="mono" placeholder="如: 01 02 03 04 或 0x01, 0x02, 0x03" rows="3" style="flex:1"></textarea>
        <button class="btn btn-primary" @click="calcCrc">计算 CRC</button>
      </div>
      <div class="form-row">
        <label>Hex:</label>
        <input :value="crcHex" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
        <button class="copy-btn" @click="copyText(crcHex)" v-if="crcHex">复制</button>
      </div>
      <div class="form-row">
        <label>Dec:</label>
        <input :value="crcDec" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
        <button class="copy-btn" @click="copyText(crcDec)" v-if="crcDec">复制</button>
      </div>
      <div class="form-row">
        <label>Bin:</label>
        <input :value="crcBin" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
      </div>
    </div>

    <!-- 文件 CRC -->
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">文件 CRC 计算</h4>
      <div class="form-row">
        <label>文件:</label>
        <input :value="filePath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary" @click="selectFile">选择文件</button>
      </div>
      <div class="form-row">
        <label>大小:</label>
        <input :value="fileSize" readonly class="mono" style="background:var(--bg-secondary);width:120px" />
        <label>CRC:</label>
        <input :value="fileCrcHex" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
        <button class="copy-btn" @click="copyText(fileCrcHex)" v-if="fileCrcHex">复制</button>
      </div>
    </div>
    </template>

    <!-- 代码生成 -->
    <div class="card" v-if="activeTab === 'code'">
      <h4 style="margin:0 0 10px">查表法 C 代码 ({{ codePreset }})</h4>
      <div class="form-row" style="margin-bottom:8px">
        <select v-model="codePreset">
          <option v-for="p in presets" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="generateCode">重新生成</button>
      </div>
      <textarea :value="generatedCode" readonly class="mono" rows="20" style="width:100%;font-size:12px;background:var(--bg-secondary)"></textarea>
      <button class="btn btn-secondary btn-sm" style="margin-top:8px" @click="copyText(generatedCode)">复制代码</button>
    </div>
  </div>
</template>

<style scoped>
h4 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}
</style>
