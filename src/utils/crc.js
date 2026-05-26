/**
 * CRC 校验算法
 * 支持 7 种预设 + 自定义参数 + C 代码生成
 */
export const CRC_PRESETS = {
  'CRC-8':         { width: 8,  poly: 0x07,       init: 0x00,        refIn: false, refOut: false, xorOut: 0x00 },
  'CRC-8/MAXIM':   { width: 8,  poly: 0x31,       init: 0x00,        refIn: true,  refOut: true,  xorOut: 0x00 },
  'CRC-16/MODBUS': { width: 16, poly: 0x8005,     init: 0xFFFF,      refIn: true,  refOut: true,  xorOut: 0x0000 },
  'CRC-16/CCITT':  { width: 16, poly: 0x1021,     init: 0xFFFF,      refIn: false, refOut: false, xorOut: 0x0000 },
  'CRC-16/XMODEM': { width: 16, poly: 0x1021,     init: 0x0000,      refIn: false, refOut: false, xorOut: 0x0000 },
  'CRC-32':        { width: 32, poly: 0x04C11DB7, init: 0xFFFFFFFF,  refIn: true,  refOut: true,  xorOut: 0xFFFFFFFF },
  'CRC-32/MPEG-2': { width: 32, poly: 0x04C11DB7, init: 0xFFFFFFFF,  refIn: false, refOut: false, xorOut: 0x00000000 },
}

function reflectBits(value, width) {
  let result = 0n
  const v = BigInt(value)
  for (let i = 0; i < width; i++) {
    if (v & (1n << BigInt(i))) {
      result |= 1n << BigInt(width - 1 - i)
    }
  }
  return result
}

export function crcCompute(data, params) {
  const { width, poly, init, refIn, refOut, xorOut } = params
  const mask = (1n << BigInt(width)) - 1n
  const msb = 1n << BigInt(width - 1)

  let crc = BigInt(init)

  for (const byte of data) {
    let b = BigInt(byte)
    if (refIn) {
      b = reflectBits(byte, 8)
    }
    crc ^= (b << BigInt(width - 8))
    for (let i = 0; i < 8; i++) {
      if (crc & msb) {
        crc = ((crc << 1n) ^ BigInt(poly)) & mask
      } else {
        crc = (crc << 1n) & mask
      }
    }
  }

  if (refOut) {
    crc = reflectBits(crc, width)
  }
  crc ^= BigInt(xorOut)
  crc &= mask
  return crc
}

export function crcGenerateTable(params) {
  const { width, poly, refIn } = params
  const mask = (1n << BigInt(width)) - 1n
  const msb = 1n << BigInt(width - 1)
  const table = []

  for (let i = 0; i < 256; i++) {
    let val = BigInt(i)
    if (refIn) {
      val = reflectBits(i, 8) << BigInt(width - 8)
    } else {
      val <<= BigInt(width - 8)
    }
    for (let j = 0; j < 8; j++) {
      if (val & msb) {
        val = ((val << 1n) ^ BigInt(poly)) & mask
      } else {
        val = (val << 1n) & mask
      }
    }
    if (refIn) {
      val = reflectBits(val, width)
    }
    table.push(val)
  }
  return table
}

export function crcGenerateCCode(presetName) {
  const preset = CRC_PRESETS[presetName]
  if (!preset) return ''
  const { width, poly, init, refIn, refOut, xorOut } = preset

  const table = crcGenerateTable(preset)
  const hexLen = width / 4
  const dtype = `uint${width}_t`
  const name = presetName.replace(/[-/]/g, '_').toLowerCase()

  const lines = [
    `/* ${presetName} 查表法实现 */`,
    `/* Poly: 0x${poly.toString(16).toUpperCase()}, Init: 0x${init.toString(16).toUpperCase()}, RefIn: ${refIn}, RefOut: ${refOut}, XorOut: 0x${xorOut.toString(16).toUpperCase()} */`,
    '',
    '#include <stdint.h>',
    '',
    `static const ${dtype} ${name}_table[256] = {`,
  ]

  for (let i = 0; i < 256; i += 8) {
    const row = table.slice(i, i + 8).map(v => '0x' + v.toString(16).toUpperCase().padStart(hexLen, '0')).join(', ')
    lines.push(`    ${row},`)
  }

  lines.push('};', '')
  lines.push(`${dtype} ${name}_calc(const uint8_t *data, uint32_t len) {`)
  lines.push(`    ${dtype} crc = 0x${init.toString(16).toUpperCase().padStart(hexLen, '0')};`)
  lines.push('    while (len--) {')

  if (refIn) {
    if (width > 8) {
      lines.push(`        crc = ${name}_table[(crc ^ *data++) & 0xFF] ^ (crc >> 8);`)
    } else {
      lines.push(`        crc = ${name}_table[crc ^ *data++];`)
    }
  } else {
    lines.push(`        crc = ${name}_table[((crc >> ${width - 8}) ^ *data++) & 0xFF] ^ (crc << 8);`)
  }

  lines.push('    }')
  lines.push(`    return crc ^ 0x${xorOut.toString(16).toUpperCase().padStart(hexLen, '0')};`)
  lines.push('}')

  return lines.join('\n')
}

export function parseHexData(text) {
  const cleaned = text.replace(/0x/gi, '').replace(/,/g, ' ').replace(/\n/g, ' ')
  const parts = cleaned.split(/\s+/).filter(Boolean)
  return parts.map(p => parseInt(p, 16)).filter(b => !isNaN(b) && b >= 0 && b <= 255)
}
