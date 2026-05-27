<script setup>
import { ref, watch, inject } from 'vue'
import { bitAnd, bitOr, bitXor, bitNot, bitShl, bitShr, bitTest, bitSet, bitClear, bitToggle, bitExtract, formatBits } from '../../../utils/bitops.js'

const copyText = inject('copyText', () => {})

const bitA = ref('0xFF')
const bitB = ref('0x0F')
const bitBitIndex = ref(0)
const bitShlBits = ref(1)
const bitShrBits = ref(1)
const bitExtStart = ref(0)
const bitExtLen = ref(4)
const bitResult = ref({})
function calcBitOps() {
  try {
    const a = BigInt(bitA.value)
    const b = BigInt(bitB.value)
    const bits = 32
    bitResult.value = {
      and: '0x' + bitAnd(a, b).toString(16).toUpperCase(),
      or: '0x' + bitOr(a, b).toString(16).toUpperCase(),
      xor: '0x' + bitXor(a, b).toString(16).toUpperCase(),
      notA: '0x' + bitNot(a, bits).toString(16).toUpperCase(),
      notB: '0x' + bitNot(b, bits).toString(16).toUpperCase(),
      shl: '0x' + bitShl(a, bitShlBits.value).toString(16).toUpperCase(),
      shr: '0x' + bitShr(a, bitShrBits.value).toString(16).toUpperCase(),
      test: bitTest(a, bitBitIndex.value),
      set: '0x' + bitSet(a, bitBitIndex.value).toString(16).toUpperCase(),
      clear: '0x' + bitClear(a, bitBitIndex.value).toString(16).toUpperCase(),
      toggle: '0x' + bitToggle(a, bitBitIndex.value).toString(16).toUpperCase(),
      extract: '0x' + bitExtract(a, bitExtStart.value, bitExtLen.value).toString(16).toUpperCase(),
      aBin: formatBits(a, bits),
      bBin: formatBits(b, bits),
    }
  } catch { bitResult.value = { error: '输入格式无效，请输入有效的十六进制数（如 0xFF）' } }
}
watch([bitA, bitB, bitBitIndex, bitShlBits, bitShrBits, bitExtStart, bitExtLen], calcBitOps, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">按位与/或/异或/非/移位，支持位测试、置位、清零、翻转和位段提取。</p>
    <div v-if="bitResult.error" style="color:#e74c3c;margin:8px 0;font-size:13px">{{ bitResult.error }}</div>
    <div class="form-row">
      <label>操作数A:</label>
      <input v-model="bitA" class="mono" placeholder="0xFF" />
      <label>操作数B:</label>
      <input v-model="bitB" class="mono" placeholder="0x0F" />
    </div>
    <div class="form-row" style="margin-top:10px">
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">
        A = {{ bitResult.aBin }}<br/>B = {{ bitResult.bBin }}
      </div>
    </div>
    <table class="data-table" style="max-width:450px;margin-top:8px">
      <tbody>
      <tr><td>A &amp; B</td><td class="mono">{{ bitResult.and }}</td><td><button class="copy-btn" @click="copyText(bitResult.and)">复制</button></td></tr>
      <tr><td>A | B</td><td class="mono">{{ bitResult.or }}</td><td><button class="copy-btn" @click="copyText(bitResult.or)">复制</button></td></tr>
      <tr><td>A ^ B</td><td class="mono">{{ bitResult.xor }}</td><td><button class="copy-btn" @click="copyText(bitResult.xor)">复制</button></td></tr>
      <tr><td>~A</td><td class="mono">{{ bitResult.notA }}</td><td><button class="copy-btn" @click="copyText(bitResult.notA)">复制</button></td></tr>
      <tr><td>~B</td><td class="mono">{{ bitResult.notB }}</td><td><button class="copy-btn" @click="copyText(bitResult.notB)">复制</button></td></tr>
      <tr><td>A &lt;&lt; {{ bitShlBits }}（左移）</td><td class="mono">{{ bitResult.shl }}</td><td><button class="copy-btn" @click="copyText(bitResult.shl)">复制</button></td></tr>
      <tr><td>A &gt;&gt; {{ bitShrBits }}（右移）</td><td class="mono">{{ bitResult.shr }}</td><td><button class="copy-btn" @click="copyText(bitResult.shr)">复制</button></td></tr>
      </tbody>
    </table>
    <div class="form-row" style="margin-top:12px">
      <label>移位:</label>
      <span>左移</span><input v-model.number="bitShlBits" type="number" min="0" max="31" style="width:60px" />
      <span>位</span>
      <span style="margin-left:12px">右移</span><input v-model.number="bitShrBits" type="number" min="0" max="31" style="width:60px" />
      <span>位</span>
    </div>
    <div class="form-row">
      <label>操作位:</label>
      <input v-model.number="bitBitIndex" type="number" min="0" max="31" style="width:60px" />
      <span style="color:var(--text-muted);font-size:11px">（对 A 的第 {{ bitBitIndex }} 位进行测/置/清/翻）</span>
    </div>
    <table class="data-table" style="max-width:450px;margin-top:4px">
      <tbody>
        <tr><td>Test (测第 {{ bitBitIndex }} 位)</td><td class="mono">{{ bitResult.test ? '1' : '0' }}</td><td><button class="copy-btn" @click="copyText(bitResult.test ? '1' : '0')">复制</button></td></tr>
        <tr><td>Set (置 1)</td><td class="mono">{{ bitResult.set }}</td><td><button class="copy-btn" @click="copyText(bitResult.set)">复制</button></td></tr>
        <tr><td>Clear (清 0)</td><td class="mono">{{ bitResult.clear }}</td><td><button class="copy-btn" @click="copyText(bitResult.clear)">复制</button></td></tr>
        <tr><td>Toggle (翻转)</td><td class="mono">{{ bitResult.toggle }}</td><td><button class="copy-btn" @click="copyText(bitResult.toggle)">复制</button></td></tr>
      </tbody>
    </table>
    <div class="form-row" style="margin-top:10px">
      <label>位段提取:</label>
      <span>起始</span><input v-model.number="bitExtStart" type="number" min="0" max="31" style="width:60px" />
      <span>长度</span><input v-model.number="bitExtLen" type="number" min="1" max="32" style="width:60px" />
    </div>
    <div class="form-row">
      <label>结果:</label>
      <input :value="bitResult.extract" readonly class="mono" style="width:160px;background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(bitResult.extract)">复制</button>
    </div>
  </div>
</template>
