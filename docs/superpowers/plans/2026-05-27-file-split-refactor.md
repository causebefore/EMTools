# 文件拆分重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三个大文件（DataConverter、HexTool、map_parser）拆分为小的、单一职责的模块，提高可维护性。

**Architecture:** 扁平拆分 — 每个功能 tab 变成独立 `.vue` 组件或 `.js` 模块，主文件仅保留入口/切换逻辑。通过 `provide/inject` 共享状态。

**Tech Stack:** Vue 3 Composition API, Vite, CommonJS (preload)

---

## Phase 1: 分支创建

### Task 0: 创建功能分支

**Files:**
- 无新建/修改

- [ ] **Step 1: 从 dev 创建分支**

```powershell
git checkout dev
git pull origin dev
git checkout -b refactor/file-split
```

- [ ] **Step 2: 确认分支状态**

```powershell
git branch --show-header
```

Expected: `refactor/file-split`

---

## Phase 2: DataConverter 拆分（11 个 Tab）

### Task 1: 创建 RadixTab.vue（进制转换）

**Files:**
- Create: `src/views/DataConverter/tabs/RadixTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 tabs 目录**

```powershell
mkdir src\views\DataConverter\tabs
```

- [ ] **Step 2: 创建 RadixTab.vue**

从 `index.vue` 提取进制转换相关代码（原文件第 30-44 行 script + 第 291-311 行 template）：

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { convertRadix, RADIX_NAMES } from '../../../utils/radix.js'

const copyText = inject('copyText', () => {})

const radixInput = ref('255')
const radixFrom = ref(10)
const radixResults = ref({})

function calcRadixAll() {
  const results = {}
  for (let r = 2; r <= 36; r++) {
    results[r] = convertRadix(radixInput.value, radixFrom.value, r)
  }
  radixResults.value = results
}
watch([radixInput, radixFrom], calcRadixAll, { immediate: true })

const commonRadices = [2, 8, 10, 16]
</script>

<template>
  <div class="card">
    <p class="tab-desc">在任意进制间转换数值，支持二进制到三十六进制。</p>
    <div class="form-row">
      <label>输入值:</label>
      <input v-model="radixInput" class="mono" style="flex:1;max-width:300px" />
      <select v-model.number="radixFrom" style="width:140px">
        <option v-for="r in commonRadices" :key="r" :value="r">{{ RADIX_NAMES[r] }}</option>
        <option :value="36">三十六进制</option>
      </select>
    </div>
    <table class="data-table" style="max-width:500px">
      <thead><tr><th>进制</th><th>值</th><th></th></tr></thead>
      <tbody>
        <tr v-for="r in commonRadices" :key="r">
          <td>{{ RADIX_NAMES[r] }}</td>
          <td class="mono">{{ radixResults[r] }}</td>
          <td><button class="copy-btn" @click="copyText(radixResults[r])">复制</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 3: 更新 index.vue — 添加 import 和模板引用**

在 `index.vue` 的 `<script setup>` 中添加：
```js
import RadixTab from './tabs/RadixTab.vue'
```

将原 template 中第 291-311 行（`<!-- 进制转换 -->` 块）替换为：
```vue
<RadixTab v-if="activeTab === 'radix'" />
```

- [ ] **Step 4: 删除 index.vue 中已迁移的 script 代码**

删除原文件第 30-44 行（`// ===== 进制转换 =====` 段）的 ref、watch、function 定义。

- [ ] **Step 5: 运行测试**

```powershell
npm test
```

- [ ] **Step 6: 提交**

```powershell
git add src/views/DataConverter/tabs/RadixTab.vue src/views/DataConverter/index.vue
git commit -m "refactor(data-converter): 提取 RadixTab 组件"
```

---

### Task 2: 创建 FloatTab.vue（浮点数）

