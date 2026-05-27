/**
 * IAR MAP 文件解析器
 * 从 map_parser.js 提取的独立模块
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { computeTotals, inferMemoryRegions } = require('./utils')

// ============================================================
// IAR 解析器
// ============================================================

/**
 * 解析 IAR MAP 文件
 * @param {string} content
 * @returns {object} 统一格式的解析结果
 */
function parseIAR(content) {
  const symbols = []
  const sections = []
  const modules = []
  const memoryRegions = []

  const lines = content.split(/\r?\n/)

  // 状态标志
  let inModuleSummary = false
  let inEntryList = false
  let moduleHeaderPassed = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过空行和纯分隔线
    if (!trimmed) continue
    if (/^[\*=\-]{3,}$/.test(trimmed)) continue

    // === 段检测 ===
    if (/^\*\*\*\s*MODULE\s+SUMMARY/i.test(trimmed)) {
      inModuleSummary = true
      inEntryList = false
      moduleHeaderPassed = false
      continue
    }

    if (/^\*\*\*\s*ENTRY\s+LIST/i.test(trimmed)) {
      inModuleSummary = false
      inEntryList = true
      continue
    }

    if (/^\*\*\*\s*RUNTIME\s+MODULE/i.test(trimmed) ||
        /^\*\*\*\s*END\s+OF/i.test(trimmed) ||
        /^\*\*\*\s*ERROR/i.test(trimmed)) {
      inModuleSummary = false
      inEntryList = false
      continue
    }

    // === MODULE SUMMARY 段 ===
    if (inModuleSummary) {
      // 跳过表头行
      if (/Module\s+Code\s+Data\s+Const/i.test(trimmed) ||
          /^Module\s+Code/i.test(trimmed) ||
          /^[-]+\s+[-]+\s+[-]+/.test(trimmed)) {
        moduleHeaderPassed = true
        continue
      }

      // Total 行
      if (/^Total:/i.test(trimmed)) continue

      if (moduleHeaderPassed) {
        // 格式: ModuleName  Code  DATA  CONST
        // 数字可能包含千位分隔符空格: 4 096, 65 536
        // 更宽容的匹配
        // 先尝试标准格式: name  num  num  num
        const modMatch = trimmed.match(/^(\S+(?:\.\w+)?)\s+(\d[\d\s]*)\s+(\d[\d\s]*)\s+(\d[\d\s]*)$/)
        if (modMatch) {
          const objName = modMatch[1].trim()
          const code = parseIARNumber(modMatch[2])
          const data = parseIARNumber(modMatch[3])
          const konst = parseIARNumber(modMatch[4])

          modules.push({
            name: objName,
            code: code,
            ro_data: konst,
            rw_data: data,
            zi_data: 0
          })
          continue
        }

        // 备选: 尝试更宽松的匹配（处理末尾可能有多余文字）
        const modLooseMatch = trimmed.match(/^(\S+)\s+(\d[\d\s]*)\s+(\d[\d\s]*)\s+(\d[\d\s]*)/)
        if (modLooseMatch) {
          const objName = modLooseMatch[1].trim()
          const code = parseIARNumber(modLooseMatch[2])
          const data = parseIARNumber(modLooseMatch[3])
          const konst = parseIARNumber(modLooseMatch[4])
          if (/Totals$/i.test(objName) || /^\(incl\./i.test(objName)) continue

          // 避免将其他内容当作模块
          if (code > 0 || data > 0 || konst > 0) {
            modules.push({
              name: objName,
              code: code,
              ro_data: konst,
              rw_data: data,
              zi_data: 0
            })
            continue
          }
        }
      }
    }

    // === ENTRY LIST 段 ===
    if (inEntryList) {
      // 跳过表头
      if (/^Entry/i.test(trimmed) || /^[-]+\s+[-]+/.test(trimmed)) continue

      // 格式: name  addr  size  type  scope
      // main   0x08000189  256  Code  Gb
      // uart_init  0x08000400  48  Code  Lc
      // 数字可能包含千位分隔符空格
      const entryMatch = trimmed.match(/^(\S+)\s+0x([0-9a-fA-F]+)\s+(\d[\d\s]*)\s+(\S+)\s+(\S+)/)
      if (entryMatch) {
        const symName = entryMatch[1].trim()
        const symAddr = parseInt(entryMatch[2], 16)
        const symSize = parseIARNumber(entryMatch[3])
        const symType = entryMatch[4].trim()
        const symScope = entryMatch[5].trim()

        // 跳过 __ 开头的内部符号
        if (symName.startsWith('__')) continue

        let type = '数据'
        if (/Code/i.test(symType)) type = '函数'
        if (/Data/i.test(symType)) type = '变量'
        if (/Const/i.test(symType)) type = '常量'

        let scope = 'Global'
        if (/Lc|Local/i.test(symScope)) scope = 'Local'
        if (/St|Static/i.test(symScope)) scope = 'Static'

        symbols.push({
          name: symName,
          address: symAddr,
          size: symSize,
          section: '',
          type: type,
          scope: scope
        })
        continue
      }

      // 备选: 无 size 的条目
      const entryFallback = trimmed.match(/^(\S+)\s+0x([0-9a-fA-F]+)/)
      if (entryFallback) {
        const symName = entryFallback[1].trim()
        if (/[a-zA-Z_]/.test(symName) && !symName.startsWith('__')) {
          if (!symbols.find(s => s.name === symName)) {
            symbols.push({
              name: symName,
              address: parseInt(entryFallback[2], 16),
              size: 0,
              section: '',
              type: '函数',
              scope: 'Global'
            })
          }
        }
      }
    }
  }

  // 推断内存区域
  inferMemoryRegions(modules, memoryRegions)

  const totals = computeTotals(sections, modules, memoryRegions)

  return {
    formatType: 'IAR',
    symbols,
    sections,
    modules,
    memoryRegions,
    totals
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析 IAR 格式的数字（可能包含空格千位分隔符）
 * 例如 "4 096" => 4096
 * @param {string} str
 * @returns {number}
 */
function parseIARNumber(str) {
  if (!str) return 0
  // 移除所有空格
  const cleaned = str.replace(/\s+/g, '')
  const val = parseInt(cleaned, 10)
  return isNaN(val) ? 0 : val
}

// ============================================================
// 导出
// ============================================================

module.exports = { parseIAR }
