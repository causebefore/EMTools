<script setup>
import { ref, inject } from 'vue'
import { HASH_ALGOS, hashText, hashTextSync, bufferToHex } from '../../utils/hash.js'

const textInput = ref('')
const selectedAlgo = ref('sha256')
const hashResult = ref('')
const computing = ref(false)

// 文件哈希
const filePath = ref('')
const fileHashResults = ref({})
const fileComputing = ref(false)

async function calcHash() {
  if (!textInput.value) { hashResult.value = ''; return }
  computing.value = true
  try {
    hashResult.value = await hashText(textInput.value, selectedAlgo.value)
  } catch (e) {
    hashResult.value = '错误: ' + e.message
  }
  computing.value = false
}

async function selectFile() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (result && result[0]) {
      filePath.value = result[0]
      fileComputing.value = true
      const results = {}
      for (const algo of HASH_ALGOS) {
        try {
          results[algo.id] = await window.services.getFileHash(result[0], algo.id === 'md5' ? 'md5' : algo.id)
        } catch {
          results[algo.id] = 'N/A'
        }
      }
      fileHashResults.value = results
      fileComputing.value = false
    }
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
      </div>
      <div class="form-row">
        <textarea v-model="textInput" class="mono" placeholder="输入文本内容..." rows="4" style="flex:1"></textarea>
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