**Files:**
- Create: `src/views/DataConverter/tabs/FloatTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 FloatTab.vue**

从 `index.vue` 提取浮点数相关代码（原文件第 46-70 行 script + 第 314-348 行 template）：

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { hexToFloat, floatToHex, hexToDouble, doubleToHex, decomposeFloat, decomposeDouble } from '../../../utils/ieee754.js'

const copyText = inject('copyText', () => {})

const floatHex = ref('40490FDB')
const floatType = ref('single')
const floatResult = ref('')
const floatDecompose = ref(null)

function calcFloat() {
  if (floatType.value === 'single') {
    const f = hexToFloat(floatHex.value)
    floatResult.value = f !== null ? String(f) : '无效Hex'
    floatDecompose.value = decomposeFloat(floatHex.value)
  } else {
    const d = hexToDouble(floatHex.value)
    floatResult.value = d !== null ? String(d) : '无效Hex'
    floatDecompose.value = decomposeDouble(floatHex.value)
  }
}
const floatToHexInput = ref('3.14159')
const floatToHexResult = ref('')
function calcFloatToHex() {
  const f = parseFloat(floatToHexInput.value)
  if (isNaN(f)) { floatToHexResult.value = '无效'; return }
  floatToHexResult.value = floatType.value === 'single' ? floatToHex(f) : doubleToHex(f)
}
watch([floatHex, floatType], calcFloat, { immediate: true })
</script>

<template>
  <div class="card">
    <p class="tab-desc">IEEE 754 单精度/双精度浮点数与十六进制互转，查看符号/指数/尾数分解。</p>
    <!-- 完整模板从 index.vue 第 314-348 行移入 -->
    <div class="form-row">
      <label>Hex:</label>
      <input v-model="floatHex" class="mono" placeholder="40490FDB" />
      <select v-model="floatType">
        <option value="single">单精度 (32位)</option>
        <option value="double">双精度 (64位)</option>
      </select>
    </div>
    <div class="form-row">
      <label>浮点值:</label>
      <input :value="floatResult" readonly class="mono" style="background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(floatResult)">复制</button>
    </div>
    <div v-if="floatDecompose" style="margin-top:8px">
      <div class="mono" style="font-size:11px;color:var(--text-secondary);line-height:1.6">
        <div>符号: {{ floatDecompose.sign }} ({{ floatDecompose.signVal }})</div>
        <div>指数: {{ floatDecompose.exponent }} ({{ floatDecompose.expVal >= 0 ? '+' : '' }}{{ floatDecompose.expVal }})</div>
        <div v-if="floatType === 'single'">尾数: 0x{{ floatDecompose.mantissa.toString(16).padStart(6,'0').toUpperCase() }}</div>
        <div v-else>尾数高32: 0x{{ floatDecompose.mantissaHigh.toString(16).padStart(5,'0').toUpperCase() }} | 尾数低32: 0x{{ floatDecompose.mantLow.toString(16).padStart(8,'0').toUpperCase() }}</div>
      </div>
    </div>
    <hr style="border-color:var(--border);margin:10px 0" />
    <div class="form-row">
      <label>浮点→:</label>
      <input v-model="floatToHexInput" placeholder="3.14159" />
      <button class="btn btn-primary btn-sm" @click="calcFloatToHex">转换</button>
    </div>
    <div class="form-row">
      <label>Hex:</label>
      <input :value="floatToHexResult" readonly class="mono" style="background:var(--bg-secondary)" />
      <button class="copy-btn" @click="copyText(floatToHexResult)">复制</button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 更新 index.vue**

添加 `import FloatTab from './tabs/FloatTab.vue'`，将第 314-348 行 template 替换为 `<FloatTab v-if="activeTab === 'float'" />`，删除第 46-70 行 script。

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 FloatTab 组件"
```

---

### Task 3: 创建 BitTab.vue（位操作）

**Files:**
- Create: `src/views/DataConverter/tabs/BitTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 BitTab.vue**

从 `index.vue` 提取位操作代码（第 72-104 行 script + 第 350-406 行 template）。BitTab 使用 `bitops.js` 的 12 个函数。模板包含操作数输入、二进制展示、位运算结果表、移位控制、位段提取。

组件 script 开头：
```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { bitAnd, bitOr, bitXor, bitNot, bitShl, bitShr, bitTest, bitSet, bitClear, bitToggle, bitExtract, formatBits } from '../../../utils/bitops.js'

const copyText = inject('copyText', () => {})
// ... 将第 73-104 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

添加 import，替换 template（第 350-406 行），删除 script（第 72-104 行）。

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 BitTab 组件"
```

---

### Task 4: 创建 EndianTab.vue（字节序）

**Files:**
- Create: `src/views/DataConverter/tabs/EndianTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 EndianTab.vue**

从 `index.vue` 提取字节序代码（第 106-120 行 script + 第 408-424 行 template）。

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { swap16, swap32, swap64, reverseBytes } from '../../../utils/endian.js'

const copyText = inject('copyText', () => {})
// ... 将第 107-120 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue** — import + template + 删除 script

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 EndianTab 组件"
```

---

### Task 5: 创建 QformatTab.vue（Q格式）

**Files:**
- Create: `src/views/DataConverter/tabs/QformatTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 QformatTab.vue**

