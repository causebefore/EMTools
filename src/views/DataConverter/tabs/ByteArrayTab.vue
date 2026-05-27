<script setup>
import { ref, inject } from 'vue'

const copyText = inject('copyText', () => {})

const byteArrayInput = ref('48 65 6C 6C 6F')
const byteArrayResult = ref('')
function formatByteArray() {
  const hex = byteArrayInput.value.replace(/\s/g, '')
  if (!/^[0-9A-Fa-f]*$/.test(hex)) { byteArrayResult.value = '无效：输入包含非Hex字符'; return }
  if (hex.length % 2 !== 0) { byteArrayResult.value = '无效：Hex字符串长度必须为偶数'; return }
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push('0x' + hex.substring(i, i + 2).toUpperCase())
  }
  byteArrayResult.value = `{ ${bytes.join(', ')} }`
}
</script>

<template>
  <div class="card">
    <p class="tab-desc">Hex 字符串转换为 C 语言字节数组格式（如 { 0x48, 0x65, ... }）。</p>
    <div class="form-row">
      <label>Hex:</label>
      <input v-model="byteArrayInput" class="mono" placeholder="48 65 6C 6C 6F" style="flex:1;max-width:400px" />
      <button class="btn btn-primary btn-sm" @click="formatByteArray">格式化</button>
    </div>
    <div class="form-row">
      <textarea :value="byteArrayResult" readonly class="mono" style="width:420px;background:var(--bg-secondary);font-size:12px" rows="3"></textarea>
      <button class="copy-btn" @click="copyText(byteArrayResult)" v-if="byteArrayResult">复制</button>
    </div>
  </div>
</template>
