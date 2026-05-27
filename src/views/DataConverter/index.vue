<script setup>
import { ref, watch, inject } from 'vue'
import RadixTab from './tabs/RadixTab.vue'
import FloatTab from './tabs/FloatTab.vue'
import BitTab from './tabs/BitTab.vue'
import EndianTab from './tabs/EndianTab.vue'
import QformatTab from './tabs/QformatTab.vue'
import BcdTab from './tabs/BcdTab.vue'
import TimestampTab from './tabs/TimestampTab.vue'
import ByteArrayTab from './tabs/ByteArrayTab.vue'
import AsciiTab from './tabs/AsciiTab.vue'
import CharEncTab from './tabs/CharEncTab.vue'
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
    <CharEncTab v-if="activeTab === 'charenc'" />

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