从 `index.vue` 提取 Q 格式代码（第 122-150 行 script + 第 426-454 行 template）。

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { floatToQ, qToFloat, qToHex, qRange } from '../../../utils/qformat.js'

const copyText = inject('copyText', () => {})
// ... 将第 123-150 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 QformatTab 组件"
```

---

### Task 6: 创建 BcdTab.vue（BCD码）

**Files:**
- Create: `src/views/DataConverter/tabs/BcdTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 BcdTab.vue**

从 `index.vue` 提取 BCD 代码（第 152-161 行 script + 第 456-475 行 template）。

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { hexToBcd, bcdToHex } from '../../../utils/bcd.js'

const copyText = inject('copyText', () => {})
// ... 将第 153-161 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 BcdTab 组件"
```

---

### Task 7: 创建 TimestampTab.vue（时间戳）

**Files:**
- Create: `src/views/DataConverter/tabs/TimestampTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 TimestampTab.vue**

从 `index.vue` 提取时间戳代码（第 163-185 行 script + 第 477-503 行 template）。注意 `initNow()` 调用需移入组件的顶层。

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { timestampToDate, dateToTimestamp } from '../../../utils/timestamp.js'

const copyText = inject('copyText', () => {})
// ... 将第 164-185 行全部移入
// 包含 switchTsUnit, setTsNow, calcTimestamp, calcDateToTs 函数

// 初始化
const tsInput = ref(String(Math.floor(Date.now() / 1000)))
calcTimestamp()
</script>
```

- [ ] **Step 2: 更新 index.vue**

添加 import，替换 template（第 477-503 行），删除 script（第 163-185 行 + 第 273-277 行 `initNow()` 调用）。

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 TimestampTab 组件"
```

---

### Task 8: 创建 ByteArrayTab.vue（字节数组）

**Files:**
- Create: `src/views/DataConverter/tabs/ByteArrayTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 ByteArrayTab.vue**

从 `index.vue` 提取字节数组代码（第 187-199 行 script + 第 505-517 行 template）。

```vue
<script setup>
import { ref, inject } from 'vue'

const copyText = inject('copyText', () => {})
// ... 将第 188-199 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 ByteArrayTab 组件"
```

---

### Task 9: 创建 AsciiTab.vue（ASCII码表）

**Files:**
- Create: `src/views/DataConverter/tabs/AsciiTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 AsciiTab.vue**

从 `index.vue` 提取 ASCII 码表代码（第 201-226 行 script + 第 519-544 行 template）。注意 `ctrlChars` 和 `asciiData` 是模块级常量，`filteredAscii` 是 computed。

```vue
<script setup>
import { ref, computed } from 'vue'

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
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 AsciiTab 组件"
```

---

### Task 10: 创建 CharEncTab.vue（字符编码）

**Files:**
- Create: `src/views/DataConverter/tabs/CharEncTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 CharEncTab.vue**

从 `index.vue` 提取字符编码代码（第 228-257 行 script + 第 546-613 行 template）。注意 `ctrlChars` 需要在此组件中重新定义（或从共享模块导入），因为 `numToChar()` 函数使用了它。

```vue
<script setup>
import { ref, watch, computed, inject } from 'vue'
import { describeCharacter } from '../../../utils/charenc.js'

const copyText = inject('copyText', () => {})

// ctrlChars 需在此定义（用于 numToChar）
const ctrlChars = {
  0: 'NUL (空)', 1: 'SOH', 2: 'STX', /* ... 同 AsciiTab ... */
}

// ... 将第 229-257 行全部移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 CharEncTab 组件"
```

---

### Task 11: 创建 IpTab.vue（IP地址）

**Files:**
- Create: `src/views/DataConverter/tabs/IpTab.vue`
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 创建 IpTab.vue**

从 `index.vue` 提取 IP 地址代码（第 259-271 行 script + 第 615-669 行 template）。

```vue
<script setup>
import { ref, watch, inject } from 'vue'
import { formatIpAddress } from '../../../utils/ip.js'

const copyText = inject('copyText', () => {})

