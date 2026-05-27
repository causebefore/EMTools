<script setup>
import { ref, watch, computed, inject } from 'vue'
import RadixTab from './tabs/RadixTab.vue'
import FloatTab from './tabs/FloatTab.vue'
import BitTab from './tabs/BitTab.vue'
import EndianTab from './tabs/EndianTab.vue'
import QformatTab from './tabs/QformatTab.vue'
import BcdTab from './tabs/BcdTab.vue'
import TimestampTab from './tabs/TimestampTab.vue'
import ByteArrayTab from './tabs/ByteArrayTab.vue'
import AsciiTab from './tabs/AsciiTab.vue'
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


// ===== ASCII 控制字符（字符编码 tab 的 numToChar 依赖） =====
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
    <BitTab v-if="activeTab === 'bit'" />

    <!-- 字节序 -->
    <EndianTab v-if="activeTab === 'endian'" />

    <!-- Q格式 -->
    <QformatTab v-if="activeTab === 'qformat'" />

    <!-- BCD码 -->
    <BcdTab v-if="activeTab === 'bcd'" />

    <!-- 时间戳 -->
    <TimestampTab v-if="activeTab === 'timestamp'" />

    <!-- 字节数组 -->
    <ByteArrayTab v-if="activeTab === 'bytearray'" />

    <!-- ASCII码表 -->
    <AsciiTab v-if="activeTab === 'ascii'" />

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
