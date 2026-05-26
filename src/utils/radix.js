/**
 * 进制转换工具
 */
export function convertRadix(value, fromRadix, toRadix) {
  if (!value || fromRadix < 2 || fromRadix > 36 || toRadix < 2 || toRadix > 36) return ''
  try {
    const cleaned = String(value).replace(/^0x|0b|0o/i, '').replace(/\s/g, '')
    let num = 0n
    const bigFrom = BigInt(fromRadix)
    for (const ch of cleaned) {
      const digit = parseInt(ch, fromRadix)
      if (isNaN(digit)) return ''
      num = num * bigFrom + BigInt(digit)
    }
    return num.toString(toRadix).toUpperCase()
  } catch {
    return ''
  }
}

export function padHex(value, bits) {
  const len = bits / 4
  let hex = value.toString(16).toUpperCase()
  return hex.padStart(len, '0')
}

export const RADIX_NAMES = {
  2: '二进制 (BIN)',
  8: '八进制 (OCT)',
  10: '十进制 (DEC)',
  16: '十六进制 (HEX)'
}