const ipv4Input = ref('192.168.1.1')
const ipv6Input = ref('2001:db8::1')
const ipv4Result = ref(null)
const ipv6Result = ref(null)
function calcIpv4() { ipv4Result.value = formatIpAddress(ipv4Input.value) }
function calcIpv6() { ipv6Result.value = formatIpAddress(ipv6Input.value) }
watch(ipv4Input, calcIpv4, { immediate: true })
watch(ipv6Input, calcIpv6, { immediate: true })
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 提取 IpTab 组件"
```

---

### Task 12: 清理 DataConverter/index.vue

**Files:**
- Modify: `src/views/DataConverter/index.vue`

- [ ] **Step 1: 确认 index.vue 仅剩 tab 切换逻辑**

此时 `index.vue` 应该只剩：
```vue
<script setup>
import { ref, inject } from 'vue'
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
    <RadixTab v-if="activeTab === 'radix'" />
    <FloatTab v-if="activeTab === 'float'" />
    <BitTab v-if="activeTab === 'bit'" />
    <EndianTab v-if="activeTab === 'endian'" />
    <QformatTab v-if="activeTab === 'qformat'" />
    <BcdTab v-if="activeTab === 'bcd'" />
    <TimestampTab v-if="activeTab === 'timestamp'" />
    <ByteArrayTab v-if="activeTab === 'bytearray'" />
    <AsciiTab v-if="activeTab === 'ascii'" />
    <CharEncTab v-if="activeTab === 'charenc'" />
    <IpTab v-if="activeTab === 'ip'" />
  </div>
</template>
```

- [ ] **Step 2: 运行完整测试**

```powershell
npm test
```

- [ ] **Step 3: 提交**

```powershell
git add src/views/DataConverter/
git commit -m "refactor(data-converter): 清理 index.vue，仅保留 tab 切换"
```

---

## Phase 3: HexTool 拆分（3 个 Tab）

### Task 13: 创建 EditorTab.vue（Hex编辑器）

**Files:**
- Create: `src/views/HexTool/tabs/EditorTab.vue`
- Modify: `src/views/HexTool/index.vue`

- [ ] **Step 1: 创建 tabs 目录**

```powershell
mkdir src\views\HexTool\tabs
```

- [ ] **Step 2: 创建 EditorTab.vue**

从 `index.vue` 提取编辑器相关代码（第 24-34 行 ref + 第 362-421 行函数 + 第 587-616 行 template）。EditorTab 通过 `inject('hexState')` 获取共享状态。

```vue
<script setup>
import { ref, inject } from 'vue'
import HexViewer from '../../../components/HexViewer.vue'
import { searchHex, searchAscii } from '../../../utils/hextools.js'
import { parseFirmwareBytes, replaceByte } from '../../../utils/hex_filetools.js'

const { fileData, fileBaseAddr } = inject('hexState')
const copyText = inject('copyText', () => {})

const hexViewer = ref(null)
const searchPattern = ref('')
const searchType = ref('hex')
const searchResults = ref([])
const currentSearchIdx = ref(-1)
const gotoAddr = ref('')

// ... 将 doSearch, findNext, findPrev, doGoto, handleDataChanged 函数移入
</script>

<template>
  <div style="display:flex;flex-direction:column;height:calc(100vh - 140px)">
    <!-- 搜索栏 + HexViewer 从原第 588-616 行移入 -->
  </div>
</template>
```

- [ ] **Step 3: 更新 index.vue**

添加 provide：
```js
import { provide } from 'vue'
const hexState = { fileData, filePath, fileBaseAddr, fileFormat }
provide('hexState', hexState)
```

替换 template 中编辑器部分为 `<EditorTab v-if="activeTab === 'editor'" />`。

- [ ] **Step 4: 运行测试并提交**

```powershell
npm test
git add src/views/HexTool/
git commit -m "refactor(hex-tool): 提取 EditorTab 组件"
```

---

### Task 14: 创建 FiletoolsTab.vue（文件工具）

**Files:**
- Create: `src/views/HexTool/tabs/FiletoolsTab.vue`
- Modify: `src/views/HexTool/index.vue`

- [ ] **Step 1: 创建 FiletoolsTab.vue**

从 `index.vue` 提取文件工具代码（第 36-53 行 ref + 第 424-565 行函数 + 第 619-699 行 template + 第 866-973 行 style）。

包含：格式转换、文件切片、文件填充三个子功能。通过 `inject('hexState')` 获取共享文件状态。`formatSize`、`formatAddr`、`formatRange` 辅助函数也需移入。

```vue
<script setup>
import { ref, computed, inject } from 'vue'
import { buildFillPreview, buildSlicePreview, convertFirmware, fillBuffer, sliceBuffer, parseFirmwareBytes, parseNumericText } from '../../../utils/hex_filetools.js'

