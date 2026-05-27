<script setup>
import { ref, watch, inject } from 'vue'
import { timestampToDate, dateToTimestamp } from '../../../utils/timestamp.js'

const copyText = inject('copyText', () => {})

const tsUnit = ref('sec')
const tsInput = ref(String(Math.floor(Date.now() / 1000)))
const tsResult = ref('')
function calcTimestamp() {
  const input = tsInput.value.trim()
  if (!input) { tsResult.value = ''; return }
  tsResult.value = timestampToDate(input, undefined, tsUnit.value) ?? '无效时间戳'
}
const tsDateInput = ref('')
const tsDateResult = ref('')
function calcDateToTs() {
  const r = dateToTimestamp(tsDateInput.value)
  tsDateResult.value = r ? `秒: ${r.seconds} / 毫秒: ${r.milliseconds}` : '无效日期'
}
function switchTsUnit(u) {
  tsUnit.value = u
  tsInput.value = u === 'sec' ? String(Math.floor(Date.now() / 1000)) : String(Date.now())
}
function setTsNow() {
  tsInput.value = tsUnit.value === 'sec' ? String(Math.floor(Date.now() / 1000)) : String(Date.now())
}
watch([tsInput, tsUnit], calcTimestamp, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">Unix 时间戳与日期时间互转。支持秒和毫秒，上行戳→日期，下行日期→戳。</p>
    <div class="form-row">
      <label>时间戳:</label>
      <input v-model="tsInput" class="mono" style="width:240px" :placeholder="tsUnit === 'sec' ? '秒' : '毫秒'" />
      <button class="btn btn-sm" :class="tsUnit === 'sec' ? 'btn-primary' : 'btn-secondary'" @click="switchTsUnit('sec')">秒</button>
      <button class="btn btn-sm" :class="tsUnit === 'ms' ? 'btn-primary' : 'btn-secondary'" @click="switchTsUnit('ms')">毫秒</button>
      <button class="btn btn-secondary btn-sm" @click="setTsNow">当前</button>
    </div>
    <div class="form-row">
      <label>日期:</label>
      <input :value="tsResult" readonly class="mono" style="width:380px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(tsResult)" v-if="tsResult">复制</button>
    </div>
    <hr style="border-color:var(--border);margin:10px 0" />
    <div class="form-row">
      <label>日期:</label>
      <input v-model="tsDateInput" placeholder="2025-01-01 00:00:00" style="width:380px" />
      <button class="btn btn-primary btn-sm" @click="calcDateToTs">转换</button>
    </div>
    <div class="form-row">
      <label>结果:</label>
      <input :value="tsDateResult" readonly class="mono" style="width:380px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(tsDateResult)" v-if="tsDateResult">复制</button>
    </div>
  </div>
</template>
