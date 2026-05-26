<script setup>
import { ref, computed, inject } from 'vue'
import { HASH_ALGOS, hashText, hashBytes, hexToBytes, base64ToBytes } from '../../utils/hash.js'

const textInput = ref('')
const selectedAlgo = ref('SHA-256')
const hashResult = ref('')
const computing = ref(false)

const inputFormat = ref('string')
const inputEncoding = ref('utf8')

const encodings = [
  { id: 'utf8', name: 'UTF-8' },
  { id: 'ascii', name: 'ASCII' },
  { id: 'gbk', name: 'GBK' },
  { id: 'gb2312', name: 'GB2312' },
]

const inputFormats = [
  { id: 'string', name: '文本 (String)' },
  { id: 'hex', name: 'Hex 字节' },
  { id: 'base64', name: 'Base64 字节' },
]

const isStringMode = computed(() => inputFormat.value === 'string')

// 文件哈希
const filePath = ref('')
const fileHashResults = ref({})
const fileComputing = ref(false)

async function calcHash() {
  if (!textInput.value) { hashResult.value = ''; return }
  computing.value = true
  try {
    hashResult.value = await computeHash(textInput.value, selectedAlgo.value, inputFormat.value, inputEncoding.value)
  } catch (e) {
    hashResult.value = '错误: ' + e.message
  }
  computing.value = false
}

async function computeHash(input, algo, format, encoding) {
  if (format === 'hex') {
    const bytes = hexToBytes(input)
    if (!bytes) return '无效 Hex 字符串'
    return await hashBytes(bytes, algo)
  }
  if (format === 'base64') {
    const bytes = base64ToBytes(input)
    if (!bytes) return '无效 Base64 字符串'
    return await hashBytes(bytes, algo)
  }
  // string mode: encode with selected charset then hash
  if (encoding === 'utf8') {
    return await hashText(input, algo)
  }
  const bytes = await window.services.encodeText(input, encoding)
  return await hashBytes(bytes, algo)
}

async function selectFile() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (!result?.[0]) return
    filePath.value = result[0]
    fileComputing.value = true
    const results = {}
    for (const algo of HASH_ALGOS) {
      try {
        results[algo.id] = await window.services.getFileHash(result[0], algo.id === 'md5' ? 'md5' : algo.id.toLowerCase().replace(/-/g, ''))
      } catch {
        results[algo.id] = 'N/A'
      }
    }
    fileHashResults.value = results
    fileComputing.value = false
  } catch (e) {
    fileHashResults.value = { error: e.message }
    fileComputing.value = false
  }
}

const copyText = inject('copyText', () => {})
</script>

<template>
  <div class="hash-page">
    <h2 class="tool-title">哈希计算器</h2>

    <!-- 文本哈希 -->
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">文本哈希</h4>
      <div class="form-row">
        <label>算法:</label>
        <select v-model="selectedAlgo">
          <option v-for="a in HASH_ALGOS" :key="a.id" :value="a.id">{{ a.name }} ({{ a.bits }}bit)</option>
        </select>
        <label>输入格式:</label>
        <select v-model="inputFormat">
          <option v-for="f in inputFormats" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
        <label v-if="isStringMode">编码:</label>
        <select v-if="isStringMode" v-model="inputEncoding">
          <option v-for="e in encodings" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <textarea v-model="textInput" class="mono" :placeholder="isStringMode ? '输入文本内容...' : '输入 Hex 或 Base64 字符串...'" rows="4" style="flex:1"></textarea>
        <button class="btn btn-primary" @click="calcHash" :disabled="computing">{{ computing ? '计算中...' : '计算' }}</button>
      </div>
      <div class="form-row">
        <label>{{ selectedAlgo.toUpperCase() }}:</label>
        <input :value="hashResult" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
        <button class="copy-btn" @click="copyText(hashResult)" v-if="hashResult">复制</button>
      </div>
    </div>

    <!-- 文件哈希 -->
    <div class="card">
      <h4 style="margin:0 0 10px">文件哈希</h4>
      <div class="form-row">
        <label>文件:</label>
        <input :value="filePath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary" @click="selectFile">选择文件</button>
      </div>
      <div v-if="fileComputing" style="color:var(--text-secondary);padding:8px 0">计算中...</div>
      <table v-if="Object.keys(fileHashResults).length && !fileComputing" class="data-table" style="max-width:600px;margin-top:8px">
        <thead><tr><th>算法</th><th>哈希值</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in HASH_ALGOS" :key="a.id">
            <td>{{ a.name }}</td>
            <td class="mono" style="word-break:break-all">{{ fileHashResults[a.id] || 'N/A' }}</td>
            <td><button class="copy-btn" @click="copyText(fileHashResults[a.id])" v-if="fileHashResults[a.id]">复制</button></td>
          </tr>
        </tbody>
      </table>
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