const copyText = inject('copyText', () => {})
// ... ref 定义 + 函数从原文件移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/HexTool/
git commit -m "refactor(hex-tool): 提取 FiletoolsTab 组件"
```

---

### Task 15: 创建 MergeTab.vue（文件合并）

**Files:**
- Create: `src/views/HexTool/tabs/MergeTab.vue`
- Modify: `src/views/HexTool/index.vue`

- [ ] **Step 1: 创建 MergeTab.vue**

从 `index.vue` 提取文件合并代码（第 49-53 行 ref + 第 54-361 行合并相关变量/函数 + 第 495-557 行 doMerge + 第 701-861 行 template + 第 974-1338 行 style）。这是最大的 tab，包含 MiniMap、拖拽排序、冲突检测等。

```vue
<script setup>
import { ref, computed, nextTick, inject, onUnmounted } from 'vue'
import { convertFirmware, mergeFirmwareSegments, parseFirmwareBytes, parseNumericText } from '../../../utils/hex_filetools.js'
import { createMergePreviewModel } from '../../../utils/merge_preview.js'

const copyText = inject('copyText', () => {})
// ... 所有合并相关 ref、computed、函数移入
</script>
```

- [ ] **Step 2: 更新 index.vue**

- [ ] **Step 3: 运行测试并提交**

```powershell
npm test
git add src/views/HexTool/
git commit -m "refactor(hex-tool): 提取 MergeTab 组件"
```

---

### Task 16: 清理 HexTool/index.vue

**Files:**
- Modify: `src/views/HexTool/index.vue`

- [ ] **Step 1: 确认 index.vue 结构**

此时 `index.vue` 应该只剩：
- 共享状态 ref（filePath, fileData, fileBaseAddr, fileFormat）
- provide('hexState', ...)
- activeTab + tab 按钮
- openFile / saveFile 函数（文件加载是编辑器前置操作，留在主文件）
- 三个 tab 组件的 import 和 v-if 切换

- [ ] **Step 2: 运行完整测试**

```powershell
npm test
```

- [ ] **Step 3: 提交**

```powershell
git add src/views/HexTool/
git commit -m "refactor(hex-tool): 清理 index.vue，仅保留共享状态和 tab 切换"
```

---

## Phase 4: map_parser.js 拆分

### Task 17: 创建 map_parser/gcc.js

**Files:**
- Create: `public/preload/map_parser/gcc.js`

- [ ] **Step 1: 创建目录**

```powershell
mkdir public\preload\map_parser
```

- [ ] **Step 2: 创建 gcc.js**

从 `map_parser.js` 提取 `parseGCC` 函数（第 46-244 行）+ 相关辅助函数（`classifySection`、`moduleNameFromTail`、`addModuleContribution`、`sectionCategory`）。

```js
/**
 * GCC/ARM LD MAP 文件解析器
 */

function parseGCC(content) {
  // ... 第 46-244 行代码完整移入
}

function classifySection(name, address, memoryRegions) {
  // ... 第 713-744 行
}

function moduleNameFromTail(tail) {
  // ... 第 746-749 行
}

function addModuleContribution(modules, tail, sectionName, size, currentSection) {
  // ... 第 752-775 行
}

function sectionCategory(name, section) {
  // ... 第 777-787 行
}

module.exports = { parseGCC }
```

- [ ] **Step 3: 运行测试**

```powershell
node --test test/map_parser.test.mjs
```

- [ ] **Step 4: 提交**

```powershell
git add public/preload/map_parser/gcc.js
git commit -m "refactor(map-parser): 提取 GCC 解析器到独立模块"
```

---

### Task 18: 创建 map_parser/keil.js

**Files:**
- Create: `public/preload/map_parser/keil.js`

- [ ] **Step 1: 创建 keil.js**

从 `map_parser.js` 提取 `parseKeil` 函数（第 255-507 行）。

```js
/**
 * Keil MDK MAP 文件解析器
 */

function parseKeil(content) {
  // ... 第 255-507 行代码完整移入
}

module.exports = { parseKeil }
```

- [ ] **Step 2: 运行测试并提交**

```powershell
node --test test/map_parser.test.mjs
git add public/preload/map_parser/keil.js
git commit -m "refactor(map-parser): 提取 Keil 解析器到独立模块"
```

---

### Task 19: 创建 map_parser/iar.js

**Files:**
- Create: `public/preload/map_parser/iar.js`

- [ ] **Step 1: 创建 iar.js**

从 `map_parser.js` 提取 `parseIAR` 函数（第 518-693 行）+ `parseIARNumber` 辅助函数（第 705-711 行）。

```js
/**
 * IAR MAP 文件解析器
 */

