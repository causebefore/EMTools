# MAP 分析器功能扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MAP 文件分析器新增地址反查、最大符号 Top-N、已删除未使用段统计三个功能

**Architecture:** 三个功能互相独立，顺序实现。前两个纯前端，第三个需修改后端解析器。每个功能独立测试、提交。

**Tech Stack:** Vue 3 Composition API, Node.js (CommonJS), node:test

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/views/MapAnalyzer/index.vue` | 前端界面 | 修改 |
| `public/preload/map_parser.js` | 后端解析器 | 修改 |
| `test/map_parser.test.mjs` | 测试文件 | 修改 |

---

## Task 1: 地址反查功能 - 前端逻辑

**Files:**
- Modify: `src/views/MapAnalyzer/index.vue`
- Modify: `test/map_parser.test.mjs`

- [ ] **Step 1: 编写地址反查算法的失败测试**

```javascript
// test/map_parser.test.mjs
test('findSymbolByAddress 精确匹配', () => {
  const symbols = [
    { name: 'main', address: 0x08001000, size: 0x200, section: '.text' },
    { name: 'printf', address: 0x08002000, size: 0x100, section: '.text' }
  ]
  const result = findSymbolByAddress(symbols, 0x08001100)
  assert.strictEqual(result.name, 'main')
  assert.strictEqual(result.offset, 0x100)
})

test('findSymbolByAddress 降级匹配', () => {
  const symbols = [
    { name: 'main', address: 0x08001000, size: 0, section: '.text' },
    { name: 'printf', address: 0x08002000, size: 0, section: '.text' }
  ]
  const result = findSymbolByAddress(symbols, 0x08001500)
  assert.strictEqual(result.name, 'main')
  assert.strictEqual(result.isApproximate, true)
})

