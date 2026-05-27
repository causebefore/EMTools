<script setup>
import { ref, watch, computed, inject } from 'vue'
import RadixTab from './tabs/RadixTab.vue'
import FloatTab from './tabs/FloatTab.vue'
import { bitAnd, bitOr, bitXor, bitNot, bitShl, bitShr, bitTest, bitSet, bitClear, bitToggle, bitExtract, formatBits } from '../../utils/bitops.js'
import { swap16, swap32, swap64, reverseBytes } from '../../utils/endian.js'
import { floatToQ, qToFloat, qToHex, qRange } from '../../utils/qformat.js'
import { hexToBcd, bcdToHex } from '../../utils/bcd.js'
import { timestampToDate, dateToTimestamp, currentTimestamp } from '../../utils/timestamp.js'
import { describeCharacter } from '../../utils/charenc.js'
import { formatIpAddress } from '../../utils/ip.js'

const activeTab = ref('radix')
const tabs = [
  { id: 'radix', name: '进制转换' },
  { id: 'float', name: '浮点数' },
  { id: 'bit', name: '位操作' },
  { id: 'endian', name: '字节序' },
  { id: 'qformat', name: 'Q格式' },
  { id: 'bcd', name: 'BCD码' },
  { id: 'timestamp', name: '时间戳' },
  { id: 'bytearray', name: '字节数组' },
  { id: 'ascii', name: 'ASCII码表' },
  { id: 'charenc', name: '字符编码' },
  { id: 'ip', name: 'IP地址' },
]

const copyText = inject('copyText', () => {})

// ===== 位操作 =====
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

// ===== 字节序 =====
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

// ===== Q格式 =====
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

// ===== BCD =====
const bcdHexInput = ref('0x59')
const bcdDecInput = ref('99')
const bcdHexResult = ref('')
const bcdDecResult = ref('')
function calcBcd() {
  bcdDecResult.value = hexToBcd(bcdHexInput.value) ?? '无效BCD'
  bcdHexResult.value = bcdToHex(bcdDecInput.value) ?? '无效十进制'
}
watch([bcdHexInput, bcdDecInput], calcBcd, { immediate: true })

// ===== 时间戳 =====
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

// ===== 字节数组 =====
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

// ===== ASCII 码表 =====
const asciiSearch = ref('')
const ctrlChars = {
  0: 'NUL (空)', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
  8: 'BS', 9: 'HT (Tab)', 10: 'LF (换行)', 11: 'VT', 12: 'FF', 13: 'CR (回车)',
  14: 'SO', 15: 'SI', 16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4',
  21: 'NAK', 22: 'SYN', 23: 'ETB', 24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC',
  28: 'FS', 29: 'GS', 30: 'RS', 31: 'US', 32: '空格', 127: 'DEL'
}
const asciiData = Array.from({ length: 128 }, (_, i) => ({
  dec: i,
  hex: '0x' + i.toString(16).toUpperCase().padStart(2, '0'),
  oct: i.toString(8).padStart(3, '0'),
  bin: i.toString(2).padStart(8, '0'),
  char: (ctrlChars[i] != null || i >= 127) ? '' : String.fromCharCode(i),
  desc: ctrlChars[i] || ''
}))
const filteredAscii = computed(() => {
  const q = asciiSearch.value.toLowerCase()
  if (!q) return asciiData
  return asciiData.filter(d =>
    String(d.dec).includes(q) || d.hex.toLowerCase().includes(q) ||
    d.oct.includes(q) || d.bin.includes(q) ||
    d.char.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)
  )
})

// ===== 字符编码 =====
const charencChar = ref('A')
const charencUtf8 = ref('')
const charencUtf16be = ref('')
const charencUnicode = ref('')
function calcCharEnc() {
  const info = describeCharacter(charencChar.value)
  charencUnicode.value = info?.unicode ?? ''
  charencUtf8.value = info?.utf8 ?? ''
  charencUtf16be.value = info?.utf16be ?? ''
}
watch(charencChar, calcCharEnc, { immediate: true })

