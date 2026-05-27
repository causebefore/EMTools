<script setup>
import { ref, watch, inject } from 'vue'
import { hexToBcd, bcdToHex } from '../../../utils/bcd.js'

const copyText = inject('copyText', () => {})

const bcdHexInput = ref('0x59')
const bcdDecInput = ref('99')
const bcdHexResult = ref('')
const bcdDecResult = ref('')
function calcBcd() {
  bcdDecResult.value = hexToBcd(bcdHexInput.value) ?? '无效BCD'
  bcdHexResult.value = bcdToHex(bcdDecInput.value) ?? '无效十进制'
}
watch([bcdHexInput, bcdDecInput], calcBcd, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">BCD 码（Binary-Coded Decimal）与十进制数值互转。上行 Hex→十进制，下行十进制→BCD Hex。</p>
    <div class="form-row">
      <label>Hex (BCD):</label>
      <input v-model="bcdHexInput" class="mono" placeholder="0x59" style="width:140px" />
      <span style="color:var(--text-muted);margin:0 4px">→</span>
      <label style="min-width:auto">十进制:</label>
      <input :value="bcdDecResult" readonly class="mono" style="width:120px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(bcdDecResult)" v-if="bcdDecResult">复制</button>
    </div>
    <div class="form-row">
      <label>十进制:</label>
      <input v-model="bcdDecInput" placeholder="99" style="width:140px" />
      <span style="color:var(--text-muted);margin:0 4px">→</span>
      <label style="min-width:auto">BCD Hex:</label>
      <input :value="bcdHexResult" readonly class="mono" style="width:140px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(bcdHexResult)" v-if="bcdHexResult">复制</button>
    </div>
  </div>
</template>
