/**
 * BCD码转换
 * 8421 BCD: 每4位代表一个十进制数字 (0-9)
 */

export function hexToBcd(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  let result = ''
  for (let i = 0; i < hexStr.length; i++) {
    const digit = parseInt(hexStr[i], 16)
    if (digit > 9) return null
    result += digit
  }
  return result.replace(/^0+/, '') || '0'
}

export function bcdToHex(decStr) {
  let dec = decStr.replace(/\s/g, '')
  if (!/^\d+$/.test(dec)) return null
  let hex = ''
  for (let i = 0; i < dec.length; i++) {
    hex += parseInt(dec[i]).toString(16)
  }
  return hex.toUpperCase()
}

export function hexToBcdBytes(hexStr) {
  const bcd = hexToBcd(hexStr)
  if (bcd === null) return null
  return bcd
}

export function decToBcd(dec, digits) {
  const decStr = String(dec).padStart(digits || 0, '0')
  return bcdToHex(decStr)
}

export function bcdToDec(bcdHex) {
  const dec = hexToBcd(bcdHex)
  if (dec === null) return null
  return parseInt(dec, 10)
}

export function isValidBcdByte(byte) {
  return ((byte >> 4) <= 9) && ((byte & 0x0F) <= 9)
}