test('findSymbolByAddress 无匹配', () => {
  const result = findSymbolByAddress([], 0x08001000)
  assert.strictEqual(result, null)
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
npm test
```

预期：测试失败，findSymbolByAddress 未定义

- [ ] **Step 3: 在 map_parser.js 中导出 findSymbolByAddress 函数**

```javascript
// public/preload/map_parser.js - 文件末尾添加
function findSymbolByAddress(symbols, targetAddr) {
  // 精确匹配
  for (const sym of symbols) {
    if (sym.size > 0 &&
        sym.address <= targetAddr &&
        targetAddr < sym.address + sym.size) {
      return {
        ...sym,
        offset: targetAddr - sym.address
      }
    }
  }

  // 降级匹配：找最近地址的符号
  let nearest = null
  let minDist = Infinity
  for (const sym of symbols) {
    const dist = Math.abs(sym.address - targetAddr)
    if (dist < minDist) {
      minDist = dist
      nearest = sym
    }
  }

  return nearest ? { ...nearest, offset: targetAddr - nearest.address, isApproximate: true } : null
}

// 在 module.exports 中添加
module.exports = {
  detectFormat,
  parseGCC,
  parseKeil,
  parseIAR,
  findSymbolByAddress  // 新增
}
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
npm test
```

预期：所有测试通过

- [ ] **Step 5: 提交**

```powershell
git add public/preload/map_parser.js test/map_parser.test.mjs
git commit -m "feat(map-analyzer): 添加地址反查算法和测试"
```

---

## Task 2: 地址反查功能 - 前端界面

**Files:**
- Modify: `src/views/MapAnalyzer/index.vue`

- [ ] **Step 1: 添加新的 Tab**

```javascript
// src/views/MapAnalyzer/index.vue
// 修改 tabs 数组
const tabs = ['符号列表', '模块统计', '内存布局图', '模块柱状图', '地址反查']
```

- [ ] **Step 2: 添加地址反查状态变量**

```javascript
// src/views/MapAnalyzer/index.vue - script setup 部分
const addressQuery = ref('')
const addressResult = ref(null)
const addressError = ref('')
```

- [ ] **Step 3: 添加地址反查方法**

```javascript
// src/views/MapAnalyzer/index.vue - script setup 部分
function queryAddress() {
  addressError.value = ''
  addressResult.value = null

  if (!addressQuery.value.trim()) {
    addressError.value = '请输入地址'
    return
  }

  // 解析地址
  let addrStr = addressQuery.value.trim()
  if (addrStr.startsWith('0x') || addrStr.startsWith('0X')) {
    addrStr = addrStr.substring(2)
  }

  const targetAddr = parseInt(addrStr, 16)
  if (isNaN(targetAddr)) {
    addressError.value = '无效的地址格式'
    return
  }

  // 调用查找算法
  const result = window.services.findSymbolByAddress(data.value.symbols, targetAddr)
  if (result) {
    addressResult.value = result
  } else {
    addressError.value = '未找到包含该地址的符号'
  }
}
```

- [ ] **Step 4: 添加地址反查 Tab 内容**

```html
<!-- src/views/MapAnalyzer/index.vue -->
<!-- ========== Tab 5: 地址反查 ========== -->
<div v-show="activeTab === 4" class="tab-content">
  <div class="card" style="padding: 16px;">
    <div class="form-row" style="margin-bottom: 16px;">
      <input
        v-model="addressQuery"
        type="text"
        placeholder="输入十六进制地址 (如 0x08001234)"
        style="flex: 1;"
        @keyup.enter="queryAddress"
      />
      <button class="btn btn-primary" @click="queryAddress">查询</button>
    </div>

    <!-- 错误信息 -->
    <div v-if="addressError" class="error-card" style="padding: 12px; color: #e53935;">
      {{ addressError }}
    </div>

    <!-- 查询结果 -->
    <div v-if="addressResult" class="result-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>符号名称</th>
            <th>起始地址</th>
            <th>大小</th>
            <th>偏移量</th>
            <th>段</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono">{{ addressResult.name }}</td>
            <td class="mono">{{ formatHex(addressResult.address) }}</td>
            <td class="mono">{{ addressResult.size }}</td>
            <td class="mono">{{ formatHex(addressResult.offset) }}</td>
            <td>{{ addressResult.section || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="addressResult.isApproximate" style="margin-top: 8px; color: #FF9800; font-size: 12px;">
        * 降级匹配：地址不在符号范围内，显示最近的符号
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: 运行应用测试界面**

```powershell
npm run dev
```

在浏览器中测试地址反查功能

- [ ] **Step 6: 提交**

```powershell
git add src/views/MapAnalyzer/index.vue
git commit -m "feat(map-analyzer): 添加地址反查界面"
```

---

## Task 3: 最大符号 Top-N 功能 - 前端逻辑

**Files:**
- Modify: `src/views/MapAnalyzer/index.vue`
- Modify: `test/map_parser.test.mjs`

- [ ] **Step 1: 编写 getTopSymbols 的失败测试**

```javascript
// test/map_parser.test.mjs
test('getTopSymbols 正常排序', () => {
  const symbols = [
    { name: 'small', size: 10 },
    { name: 'large', size: 100 },
    { name: 'medium', size: 50 }
  ]
  const result = getTopSymbols(symbols, 20)
  assert.strictEqual(result.length, 3)
  assert.strictEqual(result[0].name, 'large')
  assert.strictEqual(result[0].rank, 1)
  assert.strictEqual(result[1].name, 'medium')
  assert.strictEqual(result[2].name, 'small')
})

test('getTopSymbols 过滤 size=0', () => {
  const symbols = [
    { name: 'valid', size: 100 },
    { name: 'zero', size: 0 }
  ]
  const result = getTopSymbols(symbols, 20)
  assert.strictEqual(result.length, 1)
  assert.strictEqual(result[0].name, 'valid')
})

test('getTopSymbols 不足 20 个', () => {
  const symbols = [
    { name: 'a', size: 10 },
    { name: 'b', size: 20 }
  ]
  const result = getTopSymbols(symbols, 20)
  assert.strictEqual(result.length, 2)
})

test('getTopSymbols 空列表', () => {
  const result = getTopSymbols([], 20)
  assert.deepStrictEqual(result, [])
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
npm test
```

预期：测试失败，getTopSymbols 未定义

- [ ] **Step 3: 在 map_parser.js 中导出 getTopSymbols 函数**

```javascript
// public/preload/map_parser.js - 文件末尾添加
function getTopSymbols(symbols, limit = 20) {
  return symbols
    .filter(sym => sym.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
    .map((sym, idx) => ({
      rank: idx + 1,
      ...sym
    }))
}

// 更新 module.exports
module.exports = {
  detectFormat,
  parseGCC,
  parseKeil,
  parseIAR,
  findSymbolByAddress,
  getTopSymbols  // 新增
}
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
npm test
```

预期：所有测试通过

- [ ] **Step 5: 提交**

```powershell
git add public/preload/map_parser.js test/map_parser.test.mjs
git commit -m "feat(map-analyzer): 添加最大符号 Top-N 算法和测试"
```

---

## Task 4: 最大符号 Top-N 功能 - 前端界面

**Files:**
- Modify: `src/views/MapAnalyzer/index.vue`

- [ ] **Step 1: 添加新的 Tab**

```javascript
// src/views/MapAnalyzer/index.vue
// 修改 tabs 数组
const tabs = ['符号列表', '模块统计', '内存布局图', '模块柱状图', '地址反查', '大符号']
```

- [ ] **Step 2: 添加计算属性**

```javascript
// src/views/MapAnalyzer/index.vue - script setup 部分
const topSymbols = computed(() => {
  if (!data.value?.symbols) return []
  return window.services.getTopSymbols(data.value.symbols, 20)
})
```

- [ ] **Step 3: 添加大符号 Tab 内容**

```html
<!-- src/views/MapAnalyzer/index.vue -->
<!-- ========== Tab 6: 大符号 ========== -->
<div v-show="activeTab === 5" class="tab-content">
  <div class="card" style="padding: 16px;">
    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
      Flash 占用 Top {{ topSymbols.length }} (按符号大小排序)
    </div>
    <div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
      <table class="data-table" style="border: none;">
        <thead>
          <tr>
            <th style="width: 50px;">排名</th>
            <th>符号名称</th>
            <th style="width: 130px;">地址</th>
            <th style="width: 90px;">大小</th>
            <th style="width: 110px;">段</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="topSymbols.length === 0">
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">
              无符号数据
            </td>
          </tr>
          <tr v-for="sym in topSymbols" :key="sym.name + '_' + sym.address">
            <td style="text-align: center; color: var(--text-muted);">{{ sym.rank }}</td>
            <td class="mono" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis;" :title="sym.name">
              {{ sym.name }}
            </td>
            <td class="mono">{{ formatHex(sym.address) }}</td>
            <td class="mono">{{ sym.size }}</td>
            <td>{{ sym.section || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 运行应用测试界面**

```powershell
npm run dev
```

在浏览器中测试大符号功能

- [ ] **Step 5: 提交**

```powershell
git add src/views/MapAnalyzer/index.vue
git commit -m "feat(map-analyzer): 添加大符号 Top-N 界面"
```

---

## Task 5: 未使用段统计功能 - 后端解析

**Files:**
- Modify: `public/preload/map_parser.js`
- Modify: `test/map_parser.test.mjs`

- [ ] **Step 1: 编写 parseRemovedSections 的失败测试**

```javascript
// test/map_parser.test.mjs
test('parseRemovedSections 正常解析 Keil 格式', () => {
  const content = `
Removing Unused input sections from the image.

  Removing startup_stm32f10x_hd.o(HEAP), (512 bytes).
  Removing stm32f10x_adc.o(i.ADC_DeInit), (100 bytes).
  Removing stm32f10x_adc.o(i.ADC_Init), (200 bytes).

  495 unused section(s) (total 18894 bytes) removed from the image.
`
  const result = parseRemovedSections(content)
  assert.strictEqual(result.removedSections.length, 3)
  assert.strictEqual(result.removedSections[0].object, 'startup_stm32f10x_hd.o')
  assert.strictEqual(result.removedSections[0].name, 'HEAP')
  assert.strictEqual(result.removedSections[0].size, 512)
  assert.strictEqual(result.summary.count, 495)
  assert.strictEqual(result.summary.totalSize, 18894)
})

test('parseRemovedSections 无删除段', () => {
  const content = 'Some other content without removed sections'
  const result = parseRemovedSections(content)
  assert.deepStrictEqual(result.removedSections, [])
  assert.strictEqual(result.summary, null)
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
npm test
```

预期：测试失败，parseRemovedSections 未定义

- [ ] **Step 3: 在 map_parser.js 中实现 parseRemovedSections 函数**

```javascript
// public/preload/map_parser.js - 文件末尾添加
function parseRemovedSections(content) {
  const lines = content.split(/\r?\n/)
  const removedSections = []
  let inRemovedSection = false
  let summary = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.includes('Removing Unused input sections')) {
      inRemovedSection = true
      continue
    }

    if (!inRemovedSection) continue

    const removeMatch = trimmed.match(
      /^Removing\s+(\S+)\((\S+)\),\s+\((\d+)\s+bytes\)\.$/
    )
    if (removeMatch) {
      removedSections.push({
        object: removeMatch[1],
        name: removeMatch[2],
        size: parseInt(removeMatch[3], 10)
      })
      continue
    }

    const summaryMatch = trimmed.match(
      /^(\d+)\s+unused section\(s\)\s+\(total\s+(\d+)\s+bytes\)/
    )
    if (summaryMatch) {
      summary = {
        count: parseInt(summaryMatch[1], 10),
        totalSize: parseInt(summaryMatch[2], 10)
      }
      break
    }
  }

  return { removedSections, summary }
}

// 更新 module.exports
module.exports = {
  detectFormat,
  parseGCC,
  parseKeil,
  parseIAR,
  findSymbolByAddress,
  getTopSymbols,
  parseRemovedSections  // 新增
}
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
npm test
```

预期：所有测试通过

- [ ] **Step 5: 提交**

```powershell
git add public/preload/map_parser.js test/map_parser.test.mjs
git commit -m "feat(map-analyzer): 添加未使用段统计解析算法和测试"
```

---

## Task 6: 未使用段统计功能 - 前端界面

**Files:**
- Modify: `src/views/MapAnalyzer/index.vue`

- [ ] **Step 1: 添加新的 Tab**

```javascript
// src/views/MapAnalyzer/index.vue
// 修改 tabs 数组
const tabs = ['符号列表', '模块统计', '内存布局图', '模块柱状图', '地址反查', '大符号', '死代码']
```

- [ ] **Step 2: 添加计算属性**

```javascript
// src/views/MapAnalyzer/index.vue - script setup 部分
const groupedRemovedSections = computed(() => {
  if (!data.value?.removedSections) return []

  const groups = {}
  for (const sec of data.value.removedSections) {
    if (!groups[sec.object]) {
      groups[sec.object] = []
    }
    groups[sec.object].push(sec)
  }

  return Object.entries(groups).map(([object, sections]) => ({
    object,
    sections,
    totalSize: sections.reduce((sum, s) => sum + s.size, 0)
  }))
})
```

- [ ] **Step 3: 添加死代码 Tab 内容**

```html
<!-- src/views/MapAnalyzer/index.vue -->
<!-- ========== Tab 7: 死代码 ========== -->
<div v-show="activeTab === 6" class="tab-content">
  <div class="card" style="padding: 16px;">
    <!-- 统计卡片 -->
    <div style="display: flex; gap: 20px; margin-bottom: 16px;">
      <div class="card" style="padding: 12px 16px; flex: 1; text-align: center;">
        <div style="font-size: 12px; color: var(--text-muted);">删除段数量</div>
        <div style="font-size: 18px; font-weight: 700; color: #4CAF50; margin-top: 4px;">
          {{ data.removedSections?.length || 0 }}
        </div>
      </div>
      <div class="card" style="padding: 12px 16px; flex: 1; text-align: center;">
        <div style="font-size: 12px; color: var(--text-muted);">总字节数</div>
        <div style="font-size: 18px; font-weight: 700; color: #FF9800; margin-top: 4px;">
          {{ formatSize(data.removedSummary?.totalSize || 0) }}
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <div v-if="groupedRemovedSections.length > 0" style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
      <table class="data-table" style="border: none;">
        <thead>
          <tr>
            <th style="text-align: left; min-width: 180px;">对象文件</th>
            <th style="text-align: left; min-width: 150px;">段名</th>
            <th style="text-align: right;">大小</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedRemovedSections" :key="group.object">
            <tr v-for="(sec, idx) in group.sections" :key="sec.name + '_' + idx">
              <td v-if="idx === 0" :rowspan="group.sections.length" class="mono">
                {{ group.object }}
                <div style="font-size: 11px; color: var(--text-muted);">
                  合计: {{ formatSize(group.totalSize) }}
                </div>
              </td>
              <td class="mono">{{ sec.name }}</td>
              <td class="mono" style="text-align: right;">{{ formatSize(sec.size) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-else style="text-align: center; color: var(--text-muted); padding: 40px;">
      无删除段数据（仅支持 Keil 格式）
    </div>
  </div>
</div>
```

- [ ] **Step 4: 运行应用测试界面**

```powershell
npm run dev
```

在浏览器中测试死代码功能（需要 Keil 格式的 MAP 文件）

- [ ] **Step 5: 提交**

```powershell
git add src/views/MapAnalyzer/index.vue
git commit -m "feat(map-analyzer): 添加死代码统计界面"
```

---

## Task 7: 集成测试和最终验证

**Files:**
- None (手动测试)

- [ ] **Step 1: 运行所有单元测试**

```powershell
npm test
```

预期：所有测试通过

- [ ] **Step 2: 运行应用进行手动测试**

```powershell
npm run dev
```

测试清单：
1. 地址反查：输入 0x 前缀地址，验证精确匹配和降级匹配
2. 大符号：验证 Top-20 排序正确，过滤 size=0
3. 死代码：加载 Keil MAP 文件，验证解析和显示

- [ ] **Step 3: 构建生产版本**

```powershell
npm run build
```

预期：构建成功，无错误

- [ ] **Step 4: 最终提交**

```powershell
git add -A
git commit -m "feat(map-analyzer): 完成地址反查、大符号、死代码三个功能"
```

---

## 工作量估算

| Task | 描述 | 预估时间 |
|------|------|----------|
| Task 1 | 地址反查算法 + 测试 | 10 分钟 |
| Task 2 | 地址反查界面 | 15 分钟 |
| Task 3 | 大符号算法 + 测试 | 10 分钟 |
| Task 4 | 大符号界面 | 15 分钟 |
| Task 5 | 未使用段解析 + 测试 | 15 分钟 |
| Task 6 | 未使用段界面 | 15 分钟 |
| Task 7 | 集成测试和验证 | 10 分钟 |
| **总计** | | **~90 分钟** |
