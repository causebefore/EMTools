<script setup>
import { ref } from 'vue'
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
import IpTab from './tabs/IpTab.vue'

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
    <IpTab v-if="activeTab === 'ip'" />
  </div>
</template>
