/**
 * IEEE754 浮点数 ↔ 十六进制
 */
export function hexToFloat(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  if (hexStr.length !== 8) return null
  if (!/^[0-9A-Fa-f]+$/.test(hexStr)) return null
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, parseInt(hexStr.substring(i * 2, i * 2 + 2), 16))
  }
  return view.getFloat32(0, false)
}

export function floatToHex(value) {
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  view.setFloat32(0, value, false)
  let hex = ''
  for (let i = 0; i < 4; i++) {
    hex += view.getUint8(i).toString(16).toUpperCase().padStart(2, '0')
  }
  return hex
}

export function hexToDouble(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  if (hexStr.length !== 16) return null
  if (!/^[0-9A-Fa-f]+$/.test(hexStr)) return null
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, parseInt(hexStr.substring(i * 2, i * 2 + 2), 16))
  }
  return view.getFloat64(0, false)
}

export function doubleToHex(value) {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setFloat64(0, value, false)
  let hex = ''
  for (let i = 0; i < 8; i++) {
    hex += view.getUint8(i).toString(16).toUpperCase().padStart(2, '0')
  }
  return hex
}

export function decomposeFloat(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  if (hexStr.length !== 8) return null
  if (!/^[0-9A-Fa-f]+$/.test(hexStr)) return null
  const val = parseInt(hexStr, 16)
  const sign = (val >>> 31) & 1
  const exponent = (val >>> 23) & 0xFF
  const mantissa = val & 0x7FFFFF
  const signStr = sign ? '-' : '+'
  const expVal = exponent - 127
  let mantStr = '1.' + mantissa.toString(2).padStart(23, '0')
  return { sign: signStr, signVal: sign, exponent: exponent, expVal, mantissa: mantissa, mantStr }
}

export function decomposeDouble(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  if (hexStr.length !== 16) return null
  if (!/^[0-9A-Fa-f]+$/.test(hexStr)) return null
  const high = parseInt(hexStr.substring(0, 8), 16)
  const low = parseInt(hexStr.substring(8, 16), 16)
  const sign = (high >>> 31) & 1
  const exponent = (high >>> 20) & 0x7FF
  const mantissaHigh = high & 0xFFFFF
  const signStr = sign ? '-' : '+'
  const expVal = exponent - 1023
  const mantBin = mantissaHigh.toString(2).padStart(20, '0') + low.toString(2).padStart(32, '0')
  return { sign: signStr, signVal: sign, exponent, expVal, mantissaHigh, mantLow: low, mantBin }
}
