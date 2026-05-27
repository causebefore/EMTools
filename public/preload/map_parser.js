/**
 * MAP 文件解析器
 * 支持 GCC/ARM LD、Keil MDK、IAR 三种编译器格式
 * 自动检测格式并返回统一 JSON 结果
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { parseGCC } = require('./map_parser/gcc')

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
// Keil MDK 解析器
// ============================================================

/**
 * 解析 Keil MDK MAP 文件
 * @param {string} content
 * @returns {object} 统一格式的解析结果
 */
function parseKeil(content) {
  const symbols = []
  const sections = []
  const modules = []
  const memoryRegions = []

  const lines = content.split(/\r?\n/)

  // 状态标志
  let inComponentSizes = false
  let inGrandTotals = false
  let inMemoryMap = false
  let inGlobalSymbols = false
  let componentTable = ''
  let explicitTotals = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过空行和纯分隔线
    if (!trimmed) continue
    if (/^[\*=\-]{3,}$/.test(trimmed)) continue

    // === 段检测 ===
    if (/^Image\s+component\s+sizes/i.test(trimmed) ||
        /^Component\s+Sizes/i.test(trimmed)) {
      inComponentSizes = true
      inGrandTotals = false
      inMemoryMap = false
      inGlobalSymbols = false
      continue
    }

    if (/^Memory\s+Map\s+of\s+the\s+image/i.test(trimmed)) {
      inComponentSizes = false
      inMemoryMap = true
      inGlobalSymbols = false
      componentTable = ''
      continue
    }

    if (/^Global\s+Symbols/i.test(trimmed)) {
      inComponentSizes = false
      inMemoryMap = false
      inGlobalSymbols = true
      componentTable = ''
      continue
    }

    // === Image Component Sizes 段 ===
    if (inComponentSizes) {
      // 跳过分隔线和表头
      if (/^-{5,}/.test(trimmed)) continue

      if (/^\s*Code\s/i.test(trimmed)) {
        if (/Object\s+Name/i.test(trimmed)) componentTable = 'object'
        else if (/Library\s+Member\s+Name/i.test(trimmed)) componentTable = 'libraryMember'
        else if (/Library\s+Name/i.test(trimmed)) componentTable = 'libraryName'
        else componentTable = 'totals'
        continue
      }

      // Grand Totals 行
      if (/Grand\s+Totals/i.test(trimmed)) {
        const totalMatch = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+Grand\s+Totals/i)
        if (totalMatch) {
          explicitTotals = {
            code: parseInt(totalMatch[1], 10),
            roData: parseInt(totalMatch[3], 10),
            rwData: parseInt(totalMatch[4], 10),
            ziData: parseInt(totalMatch[5], 10),
            flashTotal: 0,
            flashUsed: 0,
            ramTotal: 0,
            ramUsed: 0
          }
        }
        continue
      }

      if (/^(Object|Library|ELF\s+Image|ROM)\s+Totals/i.test(trimmed)) continue
      if (/^\(incl\./i.test(trimmed)) continue
      if (/^Total\s+(RO|RW|ROM)\s+Size/i.test(trimmed)) continue
      if (componentTable === 'libraryName' || componentTable === 'totals') continue

      // 模块行: 6 个数字 + 模块名
      // Code(inc.data) ROData RWData ZIData Debug ObjectName
      const modMatch = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
      if (modMatch) {
        const code = parseInt(modMatch[1], 10)
        const roData = parseInt(modMatch[3], 10)
        const rwData = parseInt(modMatch[4], 10)
        const ziData = parseInt(modMatch[5], 10)
        const objName = modMatch[7].trim()
        if (/Totals$/i.test(objName) || /^\(incl\./i.test(objName) || /\.l$/i.test(objName)) continue

        modules.push({
          name: objName,
          code: code,
          ro_data: roData,
          rw_data: rwData,
          zi_data: ziData
        })
        continue
      }
    }

    // === Memory Map 段 ===
    if (inMemoryMap) {
      // 解析 Load Region
      const loadRegionMatch = trimmed.match(/^Load\s+Region\s+(\S+)\s+\(Base:\s*0x([0-9a-fA-F]+),\s*Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i)
      if (loadRegionMatch) {
        const base = parseInt(loadRegionMatch[2], 16)
        const size = parseInt(loadRegionMatch[3], 16)
        const max = parseInt(loadRegionMatch[4], 16)

        memoryRegions.push({
          name: loadRegionMatch[1],
          origin: base,
          length: max,
          used: size,
          attributes: 'rx'
        })
        continue
      }

      // 解析 Execution Region
      const execRegionMatch = trimmed.match(/^Execution\s+Region\s+(\S+)\s+\((?:Base|Exec\s+base):\s*0x([0-9a-fA-F]+),\s*(?:Load\s+base:\s*0x[0-9a-fA-F]+,\s*)?Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i)
      if (execRegionMatch) {
        const base = parseInt(execRegionMatch[2], 16)
        const size = parseInt(execRegionMatch[3], 16)
        const max = parseInt(execRegionMatch[4], 16)

        // 判断属性
        let attrs = 'rwx'
        if (/IROM|ER_RO|ER_CO|LR_IROM/i.test(execRegionMatch[1])) attrs = 'rx'
        if (/IRAM|ER_RW|ER_ZI|ER_BSS|LR_IRAM/i.test(execRegionMatch[1])) attrs = 'rw'

        // 过滤可能重复的区域名
        const exists = memoryRegions.some(r => r.name === execRegionMatch[1])
        if (!exists) {
          memoryRegions.push({
            name: execRegionMatch[1],
            origin: base,
            length: max,
            used: size,
            attributes: attrs
          })
        }

        sections.push({
          name: execRegionMatch[1],
          address: base,
          size: size,
          type: attrs === 'rx' ? '代码' : '数据',
          attributes: attrs === 'rx' ? 'RO' : 'RW'
        })
        continue
      }

      if (/^Exec\s+Addr/i.test(trimmed)) continue
      if (/^0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+/.test(trimmed)) continue
    }

    // === Global Symbols 段 ===
    if (inGlobalSymbols) {
      // 跳过分隔线和表头
      if (/^-{5,}/.test(trimmed)) continue
      if (/^Symbol\s+Name/i.test(trimmed)) continue
      if (/^Module\s+Name/i.test(trimmed)) continue

      // 固定列宽格式:
      // Symbol Name (约44字符)  Value(12)   Ov  Type    Size  Object(Section)
      // 或: main                                    0x08000189   Thumb Code   256  main.o(.text)

      // 尝试匹配: 名称 + 地址 + 类型信息 + 大小 + Object(Section)
      // 更灵活的正则
      const symMatch = trimmed.match(/^(.+?)\s{2,}0x([0-9a-fA-F]+)\s+(.+?)\s+(\d+)\s+(\S+(?:\(.+\))?)/)
      if (symMatch) {
        const symName = symMatch[1].trim()
        // 跳过表头文字
        if (/^(Image|\s*$)/.test(symName)) continue

        const symAddr = parseInt(symMatch[2], 16)
        const symSize = parseInt(symMatch[4], 10)
        const objSection = symMatch[5].trim()

        // 从 Object(Section) 中提取 section
        let section = ''
        const secExtract = objSection.match(/\((.+)\)$/)
        if (secExtract) {
          section = secExtract[1]
        }

        // 判断类型
        let symType = '数据'
        const typeInfo = symMatch[3].trim()
        if (/Code|Thumb/i.test(typeInfo)) symType = '函数'
        if (/Data|Number/i.test(typeInfo)) symType = '变量'

        // 判断作用域
        let scope = 'Global'
        if (/Local|Static/i.test(typeInfo)) scope = 'Local'

        symbols.push({
          name: symName,
          address: symAddr,
          size: symSize,
          section: section,
          type: symType,
          scope: scope
        })
        continue
      }

      // 备选匹配: 宽松模式 - 仅匹配地址和名称
      const symFallback = trimmed.match(/^(.+?)\s{3,}0x([0-9a-fA-F]+)\s+/)
      if (symFallback) {
        const symName = symFallback[1].trim()
        if (/[a-zA-Z_]/.test(symName) && symName.length > 1 && !/^(Image|__)/.test(symName)) {
          // 避免重复添加
          if (!symbols.find(s => s.name === symName)) {
            symbols.push({
              name: symName,
              address: parseInt(symFallback[2], 16),
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

  // 如果没有解析到 memoryRegions，从模块汇总信息推断
  if (memoryRegions.length === 0) {
    inferMemoryRegions(modules, memoryRegions, sections)
  }

  const totals = computeTotals(sections, modules, memoryRegions, explicitTotals)

  return {
    formatType: 'Keil',
    symbols,
    sections,
    modules,
    memoryRegions,
    totals
  }
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
      return parseKeil(content)
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
