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

// ============================================================
// 导出
// ============================================================

module.exports = {
  parse,
  detectFormat
}
