/**
 * MAP 文件解析器
 * 支持 GCC/ARM LD、Keil MDK、IAR 三种编译器格式
 * 自动检测格式并返回统一 JSON 结果
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { parseGCC } = require('./map_parser/gcc')
const { parseKeil } = require('./map_parser/keil')
const { parseIAR } = require('./map_parser/iar')

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
      return parseGCC(content)
  }
}

/**
 * 根据地址查找符号
 * @param {Array} symbols - 符号列表
 * @param {number} targetAddr - 目标地址
 * @returns {object|null} 匹配的符号或 null
 */
function findSymbolByAddress(symbols, targetAddr) {
  // 精确匹配：symbol.address <= target < symbol.address + symbol.size
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

  // 降级匹配：找 address <= targetAddr 的最近符号（针对 GCC size=0 的情况）
  let floor = null
  for (const sym of symbols) {
    if (sym.address <= targetAddr) {
      if (!floor || sym.address > floor.address) {
        floor = sym
      }
    }
  }

  return floor ? { ...floor, offset: targetAddr - floor.address, isApproximate: true } : null
}

/**
 * 获取 Top-N 大符号
 * @param {Array} symbols - 符号列表
 * @param {number} limit - 返回数量限制，默认 20
 * @returns {Array} 按大小降序排列的符号列表
 */
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

/**
 * 解析 Keil MAP 文件中的已删除未使用段
 * @param {string} content - MAP 文件内容
 * @returns {object} { removedSections, summary }
 */
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

// ============================================================
// 导出
// ============================================================

module.exports = {
  parse,
  detectFormat,
  findSymbolByAddress,
  getTopSymbols,
  parseRemovedSections
}
