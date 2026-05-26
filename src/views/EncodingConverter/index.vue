<script setup>
import { ref, inject } from 'vue'

const inputText = ref('')
const inputEncoding = ref('gbk')
const textOutputEncoding = ref('utf8')
const decodeResult = ref('')

// 单文件转换
const filePath = ref('')
const fileEncoding = ref('')
const filePreview = ref('')
const detectedEncoding = ref('')
const fileOutputEncoding = ref('utf8')

// 批量目录转换
const dirPath = ref('')
const batchResults = ref([])
const batchRunning = ref(false)
const batchProgress = ref('')

const encodings = [
  { id: 'utf8', name: 'UTF-8' },
  { id: 'utf16le', name: 'UTF-16 LE' },
  { id: 'utf16be', name: 'UTF-16 BE' },
  { id: 'gbk', name: 'GBK' },
  { id: 'gb2312', name: 'GB2312' },
  { id: 'gb18030', name: 'GB18030' },
  { id: 'latin1', name: 'ISO-8859-1 (Latin1)' },
  { id: 'ascii', name: 'ASCII' },
]

async function decodeText() {
  if (!inputText.value) { decodeResult.value = ''; return }
  try {
    const buf = await window.services.encodeText(inputText.value, inputEncoding.value)
    decodeResult.value = await window.services.decodeText(buf, textOutputEncoding.value)
  } catch (e) {
    decodeResult.value = '错误: ' + e.message
  }
}

async function selectFile() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (result && result[0]) {
      filePath.value = result[0]
      const buf = await window.services.readFileBuffer(result[0])
      const detected = await window.services.detectEncoding(buf)
      detectedEncoding.value = detected ? `${detected.encoding} (${(detected.confidence * 100).toFixed(0)}%)` : '未知'
      try {
        filePreview.value = await window.services.decodeText(buf, detected?.encoding || 'utf8')
      } catch {
        filePreview.value = '[无法解码]'
      }
    }
  } catch (e) {
    fileEncoding.value = '错误: ' + e.message
  }
}

async function convertSingleFile() {
  if (!filePath.value) return
  try {
    const toEnc = fileOutputEncoding.value
    const buf = await window.services.readFileBuffer(filePath.value)
    const text = await window.services.decodeText(buf, detectedEncoding.value?.split(' ')[0] || 'utf8')
    const newBuf = await window.services.encodeText(text, toEnc)
    const suffix = toEnc.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const newPath = filePath.value.match(/\.\w+$/)
      ? filePath.value.replace(/(\.\w+)$/, `_${suffix}$1`)
      : `${filePath.value}_${suffix}`
    await window.services.writeFile(newPath, newBuf)
    fileEncoding.value = `已保存: ${newPath}`
  } catch (e) {
    fileEncoding.value = '错误: ' + e.message
  }
}

async function selectDir() {
  try {
    const result = await window.services.showOpenDialog({ properties: ['openDirectory'] })
    if (result && result[0]) {
      dirPath.value = result[0]
    }
  } catch (e) {
    batchProgress.value = '错误: ' + e.message
  }
}

async function batchConvert() {
  if (!dirPath.value) return
  batchRunning.value = true
  batchResults.value = []
  batchProgress.value = '扫描文件中...'
  try {
    const files = await window.services.readDir(dirPath.value, true)
    const textFiles = files.filter(f => /\.(c|h|cpp|hpp|s|txt|md|json|xml|html|css|js|py|java)$/i.test(f))
    batchProgress.value = `找到 ${textFiles.length} 个文件，开始转换...`
    let converted = 0
    for (let i = 0; i < textFiles.length; i++) {
      try {
        const buf = await window.services.readFileBuffer(textFiles[i])
        const detected = await window.services.detectEncoding(buf)
        const enc = detected?.encoding || 'utf8'
        if (enc.toLowerCase() === 'utf-8' || enc.toLowerCase() === 'utf8') continue
        const text = await window.services.decodeText(buf, enc)
        const newBuf = await window.services.encodeText(text, 'utf8')
        const newPath = textFiles[i].replace(/(\.\w+)$/, '_utf8$1')
        await window.services.writeFile(newPath, newBuf)
        batchResults.value.push({ file: textFiles[i], enc, status: 'OK' })
        converted++
      } catch {
        batchResults.value.push({ file: textFiles[i], enc: '?', status: '失败' })
      }
      batchProgress.value = `处理中: ${i + 1}/${textFiles.length}`
    }
    batchProgress.value = `完成: ${converted} 个文件已转换`
  } catch (e) {
    batchProgress.value = '错误: ' + e.message
  }
  batchRunning.value = false
}

const copyText = inject('copyText', () => {})
</script>

<template>
  <div class="encoding-page">
    <h2 class="tool-title">编码转换</h2>

    <!-- 文本编解码 -->
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">文本编解码</h4>
      <div class="form-row">
        <label>从:</label>
        <select v-model="inputEncoding">
          <option v-for="e in encodings" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
        <span>→</span>
        <select v-model="textOutputEncoding">
          <option v-for="e in encodings" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="decodeText">转换</button>
      </div>
      <div class="form-row">
        <textarea v-model="inputText" class="mono" placeholder="输入文本..." rows="3" style="flex:1"></textarea>
      </div>
      <div class="form-row">
        <textarea :value="decodeResult" readonly class="mono" rows="3" style="flex:1;background:var(--bg-secondary)"></textarea>
        <button class="copy-btn" @click="copyText(decodeResult)" v-if="decodeResult">复制</button>
      </div>
    </div>

    <!-- 单文件检测 -->
    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 10px">文件编码检测</h4>
      <div class="form-row">
        <label>文件:</label>
        <input :value="filePath" readonly placeholder="选择文件..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary" @click="selectFile">选择文件</button>
      </div>
      <div class="form-row">
        <label>检测:</label>
        <input :value="detectedEncoding" readonly class="mono" style="flex:1;background:var(--bg-secondary)" />
      </div>
      <div class="form-row">
        <select v-model="fileOutputEncoding" style="width:140px">
          <option value="utf8">转为 UTF-8</option>
          <option value="utf16le">转为 UTF-16 LE</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="convertSingleFile">转换并保存</button>
        <span v-if="fileEncoding" style="color:var(--accent)">{{ fileEncoding }}</span>
      </div>
      <textarea :value="filePreview" readonly class="mono" rows="6" style="width:100%;margin-top:8px;font-size:12px;background:var(--bg-secondary)"></textarea>
    </div>

    <!-- 批量目录转换 -->
    <div class="card">
      <h4 style="margin:0 0 10px">批量目录转 UTF-8</h4>
      <div class="form-row">
        <label>目录:</label>
        <input :value="dirPath" readonly placeholder="选择目录..." style="flex:1;background:var(--bg-secondary)" />
        <button class="btn btn-secondary" @click="selectDir">选择目录</button>
        <button class="btn btn-primary" @click="batchConvert" :disabled="batchRunning">{{ batchRunning ? '转换中...' : '批量转换' }}</button>
      </div>
      <div v-if="batchProgress" style="color:var(--text-secondary);margin-bottom:8px">{{ batchProgress }}</div>
      <div v-if="batchResults.length" style="max-height:200px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th>文件</th><th>原编码</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="r in batchResults" :key="r.file">
              <td class="mono" style="font-size:11px">{{ r.file }}</td>
              <td>{{ r.enc }}</td>
              <td>{{ r.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
