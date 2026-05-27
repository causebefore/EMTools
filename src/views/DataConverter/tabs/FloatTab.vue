<script setup>
import { ref, watch, inject } from 'vue'
import { hexToFloat, floatToHex, hexToDouble, doubleToHex, decomposeFloat, decomposeDouble } from '../../../utils/ieee754.js'

const copyText = inject('copyText', () => {})

const floatHex = ref('40490FDB')
const floatType = ref('single')
const floatResult = ref('')
const floatDecompose = ref(null)

function calcFloat() {
  if (floatType.value === 'single') {
    const f = hexToFloat(floatHex.value)
    floatResult.value = f !== null ? String(f) : '无效Hex'
    floatDecompose.value = decomposeFloat(floatHex.value)
  } else {
    const d = hexToDouble(floatHex.value)
    floatResult.value = d !== null ? String(d) : '无效Hex'
    floatDecompose.value = decomposeDouble(floatHex.value)
  }
}
const floatToHexInput = ref('3.14159')
const floatToHexResult = ref('')
function calcFloatToHex() {
  const f = parseFloat(floatToHexInput.value)
  if (isNaN(f)) { floatToHexResult.value = '无效'; return }
  floatToHexResult.value = floatType.value === 'single' ? floatToHex(f) : doubleToHex(f)
}
watch([floatHex, floatType], calcFloat, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">IEEE 754 单精度/双精度浮点数与十六进制互转，查看符号/指数/尾数分解。</p>
    <div class="form-row">
      <label>Hex:</label>
      <input v-model="floatHex" class="mono" placeholder="40490FDB" />
      <select v-model="floatType">
        <option value="single">单精度 (32位)</option>
        <option value="double">双精度 (64位)</option>
      </select>
    </div>
    <div class="form-row">
      <label>浮点值:</label>
      <input :value="floatResult" readonly class="mono" style="background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(floatResult)">复制</button>
    </div>
    <div v-if="floatDecompose" style="margin-top:8px">
      <div class="mono" style="font-size:11px;color:var(--text-secondary);line-height:1.6">
        <div>符号: {{ floatDecompose.sign }} ({{ floatDecompose.signVal }})</div>
        <div>指数: {{ floatDecompose.exponent }} ({{ floatDecompose.expVal >= 0 ? '+' : '' }}{{ floatDecompose.expVal }})</div>
        <div v-if="floatType === 'single'">尾数: 0x{{ floatDecompose.mantissa.toString(16).padStart(6,'0').toUpperCase() }}</div>
        <div v-else>尾数高32: 0x{{ floatDecompose.mantissaHigh.toString(16).padStart(5,'0').toUpperCase() }} | 尾数低32: 0x{{ floatDecompose.mantLow.toString(16).padStart(8,'0').toUpperCase() }}</div>
      </div>
    </div>
    <hr style="border-color:var(--border);margin:10px 0" />
    <div class="form-row">
      <label>浮点→:</label>
      <input v-model="floatToHexInput" placeholder="3.14159" />
      <button class="btn btn-primary btn-sm" @click="calcFloatToHex">转换</button>
    </div>
    <div class="form-row">
      <label>Hex:</label>
      <input :value="floatToHexResult" readonly class="mono" style="background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(floatToHexResult)">复制</button>
    </div>
  </div>
</template>
