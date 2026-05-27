# MAP 分析器功能扩展计划

## 现有功能

| Tab | 功能 | 数据来源 |
|-----|------|----------|
| 符号列表 | 可搜索/排序的符号表 | `result.symbols` |
| 模块统计 | 汇总卡片 + 模块表格 | `result.totals` + `result.modules` |
| 内存布局 | Flash/RAM 堆叠条形图 | `result.totals` + `result.memoryRegions` |
| 模块统计图 | Top-20 模块条形图 | `result.modules` |

## 新增功能

### 1. 地址反查

**优先级：P0（最高）**
**改动范围：纯前端，后端无改动**

用户输入一个十六进制地址（如 `0x08001234`），定位到所属符号名称 + 偏移量。嵌入式调试（HardFault、断点）最高频操作。

**实现方案：**
- 在符号列表 tab 顶部添加地址搜索输入框
- 遍历 `result.symbols`，找到 `symbol.address <= target < symbol.address + symbol.size` 的符号
- 显示：符号名、起始地址、大小、偏移量、所属 section
- 无 size 的符号（GCC 部分）：降级为最近地址匹配

**格式支持：**

| 格式 | 精确度 | 说明 |
|------|--------|------|
| Keil | 精确 | 符号都有 address + size |
| IAR | 精确 | 符号都有 address + size |
| GCC | 降级 | 部分符号 size=0，只能找最近符号 |

**预估工作量：** ~80 行前端代码

---

### 2. 最大符号 Top-N

**优先级：P0**
**改动范围：纯前端，后端无改动**

按 size 降序排列符号，展示吃 Flash/RAM 的大户。当前模块图表是按模块聚合的，单个大函数（如 `printf`、`Ymodem_Receive`）被隐藏在模块内部。

**实现方案：**
- 新增 "大符号" tab（或在符号列表 tab 中添加排序预设）
- 按 size 降序排列，过滤 size > 0 的符号
- 显示 Top-20 表格：排名、符号名、地址、大小、类型、所属模块
- 可复用现有模块统计图的条形图样式

**格式支持：**

| 格式 | 支持度 | 说明 |
|------|--------|------|
| Keil | 完整 | 所有符号有 size |
| IAR | 完整 | 所有符号有 size |
| GCC | 部分 | size=0 的符号会被过滤掉 |

**预估工作量：** ~60 行前端代码

---

### 3. 已删除未使用段统计

**优先级：P1**
**改动范围：后端 + 前端**

展示被链接器优化掉的函数/模块，帮助评估 `-ffunction-sections` 的效果和死代码情况。

**MAP 文件格式（Keil）：**
```
Removing startup_stm32f10x_hd.o(HEAP), (512 bytes).
Removing stm32f10x_adc.o(i.ADC_DeInit), (100 bytes).
...
495 unused section(s) (total 18894 bytes) removed from the image.
```

**实现方案：**

后端 `map_parser.js`：
- 在 `parseKeil()` 中新增 `removedSections` 数组
- 检测 "Removing Unused input sections" 段开始
- 逐行匹配 `Removing <object>(<section>), (<size> bytes).`
- 匹配汇总行 `<count> unused section(s) (total <bytes> bytes)`
- 输出结构：`{ name, object, size }`

前端 `MapAnalyzer/index.vue`：
- 新增 "死代码" tab
- 顶部统计卡片：删除段数量 + 总字节数
- 表格：按 object 分组，显示每个删除的段名、大小
- 可选：按 object 聚合的条形图

**格式支持：**

| 格式 | 支持 | 说明 |
|------|------|------|
| Keil | ✓ | "Removing Unused input sections" 段 |
| GCC | ✗ | MAP 文件不输出此信息 |
| IAR | ✗ | MAP 文件不输出此信息 |

**预估工作量：** 后端 ~30 行 + 前端 ~60 行 = ~90 行

---

## 工作量汇总

| 功能 | 后端 | 前端 | 合计 | 格式通用性 |
|------|------|------|------|-----------|
| 地址反查 | 0 | ~80 | ~80 | 三格式通用 |
| 最大符号 Top-N | 0 | ~60 | ~60 | 三格式通用 |
| 未使用段统计 | ~30 | ~60 | ~90 | 仅 Keil |
| **合计** | **~30** | **~200** | **~230** | |

## 实施顺序

1. **地址反查** — 纯前端，调试最刚需，三格式通用
2. **最大符号 Top-N** — 纯前端，快速定位大符号
3. **未使用段统计** — 需改后端，仅 Keil，但实现简单

三个功能互相独立，无耦合，可分别提交。
