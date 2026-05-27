<script setup>
import { ref, watch, computed, inject } from 'vue'
import { describeCharacter } from '../../../utils/charenc.js'

const copyText = inject('copyText', () => {})

const ctrlChars = {
  0: 'NUL (空)', 1: 'SOH', 2: 'STX', 3: 'ETX', 4: 'EOT', 5: 'ENQ', 6: 'ACK', 7: 'BEL',
  8: 'BS', 9: 'HT (Tab)', 10: 'LF (换行)', 11: 'VT', 12: 'FF', 13: 'CR (回车)',
  14: 'SO', 15: 'SI', 16: 'DLE', 17: 'DC1', 18: 'DC2', 19: 'DC3', 20: 'DC4',
  21: 'NAK', 22: 'SYN', 23: 'ETB', 24: 'CAN', 25: 'EM', 26: 'SUB', 27: 'ESC',
  28: 'FS', 29: 'GS', 30: 'RS', 31: 'US', 32: '空格', 127: 'DEL'
}

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
</script>

<template>
  <div>
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
</template>
