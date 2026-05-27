# 文件拆分重构设计

**日期**: 2026-05-27
**范围**: DataConverter、HexTool、map_parser.js 三个大文件拆分

## 背景

项目中三个文件因功能累积变得过大，影响可维护性：
- `src/views/DataConverter/index.vue` — 90 个符号，11 个独立子工具 tab
- `src/views/HexTool/index.vue` — 103 个符号，多个功能 tab
- `public/preload/map_parser.js` — 15 个符号，三种编译器格式解析器

`src/utils/` 下的工具模块已按职责拆分，无需调整。

## 方案选择

采用**方案 A：扁平拆分** — 每个功能 tab 变成独立 `.vue` 组件，主文件仅保留 tab 切换逻辑。符合项目现有的"每个文件一个职责"风格。

---

## 1. DataConverter 拆分

### 目标结构

```
src/views/DataConverter/
  index.vue                    ← ~80 行，tab 切换 + provide
  tabs/
    RadixTab.vue               ← 进制转换
    FloatTab.vue               ← 浮点数
    BitTab.vue                 ← 位操作
    EndianTab.vue              ← 字节序
    QformatTab.vue             ← Q格式
    BcdTab.vue                 ← BCD码
    TimestampTab.vue           ← 时间戳
    ByteArrayTab.vue           ← 字节数组
    AsciiTab.vue               ← ASCII码表
    CharEncTab.vue             ← 字符编码
    IpTab.vue                  ← IP地址
```

### 主文件职责

- 定义 `tabs` 数组和 `activeTab` 状态
- `provide('copyText', ...)` 注入复制功能
- 使用 `v-if` 按 `activeTab` 切换显示对应组件

### 每个 Tab 组件规范

- 自包含：`ref`、`watch`、`computed`、函数、模板全部在组件内
- 通过 `inject('copyText')` 获取复制功能
- 无 props、无 emit（各 tab 完全独立）
- 样式使用全局 CSS 变量，不内联颜色值

### 迁移步骤

1. 创建 `src/views/DataConverter/tabs/` 目录
2. 逐个提取 tab：将对应代码段（ref + watch + computed + 函数 + template 部分）移入独立组件
3. 主文件 import 各 tab 组件，用 `v-if="activeTab === 'xxx'"` 切换
4. 运行测试确认功能不变

---

## 2. HexTool 拆分

### 目标结构

```
src/views/HexTool/
  index.vue                    ← tab 切换 + 文件加载状态管理
  tabs/
    EditorTab.vue              ← Hex 编辑器 + 搜索
    ConvertTab.vue             ← 格式转换 (HEX↔S19↔BIN)
    MergeTab.vue               ← 固件合并
    FillTab.vue                ← 填充操作
    SliceTab.vue               ← 切片操作
```

### 状态共享

HexTool 的子 tab 需要访问共享状态（`fileData`、`filePath`、`fileBaseAddr`、`fileFormat`）。

方案：主文件通过 `provide` 注入共享状态，子 tab 通过 `inject` 获取。

```js
// index.vue
provide('hexState', { fileData, filePath, fileBaseAddr, fileFormat, ... })

// EditorTab.vue
const { fileData, filePath, ... } = inject('hexState')
```

### 迁移步骤

1. 创建 `src/views/HexTool/tabs/` 目录
2. 提取共享状态到 `provide`
3. 逐个提取 tab 组件
4. 运行测试确认功能不变

---

## 3. map_parser.js 拆分

### 目标结构

```
public/preload/
  map_parser.js                ← detectFormat + 统一入口 + module.exports
  map_parser/
    gcc.js                     ← parseGCC 函数
    keil.js                    ← parseKeil 函数
    iar.js                     ← parseIAR 函数
```

### 接口保持不变

```js
// map_parser.js (入口)
const { parseGCC } = require('./map_parser/gcc')
const { parseKeil } = require('./map_parser/keil')
const { parseIAR } = require('./map_parser/iar')

function detectFormat(content) { /* ... */ }

function parseMapFile(content) {
  const format = detectFormat(content)
  if (format === 'Keil') return parseKeil(content)
  if (format === 'IAR') return parseIAR(content)
  return parseGCC(content)
}

module.exports = { parseMapFile, detectFormat }
```

### 迁移步骤

1. 创建 `public/preload/map_parser/` 目录
2. 将 `parseGCC`、`parseKeil`、`parseIAR` 分别移入独立文件
3. 主文件保留 `detectFormat` + 统一入口
4. 运行 `test/map_parser.test.mjs` 确认通过

---

## 测试策略

- 每拆完一个文件立即运行 `npm test` 验证
- 所有现有测试应通过，无需新增测试（纯重构，行为不变）
- 手动检查：在浏览器中打开各工具页面，确认功能正常

## 风险点

1. **HexTool 状态共享**：provide/inject 的响应式传递需确保 ref 不被解构丢失响应性
2. **map_parser CommonJS 路径**：preload 环境的 require 路径需正确
3. **CSS 样式**：tab 组件需能访问全局样式，不能有 scoped 隔离问题