const charInput = ref('')
const numInput = ref('')
const numResult = ref('')
const strInput = ref('')
const strOutput = ref('')
const charDec = computed(() => charInput.value ? String(charInput.value.charCodeAt(0)) : '')
const charHex = computed(() => charInput.value ? '0x' + charInput.value.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0') : '')
const charBin = computed(() => charInput.value ? '0b' + charInput.value.charCodeAt(0).toString(2).padStart(8, '0') : '')
function numToChar() {
  const n = parseInt(numInput.value, 10)
  if (isNaN(n) || n < 0 || n > 127) { numResult.value = n > 127 ? '超出范围 (0-127)' : '无效输入'; return }
  if (n >= 32 && n < 127) { numResult.value = String.fromCharCode(n) }
  else { numResult.value = `(控制字符: ${ctrlChars[n] || ''})` }
}
function strToAscii() {
  strOutput.value = strInput.value ? Array.from(strInput.value).map(c => c.charCodeAt(0)).join(' ') : ''
}

// ===== IP地址 =====
const ipv4Input = ref('192.168.1.1')
const ipv6Input = ref('2001:db8::1')
const ipv4Result = ref(null)
const ipv6Result = ref(null)
function calcIpv4() {
  ipv4Result.value = formatIpAddress(ipv4Input.value)
}
function calcIpv6() {
  ipv6Result.value = formatIpAddress(ipv6Input.value)
}
watch(ipv4Input, calcIpv4, { immediate: true })
watch(ipv6Input, calcIpv6, { immediate: true })

function initNow() {
  tsInput.value = String(Math.floor(Date.now() / 1000))
  calcTimestamp()
}
initNow()
</script>

<template>
  <div class="data-converter">
    <h2 class="tool-title">数据转换</h2>

    <div class="tabs" style="flex-wrap:wrap">
      <button v-for="t in tabs" :key="t.id"
        :class="{ active: activeTab === t.id }"
        class="tab-btn" @click="activeTab = t.id">{{ t.name }}</button>
    </div>

    <!-- 进制转换 -->
    <RadixTab v-if="activeTab === 'radix'" />

    <!-- 浮点数 -->
    <FloatTab v-if="activeTab === 'float'" />

    <!-- 位操作 -->
    <div v-if="activeTab === 'bit'" class="card">
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

    <!-- 字节序 -->
    <div v-if="activeTab === 'endian'" class="card">
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

    <!-- Q格式 -->
    <div v-if="activeTab === 'qformat'" class="card">
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

    <!-- BCD码 -->
    <div v-if="activeTab === 'bcd'" class="card">
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

    <!-- 时间戳 -->
    <div v-if="activeTab === 'timestamp'" class="card">
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

    <!-- 字节数组 -->
    <div v-if="activeTab === 'bytearray'" class="card">
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

    <!-- ASCII码表 -->
    <div v-if="activeTab === 'ascii'" class="card">
      <p class="tab-desc">标准 ASCII 码表（0-127），支持按字符、十进制、十六进制搜索。</p>
      <div class="form-row" style="margin-bottom:12px">
        <label>搜索:</label>
        <input v-model="asciiSearch" placeholder="输入字符、十进制、十六进制..." style="flex:1;max-width:280px" />
        <span class="mono" style="color:var(--text-muted)">{{ filteredAscii.length }} / 128</span>
      </div>
      <div style="max-height:58vh;overflow-y:auto">
        <table class="data-table">
          <thead>
            <tr><th>Dec</th><th>Hex</th><th>Oct</th><th>Bin</th><th>字符</th><th>描述</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in filteredAscii" :key="d.dec">
              <td class="mono">{{ d.dec }}</td>
              <td class="mono">{{ d.hex }}</td>
              <td class="mono">{{ d.oct }}</td>
              <td class="mono">{{ d.bin }}</td>
              <td class="mono" style="text-align:center">{{ d.char }}</td>
              <td>{{ d.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 字符编码 -->
    <div v-if="activeTab === 'charenc'">
      <p class="tab-desc" style="margin-bottom:12px">查询字符的 Unicode/UTF-8/UTF-16BE 编码，单字符与 ASCII 码互转，字符串转 ASCII 序列。</p>
      <!-- Unicode/UTF 编码 -->
      <div class="card" style="margin-bottom:12px">
        <h4 style="margin:0 0 10px">Unicode / UTF 编码</h4>
        <div class="form-row">
          <label>字符:</label>
          <input v-model="charencChar" maxlength="2" style="width:80px" />
          <span class="mono">Unicode: {{ charencUnicode }}</span>
        </div>
        <div class="form-row">
          <label>UTF-8:</label>
          <input :value="charencUtf8" readonly class="mono" style="width:300px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(charencUtf8)">复制</button>
        </div>
        <div class="form-row">
          <label>UTF-16BE:</label>
          <input :value="charencUtf16be" readonly class="mono" style="width:300px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(charencUtf16be)">复制</button>
        </div>
      </div>

      <!-- 单字符转换 -->
      <div class="card" style="margin-bottom:12px">
        <h4 style="margin:0 0 10px">单字符转换</h4>
        <div class="form-row">
          <label>字符:</label>
          <input v-model="charInput" maxlength="1" placeholder="输入一个字符" style="width:80px" />
        </div>
        <div class="form-row">
          <label>十进制:</label>
          <input :value="charDec" readonly class="mono" style="width:120px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(charDec)" v-if="charDec">复制</button>
        </div>
        <div class="form-row">
          <label>十六进制:</label>
          <input :value="charHex" readonly class="mono" style="width:140px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(charHex)" v-if="charHex">复制</button>
        </div>
        <div class="form-row">
          <label>二进制:</label>
          <input :value="charBin" readonly class="mono" style="width:180px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(charBin)" v-if="charBin">复制</button>
        </div>
      </div>

      <!-- 数值→字符 + 字符串→ASCII -->
      <div class="card">
        <h4 style="margin:0 0 10px">数值 / 字符串与 ASCII</h4>
        <div class="form-row">
          <label>ASCII码:</label>
          <input v-model="numInput" placeholder="0-127" style="width:80px" />
          <button class="btn btn-primary btn-sm" @click="numToChar">→ 字符</button>
          <input :value="numResult" readonly class="mono" style="width:100px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(numResult)" v-if="numResult">复制</button>
        </div>
        <div class="form-row">
          <label>字符串:</label>
          <input v-model="strInput" placeholder="Hello World" style="width:220px" />
          <button class="btn btn-primary btn-sm" @click="strToAscii">→ ASCII</button>
        </div>
        <div class="form-row">
          <input :value="strOutput" readonly class="mono" style="width:340px;background:var(--bg-secondary)" />
          <button class="copy-btn" @click="copyText(strOutput)" v-if="strOutput">复制</button>
        </div>
      </div>
    </div>

    <!-- IP地址 -->
    <div v-if="activeTab === 'ip'">
      <p class="tab-desc" style="margin-bottom:12px">IPv4/IPv6 地址与整数、十六进制、二进制互转。</p>
      <div class="card" style="margin-bottom:12px">
        <h4 style="margin:0 0 10px;color:var(--text-primary);font-size:14px;font-weight:600">IPv4</h4>
        <div class="form-row">
          <label>地址:</label>
          <input v-model="ipv4Input" placeholder="192.168.1.1" style="width:220px" />
        </div>
        <template v-if="ipv4Result">
          <div class="form-row">
            <label>整数:</label>
            <input :value="ipv4Result.int" readonly class="mono" style="width:180px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv4Result.int)">复制</button>
          </div>
          <div class="form-row">
            <label>Hex:</label>
            <input :value="ipv4Result.hex" readonly class="mono" style="width:160px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv4Result.hex)">复制</button>
          </div>
          <div class="form-row">
            <label>Bin:</label>
            <input :value="ipv4Result.bin" readonly class="mono" style="width:400px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv4Result.bin)">复制</button>
          </div>
        </template>
        <div v-else style="color:#e74c3c;margin-top:8px">无效 IPv4 地址</div>
      </div>

      <div class="card">
        <h4 style="margin:0 0 10px;color:var(--text-primary);font-size:14px;font-weight:600">IPv6</h4>
        <div class="form-row">
          <label>地址:</label>
          <input v-model="ipv6Input" placeholder="2001:db8::1" style="width:320px" />
        </div>
        <template v-if="ipv6Result">
          <div class="form-row">
            <label>整数:</label>
            <input :value="ipv6Result.int" readonly class="mono" style="width:360px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv6Result.int)">复制</button>
          </div>
          <div class="form-row">
            <label>Hex:</label>
            <input :value="ipv6Result.hex" readonly class="mono" style="width:420px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv6Result.hex)">复制</button>
          </div>
          <div class="form-row">
            <label>Bin:</label>
            <input :value="ipv6Result.bin" readonly class="mono" style="width:520px;background:var(--bg-secondary)" />
            <button class="copy-btn" @click="copyText(ipv6Result.bin)">复制</button>
          </div>
        </template>
        <div v-else style="color:#e74c3c;margin-top:8px">无效 IPv6 地址</div>
      </div>
    </div>
  </div>
</template>
