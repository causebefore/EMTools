<script setup>
import { ref, watch, inject } from 'vue'
import { floatToQ, qToFloat, qToHex, qRange } from '../../../utils/qformat.js'

const copyText = inject('copyText', () => {})

const qm = ref(8)
const qn = ref(8)
const qFloatInput = ref('1.5')
const qIntInput = ref('384')
const qResult = ref(null)
const qRangeInfo = ref('')
function calcQFormat() {
  const r = qRange(qm.value, qn.value)
  qRangeInfo.value = `范围: [${r.min}, ${r.max}]  分辨率: ${r.resolution.toExponential(5)}`
  const result = { qValue: null, qHex: null, qClamped: false, floatValue: null }
  if (qFloatInput.value) {
    const v = parseFloat(qFloatInput.value)
    if (!isNaN(v)) {
      const res = floatToQ(v, qm.value, qn.value)
      result.qValue = String(res.value)
      result.qHex = qToHex(res.value, qm.value + qn.value + 1)
      result.qClamped = res.clamped
    }
  }
  if (qIntInput.value) {
    const v = parseInt(qIntInput.value, 10)
    if (!isNaN(v)) {
      result.floatValue = String(qToFloat(v, qm.value, qn.value))
    }
  }
  qResult.value = result
}
watch([qm, qn, qFloatInput, qIntInput], calcQFormat, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">定点数 Qm.n 格式与浮点数互转。上行为浮点→Q值，下行为Q值→浮点。</p>
    <div class="form-row">
      <label>Q格式:</label>
      <span>Q</span><input v-model.number="qm" type="number" min="0" max="31" style="width:60px" />
      <span>.</span><input v-model.number="qn" type="number" min="0" max="31" style="width:60px" />
      <small style="color:var(--text-muted)">{{ qRangeInfo }}</small>
    </div>
    <div class="form-row">
      <label>浮点数:</label>
      <input v-model="qFloatInput" placeholder="1.5" style="width:120px" />
      <span style="color:var(--text-muted);margin:0 4px">→</span>
      <label style="min-width:auto">Q值:</label>
      <input :value="qResult?.qValue ?? ''" readonly class="mono" style="width:100px;background:var(--bg-secondary)" />
      <label style="min-width:auto">Hex:</label>
      <input :value="qResult?.qHex ?? ''" readonly class="mono" style="width:100px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(qResult?.qValue)" v-if="qResult?.qValue">复制</button>
      <span v-if="qResult?.qClamped" style="color:#e67e22;font-size:11px">[饱和]</span>
    </div>
    <div class="form-row">
      <label>Q值:</label>
      <input v-model="qIntInput" placeholder="384" style="width:120px" />
      <span style="color:var(--text-muted);margin:0 4px">→</span>
      <label style="min-width:auto">浮点数:</label>
      <input :value="qResult?.floatValue ?? ''" readonly class="mono" style="width:140px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(qResult?.floatValue)" v-if="qResult?.floatValue">复制</button>
    </div>
  </div>
</template>
