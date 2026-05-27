<script setup>
import { ref, watch, inject } from 'vue'
import { swap16, swap32, swap64, reverseBytes } from '../../../utils/endian.js'

const copyText = inject('copyText', () => {})

const endianHex = ref('12345678')
const endianResult = ref({})
function calcEndian() {
  try {
    const v = BigInt('0x' + endianHex.value.replace(/\s/g, ''))
    endianResult.value = {
      swap16: '0x' + swap16(v).toString(16).toUpperCase().padStart(4, '0'),
      swap32: '0x' + swap32(v).toString(16).toUpperCase().padStart(8, '0'),
      swap64: '0x' + swap64(v).toString(16).toUpperCase().padStart(16, '0'),
      reversed: reverseBytes(endianHex.value),
    }
  } catch { endianResult.value = { error: '输入格式无效，请输入有效的十六进制数' } }
}
watch(endianHex, calcEndian, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">大端/小端字节序转换（16/32/64位），支持字节反转。</p>
    <div v-if="endianResult.error" style="color:#e74c3c;margin:8px 0;font-size:13px">{{ endianResult.error }}</div>
    <div class="form-row">
      <label>Hex值:</label>
      <input v-model="endianHex" class="mono" placeholder="12345678" style="flex:1;max-width:300px" />
    </div>
    <table class="data-table" style="max-width:400px">
      <tbody>
      <tr><td>16位 swap</td><td class="mono">{{ endianResult.swap16 }}</td><td><button class="copy-btn" @click="copyText(endianResult.swap16)">复制</button></td></tr>
      <tr><td>32位 swap</td><td class="mono">{{ endianResult.swap32 }}</td><td><button class="copy-btn" @click="copyText(endianResult.swap32)">复制</button></td></tr>
      <tr><td>64位 swap</td><td class="mono">{{ endianResult.swap64 }}</td><td><button class="copy-btn" @click="copyText(endianResult.swap64)">复制</button></td></tr>
      <tr><td>字节反转</td><td class="mono">{{ endianResult.reversed }}</td><td><button class="copy-btn" @click="copyText(endianResult.reversed)">复制</button></td></tr>
      </tbody>
    </table>
  </div>
</template>
