/**
 * MAP 文件解析器
 * 支持 GCC/ARM LD、Keil MDK、IAR 三种编译器格式
 * 自动检测格式并返回统一 JSON 结果
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { parseGCC } = require('./map_parser/gcc')
const { parseKeil } = require('./map_parser/keil')

// ============================================================
// 格式检测
// ============================================================

/**
 * 检测 MAP 文件格式
 * @param {string} content - MAP 文件内容
 * @returns {string} "GCC" | "Keil" | "IAR"
 */
function detectFormat(content) {
  if (!content || typeof content !== 'string') return 'GCC'

  const upper = content.toUpperCase()

  if (upper.includes('ARM LINKER') || upper.includes('COMPONENT SIZES')) {
    return 'Keil'
  }

  if (upper.includes('IAR LINKER') || (upper.includes('ENTRY') && upper.includes('MODULE') && upper.includes('ADDRESS'))) {
    return 'IAR'
  }

  if (upper.includes('MEMORY CONFIGURATION') || upper.includes('GNU LD')) {
    return 'GCC'
  }

  return 'GCC'
}

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

/**
 * 计算 totals
 * @param {Array} sections
 * @param {Array} modules
 * @param {Array} memoryRegions
 * @returns {object}
 */
function computeTotals(sections, modules, memoryRegions, explicitTotals) {
  const totals = explicitTotals ? { ...explicitTotals } : {
    code: 0,
    roData: 0,
    rwData: 0,
    ziData: 0,
    flashTotal: 0,
    flashUsed: 0,
    ramTotal: 0,
    ramUsed: 0
  }

  if (!explicitTotals) {
    // 从 modules 汇总
    for (const mod of modules) {
      totals.code += mod.code || 0
      totals.roData += mod.ro_data || 0
      totals.rwData += mod.rw_data || 0
      totals.ziData += mod.zi_data || 0
    }
  }

  // 如果没有 modules，尝试从 sections 汇总
  if (!explicitTotals && modules.length === 0) {
    for (const sec of sections) {
      if (sec.type === '代码' || /^(CODE|ER_RO|ER_CO)/i.test(sec.name)) {
        totals.code += sec.size || 0
      } else if (sec.type === '只读数据') {
        totals.roData += sec.size || 0
      } else if (sec.type === '数据' || /^(DATA|RW|ER_RW)/i.test(sec.name)) {
        totals.rwData += sec.size || 0
      } else if (sec.type === 'BSS' || /^(BSS|ZI|ER_ZI)/i.test(sec.name)) {
        totals.ziData += sec.size || 0
      }
    }
  }

  // flashUsed = code + roData + rwData
  totals.flashUsed = totals.code + totals.roData + totals.rwData
  // ramUsed = rwData + ziData
  totals.ramUsed = totals.rwData + totals.ziData

  // 从 memoryRegions 获取 flashTotal/ramTotal
  for (const region of memoryRegions) {
    const name = region.name.toUpperCase()
    if (/FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(name)) {
      if (totals.flashTotal === 0) {
        totals.flashTotal = region.length
      }
    }
    if (/RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(name)) {
      if (totals.ramTotal === 0) {
        totals.ramTotal = region.length
      }
    }
  }

  if (totals.flashUsed === 0) {
    const loadRegions = memoryRegions.filter(region => /^LR_/i.test(region.name) && region.used > 0)
    const flashRegions = loadRegions.length > 0
      ? loadRegions
      : memoryRegions.filter(region => /FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(region.name) && region.used > 0)
    totals.flashUsed = flashRegions.reduce((sum, region) => sum + (region.used || 0), 0)
  }

  if (totals.ramUsed === 0) {
    const ramRegions = memoryRegions.filter(region => /RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(region.name) && !/^LR_/i.test(region.name))
    totals.ramUsed = ramRegions.reduce((sum, region) => sum + (region.used || 0), 0)
  }

  return totals
}

/**
 * 推断 memoryRegions（当 MAP 文件中没有显式定义时）
 * @param {Array} modules
 * @param {Array} memoryRegions - 将被填充
 * @param {Array} sections - 可选
 */
function inferMemoryRegions(modules, memoryRegions, sections) {
  // 尝试从 totals 推断常见 MCU 内存配置
  const totalCode = modules.reduce((s, m) => s + (m.code || 0), 0)
  const totalRo = modules.reduce((s, m) => s + (m.ro_data || 0), 0)
  const totalRw = modules.reduce((s, m) => s + (m.rw_data || 0), 0)
  const totalZi = modules.reduce((s, m) => s + (m.zi_data || 0), 0)

  const flashUsed = totalCode + totalRo + totalRw
  const ramUsed = totalRw + totalZi

  // 向上取整到 1KB 边界，确保 length >= used
  const flashLen = nextPow2(flashUsed, 0x10000) // 最小 64KB
  const ramLen = nextPow2(ramUsed, 0x8000)      // 最小 32KB

  memoryRegions.push({
    name: 'FLASH',
    origin: 0x08000000,
    length: flashLen,
    used: flashUsed,
    attributes: 'rx'
  })

  memoryRegions.push({
    name: 'RAM',
    origin: 0x20000000,
    length: ramLen,
    used: ramUsed,
    attributes: 'rwx'
  })
}

/**
 * 计算大于等于 value 的 2 的幂，且不小于 minSize
 * @param {number} value
 * @param {number} minSize
 * @returns {number}
 */
function nextPow2(value, minSize) {
  let size = minSize
  while (size < value) {
    size *= 2
  }
  return size
}

// ============================================================
// 解析入口
// ============================================================

/**
 * 解析 MAP 文件内容，自动检测格式
 * @param {string} content - MAP 文件内容
 * @returns {object} 统一格式的解析结果
 */
function parse(content) {
  if (!content || typeof content !== 'string') {
    return {
      formatType: 'GCC',
      symbols: [],
      sections: [],
      modules: [],
      memoryRegions: [],
      totals: {
        code: 0, roData: 0, rwData: 0, ziData: 0,
        flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0
      }
    }
  }

  const format = detectFormat(content)

  switch (format) {
    case 'Keil':
      return parseKeil(content, computeTotals, inferMemoryRegions)
    case 'IAR':
      return parseIAR(content)
    case 'GCC':
    default:
      return parseGCC(content, computeTotals)
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  parse,
  detectFormat
}