function parseIAR(content) {
  // ... 第 518-693 行代码完整移入
}

function parseIARNumber(str) {
  // ... 第 705-711 行
}

module.exports = { parseIAR }
```

- [ ] **Step 2: 运行测试并提交**

```powershell
node --test test/map_parser.test.mjs
git add public/preload/map_parser/iar.js
git commit -m "refactor(map-parser): 提取 IAR 解析器到独立模块"
```

---

### Task 20: 重写 map_parser.js 入口

**Files:**
- Modify: `public/preload/map_parser.js`

- [ ] **Step 1: 重写 map_parser.js**

保留 `detectFormat`（第 17-35 行）、`computeTotals`（第 796-867 行）、`inferMemoryRegions`（第 875-904 行）、`nextPow2`（第 912-918 行）、`parse` 入口（第 929-955 行），其余替换为 require：

```js
/**
 * MAP 文件解析器
 * 支持 GCC/ARM LD、Keil MDK、IAR 三种编译器格式
 * 自动检测格式并返回统一 JSON 结果
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { parseGCC } = require('./map_parser/gcc')
const { parseKeil } = require('./map_parser/keil')
const { parseIAR } = require('./map_parser/iar')

// === detectFormat 保留（第 17-35 行） ===

// === computeTotals 保留（第 796-867 行） ===
// 注意：此函数被各解析器内部调用，需导出或移入各解析器
// 方案：将 computeTotals 和 inferMemoryRegions 移入公共模块

// === parse 入口（第 929-955 行） ===
function parse(content) {
  // ... 不变
}

module.exports = { parse, detectFormat }
```

- [ ] **Step 2: 处理公共辅助函数**

`computeTotals` 和 `inferMemoryRegions` 被三个解析器共用。创建 `public/preload/map_parser/utils.js`：

```js
// 从 map_parser.js 提取 computeTotals（第 796-867 行）和 inferMemoryRegions（第 875-904 行）和 nextPow2（第 912-918 行）
module.exports = { computeTotals, inferMemoryRegions, nextPow2 }
```

各解析器文件中 `require('./utils')` 引入。

- [ ] **Step 3: 运行完整测试**

```powershell
node --test test/map_parser.test.mjs
```

- [ ] **Step 4: 提交**

```powershell
git add public/preload/
git commit -m "refactor(map-parser): 重写入口文件，引入子模块"
```

---

## Phase 5: 最终验证

### Task 21: 全量测试与验证

- [ ] **Step 1: 运行所有测试**

```powershell
npm test
```

Expected: 所有测试通过

- [ ] **Step 2: 构建验证**

```powershell
npm run build
```

Expected: 构建成功，无错误

- [ ] **Step 3: 提交最终状态**

```powershell
git add -A
git commit -m "refactor: 文件拆分重构完成，所有测试通过"
```

---

## 文件变更汇总

| 操作 | 文件 |
|------|------|
| Create | `src/views/DataConverter/tabs/RadixTab.vue` |
| Create | `src/views/DataConverter/tabs/FloatTab.vue` |
| Create | `src/views/DataConverter/tabs/BitTab.vue` |
| Create | `src/views/DataConverter/tabs/EndianTab.vue` |
| Create | `src/views/DataConverter/tabs/QformatTab.vue` |
| Create | `src/views/DataConverter/tabs/BcdTab.vue` |
| Create | `src/views/DataConverter/tabs/TimestampTab.vue` |
| Create | `src/views/DataConverter/tabs/ByteArrayTab.vue` |
| Create | `src/views/DataConverter/tabs/AsciiTab.vue` |
| Create | `src/views/DataConverter/tabs/CharEncTab.vue` |
| Create | `src/views/DataConverter/tabs/IpTab.vue` |
| Create | `src/views/HexTool/tabs/EditorTab.vue` |
| Create | `src/views/HexTool/tabs/FiletoolsTab.vue` |
| Create | `src/views/HexTool/tabs/MergeTab.vue` |
| Create | `public/preload/map_parser/gcc.js` |
| Create | `public/preload/map_parser/keil.js` |
| Create | `public/preload/map_parser/iar.js` |
| Create | `public/preload/map_parser/utils.js` |
| Modify | `src/views/DataConverter/index.vue` |
| Modify | `src/views/HexTool/index.vue` |
| Modify | `public/preload/map_parser.js` |
