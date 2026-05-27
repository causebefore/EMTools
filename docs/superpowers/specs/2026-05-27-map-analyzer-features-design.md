# MAP 分析器功能扩展设计文档

## 概述

为 MAP 文件分析器新增三个功能：
1. 地址反查 - 输入地址定位符号
2. 最大符号 Top-N - 按大小排序符号
3. 已删除未使用段统计 - 展示链接器优化掉的死代码

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 界面布局 | 新增 Tab | 清晰分离，不干扰现有界面 |
| 地址查询方式 | 单地址查询 | 简单直观，满足调试需求 |
| Top-N 数量 | 固定 Top-20 | 界面统一，覆盖主要场景 |
| 测试覆盖 | 完整测试 | 每个功能都有单元测试 |

## 实施方案

采用顺序实现，每个功能独立完成、测试、提交。

---

## 功能 1：地址反查

### 界面设计

新增 Tab "地址反查"：
- 输入框：十六进制地址（支持 0x 前缀）
- 查询按钮
- 结果表格：符号名、起始地址、大小、偏移量、所属段

### 算法逻辑

```javascript
function findSymbolByAddress(symbols, targetAddr) {
  // 1. 精确匹配：symbol.address <= target < symbol.address + symbol.size
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

  // 2. 降级匹配：找最近地址的符号（针对 GCC size=0 的情况）
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
```

### 格式支持

| 格式 | 精确度 | 说明 |
|------|--------|------|
| Keil | 精确 | 符号都有 address + size |
| IAR | 精确 | 符号都有 address + size |
| GCC | 降级 | 部分符号 size=0，只能找最近符号 |

### 测试用例

1. 精确匹配：地址在符号范围内，返回正确符号和偏移量
2. 降级匹配：地址不在任何符号范围内，返回最近符号
3. 无匹配：符号列表为空，返回 null
4. 边界情况：地址恰好在符号起始/结束位置
5. 格式验证：支持 0x 前缀，支持大小写

---

## 功能 2：最大符号 Top-N

### 界面设计

新增 Tab "大符号"：
- 标题：Flash 占用 Top 20（按符号大小排序）
- 表格：排名、符号名、地址、大小、段
- 可复用现有模块柱状图的条形图样式

### 算法逻辑

```javascript
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
```

### 格式支持

| 格式 | 支持度 | 说明 |
|------|--------|------|
| Keil | 完整 | 所有符号有 size |
| IAR | 完整 | 所有符号有 size |
| GCC | 部分 | size=0 的符号会被过滤掉 |

### 测试用例

1. 正常排序：符号按 size 降序排列
2. 过滤 size=0：确保只显示有大小的符号
3. 不足 20 个：符号数量不足时，显示所有
4. 空符号列表：返回空数组
5. 大小相同：稳定排序，保持原始顺序

---

## 功能 3：已删除未使用段统计

### 界面设计

新增 Tab "死代码"：
- 顶部统计卡片：删除段数量 + 总字节数
- 表格：按对象文件分组，显示每个删除的段名、大小
- 可选：按对象文件聚合的条形图

### 后端解析逻辑

Keil MAP 文件格式：
```
Removing startup_stm32f10x_hd.o(HEAP), (512 bytes).
Removing stm32f10x_adc.o(i.ADC_DeInit), (100 bytes).
...
495 unused section(s) (total 18894 bytes) removed from the image.
```

解析算法：
```javascript
function parseRemovedSections(lines) {
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
```

### 前端逻辑

```javascript
const groupedSections = computed(() => {
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

### 格式支持

| 格式 | 支持 | 说明 |
|------|------|------|
| Keil | ✓ | "Removing Unused input sections" 段 |
| GCC | ✗ | MAP 文件不输出此信息 |
| IAR | ✗ | MAP 文件不输出此信息 |

### 测试用例

**后端测试：**
1. 正常解析：正确提取删除段列表和汇总信息
2. 无删除段：MAP 文件中没有删除段信息，返回空数组
3. 格式变体：处理不同数量级的字节数
4. 边界情况：空行、格式错误的行

**前端测试：**
1. 分组显示：按对象文件正确分组
2. 汇总统计：删除段数量和总字节数正确
3. 空数据：无删除段时显示提示信息

---

## 实施顺序

1. **地址反查** — 纯前端，调试最刚需，三格式通用
2. **最大符号 Top-N** — 纯前端，快速定位大符号
3. **未使用段统计** — 需改后端，仅 Keil，但实现简单

## 工作量汇总

| 功能 | 后端 | 前端 | 测试 | 合计 |
|------|------|------|------|------|
| 地址反查 | 0 | ~80 行 | ~50 行 | ~130 行 |
| 最大符号 Top-N | 0 | ~60 行 | ~40 行 | ~100 行 |
| 未使用段统计 | ~30 行 | ~60 行 | ~60 行 | ~150 行 |
| **合计** | **~30 行** | **~200 行** | **~150 行** | **~380 行** |
