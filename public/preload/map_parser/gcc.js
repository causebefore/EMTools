/**
 * GCC/ARM LD MAP 文件解析器
 * 从 map_parser.js 提取的独立模块
 * uTools preload 脚本，遵循 CommonJS 规范
 */

const { computeTotals } = require('./utils')

// ============================================================
// GCC/ARM LD 解析器
// ============================================================

/**
 * 解析 GCC MAP 文件
 * @param {string} content
 * @returns {object} 统一格式的解析结果
 */
function parseGCC(content) {
  const symbols = []
  const sections = []
  const modules = []
  const memoryRegions = []

  const lines = content.split(/\r?\n/)

  // 状态标志
  let inMemoryConfig = false
  let inLinkerMap = false
  let currentSection = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过空行和分隔线
    if (!trimmed || /^[\*=\-]{3,}/.test(trimmed)) continue

    // === Memory Configuration 段 ===
    if (/^Memory\s+Configuration/i.test(trimmed)) {
      inMemoryConfig = true
      inLinkerMap = false
      continue
    }

    if (/^Linker\s+script\s+and\s+memory\s+map/i.test(trimmed)) {
      inMemoryConfig = false
      inLinkerMap = true
      continue
    }

    // 解析 Memory Configuration
    if (inMemoryConfig) {
      // 跳过表头行
      if (/^Name\s+Origin/i.test(trimmed) || /^-+\s+-+/i.test(trimmed)) continue
      if (/^\*default\*/.test(trimmed)) continue

      // 格式: NAME 0xOrigin 0xLength Attributes
      const memMatch = trimmed.match(/^(\S+)\s+0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)\s+(\S+)/)
      if (memMatch) {
        memoryRegions.push({
          name: memMatch[1],
          origin: parseInt(memMatch[2], 16),
          length: parseInt(memMatch[3], 16),
          used: 0,
          attributes: memMatch[4]
        })
        continue
      }
    }

    // === Linker script and memory map 段 ===
    if (inLinkerMap) {
      // 跳过 ALIGN, FILL, ASSERT 等链接器指令
      if (/^\s*\.(?: =|\(|\*)|^\s*(?:LOAD|SORT|ABSOLUTE|ALIGN|FILL|ASSERT|BYTE|SHORT|LONG|QUAD|SQUAD|KEEP)/i.test(line)) continue

      // 匹配输出段行: .section_name  0xADDR  0xSIZE
      // GNU ld 的输入段以空格缩进，不能作为独立 section 统计，否则会重复计算大小。
      const sectionMatch = line.match(/^\.(\S+)\s+0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)/)
      if (sectionMatch) {
        // 保存上一段的信息
        if (currentSection) {
          sections.push(currentSection)
        }

        const addr = parseInt(sectionMatch[2], 16)
        const size = parseInt(sectionMatch[3], 16)
        const secName = '.' + sectionMatch[1]

        const sectionInfo = classifySection(secName, addr, memoryRegions)

        currentSection = {
          name: secName,
          address: addr,
          size: size,
          type: sectionInfo.type,
          attributes: sectionInfo.attributes
        }

        // 尝试从 .data 行提取 load address
        const loadAddrMatch = trimmed.match(/load\s+address\s+0x([0-9a-fA-F]+)/i)
        if (loadAddrMatch) {
          currentSection.loadAddress = parseInt(loadAddrMatch[1], 16)
        }

        continue
      }

      // 匹配符号行 (缩进行，以空格开头)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        const inputSectionMatch = trimmed.match(/^(\.\S+)\s+0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)\s+(\S.*)$/)
        if (inputSectionMatch) {
          addModuleContribution(
            modules,
            inputSectionMatch[4],
            inputSectionMatch[1],
            parseInt(inputSectionMatch[3], 16),
            currentSection
          )
          continue
        }

        const inputContinuationMatch = trimmed.match(/^0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)\s+(\S.*)$/)
        if (inputContinuationMatch && currentSection && /^\./.test(currentSection.name)) {
          addModuleContribution(
            modules,
            inputContinuationMatch[3],
            currentSection.name,
            parseInt(inputContinuationMatch[2], 16),
            currentSection
          )
          continue
        }

        // 排除 COMMON、*fill*、. = ALIGN 等行
        if (/^\s*\.(?: = ALIGN|\(|\*)/.test(line)) continue
        if (/^\s*\*\s*(fill|com|undef)/i.test(trimmed)) continue
        if (/^\s*0x0+\s+0x0+\s*$/.test(trimmed)) continue

        // 符号行格式: 0xADDR  name  或  0xADDR                name
        const symMatch = trimmed.match(/^0x([0-9a-fA-F]+)\s+(\S+)/)
        if (symMatch) {
          const symAddr = parseInt(symMatch[1], 16)
          const symName = symMatch[2]

          // 跳过地址和大小重复的行（如 "0x08000000                . = ALIGN"）
          if (/^[.\d]/.test(symName) && symName.length > 1 && /^\d/.test(symName.charAt(1))) continue
          if (/^\.\s*=/.test(symName)) continue
          if (/^0x/.test(symName)) continue

          // 判断是否为符号（不是段名、链接器伪指令）
          if (/^[a-zA-Z_]/.test(symName) && !/^PROVIDE|^EXTERN|^PROVIDE_END|^ASSERT/.test(symName)) {
            symbols.push({
              name: symName,
              address: symAddr,
              size: 0,
              section: currentSection ? currentSection.name : '',
              type: '函数',
              scope: 'Global'
            })
          }
        } else {
          // 可能是第二行符号定义（带有 size 的格式）
          // 某些 GCC MAP 在段行后直接列符号: main              0x08000189       0x100
          const symSizeMatch = trimmed.match(/^(\S+)\s+0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)/)
          if (symSizeMatch && !/^\./.test(symSizeMatch[1]) && /^[a-zA-Z_]/.test(symSizeMatch[1])) {
            symbols.push({
              name: symSizeMatch[1],
              address: parseInt(symSizeMatch[2], 16),
              size: parseInt(symSizeMatch[3], 16),
              section: currentSection ? currentSection.name : '',
              type: '函数',
              scope: 'Global'
            })
          }
        }
        continue
      }

    }
  }

  // 保存最后一个 section
  if (currentSection) {
    sections.push(currentSection)
  }

  // 计算 memoryRegions 的 used 值
  for (const region of memoryRegions) {
    let used = 0
    for (const sec of sections) {
      // 检查段地址是否在区域范围内
      if (sec.address >= region.origin && sec.address < region.origin + region.length) {
        used += sec.size
      } else if (
        sec.type !== 'BSS' &&
        sec.loadAddress >= region.origin &&
        sec.loadAddress < region.origin + region.length
      ) {
        used += sec.size
      }
    }
    region.used = used
  }

  // 从 sections 计算 totals
  const totals = computeTotals(sections, [], memoryRegions)

  return {
    formatType: 'GCC',
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

function classifySection(name, address, memoryRegions) {
  let type = '其他'
  let attributes = ''

  if (/^\.(text|isr_vector|vfp|v4_bx|iplt|init$|fini$)/i.test(name)) {
    type = '代码'
    attributes = 'RO'
  } else if (/^\.(rodata|ARM|preinit_array|init_array|fini_array|rel\.dyn|shell_)/i.test(name)) {
    type = '只读数据'
    attributes = 'RO'
  } else if (/^\.(data|tdata|igot)/i.test(name)) {
    type = '数据'
    attributes = 'RW'
  } else if (/^\.(bss|tbss|heap|stack|_user_heap_stack)/i.test(name)) {
    type = 'BSS'
    attributes = 'RW'
  } else {
    const region = memoryRegions.find(r => address >= r.origin && address < r.origin + r.length)
    if (region) {
      const attrs = (region.attributes || '').toLowerCase()
      if (attrs.includes('w')) {
        type = '数据'
        attributes = 'RW'
      } else {
        type = '只读数据'
        attributes = 'RO'
      }
    }
  }

  return { type, attributes }
}

function moduleNameFromTail(tail) {
  if (!tail) return ''
  const first = tail.trim().split(/\s+/)[0]
  return first && !/^\*=|^\.$/.test(first) ? first : ''
}

function addModuleContribution(modules, tail, sectionName, size, currentSection) {
  if (!size) return

  const objName = moduleNameFromTail(tail)
  if (!objName || !/\.(?:o|obj|a)(?:\(|$)/i.test(objName)) return

  let module = modules.find(m => m.name === objName)
  if (!module) {
    module = {
      name: objName,
      code: 0,
      ro_data: 0,
      rw_data: 0,
      zi_data: 0
    }
    modules.push(module)
  }

  const category = sectionCategory(sectionName, currentSection)
  if (category === 'code') module.code += size
  if (category === 'ro') module.ro_data += size
  if (category === 'rw') module.rw_data += size
  if (category === 'zi') module.zi_data += size
}

function sectionCategory(name, section) {
  if (/^\.(text|isr_vector|vfp|v4_bx|iplt|init$|fini$)/i.test(name)) return 'code'
  if (/^\.(rodata|ARM|preinit_array|init_array|fini_array|rel\.dyn|shell_)/i.test(name)) return 'ro'
  if (/^\.(data|tdata|igot)/i.test(name)) return 'rw'
  if (/^\.(bss|tbss|heap|stack|_user_heap_stack)/i.test(name)) return 'zi'
  if (section?.type === '代码') return 'code'
  if (section?.type === '只读数据') return 'ro'
  if (section?.type === '数据') return 'rw'
  if (section?.type === 'BSS') return 'zi'
  return 'other'
}

module.exports = { parseGCC }
