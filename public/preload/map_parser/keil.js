/**
 * Keil MDK MAP 文件解析器
 * 从 map_parser.js 提取的独立模块
 * uTools preload 脚本，遵循 CommonJS 规范
 */

// ============================================================
// Keil MDK 解析器
// ============================================================

/**
 * 解析 Keil MDK MAP 文件
 * @param {string} content
 * @param {Function} computeTotalsFn - 公共 totals 计算函数（从主模块注入）
 * @param {Function} inferMemoryRegionsFn - 公共内存区域推断函数（从主模块注入）
 * @returns {object} 统一格式的解析结果
 */
function parseKeil(content, computeTotalsFn, inferMemoryRegionsFn) {
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
    inferMemoryRegionsFn(modules, memoryRegions, sections)
  }

  const totals = computeTotalsFn(sections, modules, memoryRegions, explicitTotals)

  return {
    formatType: 'Keil',
    symbols,
    sections,
    modules,
    memoryRegions,
    totals
  }
}

module.exports = { parseKeil }
