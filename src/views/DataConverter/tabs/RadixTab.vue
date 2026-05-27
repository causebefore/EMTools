<script setup>
import { ref, watch, inject } from 'vue'
import { convertRadix, RADIX_NAMES } from '../../../utils/radix.js'

const copyText = inject('copyText', () => {})

const radixInput = ref('255')
const radixFrom = ref(10)
const radixResults = ref({})

const commonRadices = [2, 8, 10, 16]

function calcRadixAll() {
  const results = {}
  for (let r = 2; r <= 36; r++) {
    results[r] = convertRadix(radixInput.value, radixFrom.value, r)
  }
  radixResults.value = results
}
watch([radixInput, radixFrom], calcRadixAll, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">在任意进制间转换数值，支持二进制到三十六进制。</p>
    <div class="form-row">
      <label>输入值:</label>
      <input v-model="radixInput" class="mono" style="flex:1;max-width:300px" />
      <select v-model.number="radixFrom" style="width:140px">
        <option v-for="r in commonRadices" :key="r" :value="r">{{ RADIX_NAMES[r] }}</option>
        <option :value="36">三十六进制</option>
      </select>
    </div>
    <table class="data-table" style="max-width:500px">
      <thead><tr><th>进制</th><th>值</th><th></th></tr></thead>
      <tbody>
        <tr v-for="r in commonRadices" :key="r">
          <td>{{ RADIX_NAMES[r] }}</td>
          <td class="mono">{{ radixResults[r] }}</td>
          <td><button class="copy-btn" @click="copyText(radixResults[r])">复制</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
