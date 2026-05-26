<script setup>
import { ref, watch } from 'vue'
import RegisterVisualizer from '../../components/RegisterVisualizer.vue'
import { formatRegisterHex, parseRegisterHex, toggleRegisterBit } from '../../utils/bitfield.js'

const regWidth = ref(32)
const regValue = ref(0n)
const regValueHex = ref('0x00000000')

// 模板加载
const templates = ref({})
const templateName = ref('')
const templateList = ref([])
const regFields = ref([])
try {
  fetch('./bitfield_templates.json').then(r => r.json()).then(data => {
    templates.value = data
    templateList.value = Object.keys(data)
  }).catch(() => {})
} catch { /* templates unavailable */ }

watch(regValueHex, (val) => {
  try { regValue.value = parseRegisterHex(val) }
  catch { regValue.value = 0n }
})

watch(regWidth, () => {
  regValueHex.value = formatRegisterHex(regValue.value, regWidth.value)
})

function loadTemplate() {
  if (!templateName.value || !templates.value[templateName.value]) return
  regFields.value = JSON.parse(JSON.stringify(templates.value[templateName.value]))
}

function onBitClick(bitIdx) {
  regValue.value = toggleRegisterBit(regValue.value, bitIdx, regWidth.value)
  regValueHex.value = formatRegisterHex(regValue.value, regWidth.value)
}
</script>

<template>
  <div class="bitfield-page">
    <h2 class="tool-title">位域计算器</h2>

    <div class="card">
      <div class="form-row">
        <label>位宽:</label>
        <select v-model.number="regWidth">
          <option :value="8">8-bit</option>
          <option :value="16">16-bit</option>
          <option :value="32">32-bit</option>
          <option :value="64">64-bit</option>
        </select>
        <label>值:</label>
        <input v-model="regValueHex" class="mono" style="width:190px" placeholder="0x00000000" />
        <button class="btn btn-secondary btn-sm" @click="regValueHex=formatRegisterHex(0n, regWidth)">清零</button>
        <button class="btn btn-secondary btn-sm" @click="regValueHex=formatRegisterHex((1n << BigInt(regWidth)) - 1n, regWidth)">全1</button>

        <span style="margin-left:16px">模板:</span>
        <select v-model="templateName" style="width:130px">
          <option value="">-- 选择 --</option>
          <option v-for="n in templateList" :key="n" :value="n">{{ n }}</option>
        </select>
        <button class="btn btn-secondary btn-sm" @click="loadTemplate" :disabled="!templateName">加载</button>
      </div>

      <RegisterVisualizer
        :width="regWidth"
        :registerValue="regValue"
        :fields="regFields"
        :editable="true"
        @bitClick="onBitClick"
      />
    </div>
  </div>
</template>
