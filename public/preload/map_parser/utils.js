/**
 * MAP 文件解析器公共工具函数
 * 被 GCC、Keil、IAR 三个解析器共用
 * uTools preload 脚本，遵循 CommonJS 规范
 */

// ============================================================
// 公共工具函数
// ============================================================

/**
 * 计算 totals
 * @param {Array} sections
 * @param {Array} modules
 * @param {Array} memoryRegions
 * @param {object} [explicitTotals] - 显式提供的 totals（如 Keil Grand Totals 行）
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
// 导出
// ============================================================

module.exports = {
  computeTotals,
  inferMemoryRegions,
  nextPow2
}
