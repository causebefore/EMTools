/**
 * Q格式定点数转换
 * Qm.n: m位整数, n位小数, 总位数 = m + n + 1(符号位)
 */
export function floatToQ(value, m, n) {
  const totalBits = m + n
  const qValue = Math.round(value * Math.pow(2, n))
  const maxVal = Math.pow(2, totalBits) - 1
  const minVal = -Math.pow(2, totalBits)
  if (qValue > maxVal) return { value: maxVal, clamped: true }
  if (qValue < minVal) return { value: minVal, clamped: true }
  return { value: qValue, clamped: false }
}

export function qToFloat(qValue, m, n) {
  const totalBits = m + n + 1
  if (qValue < 0) {
    return qValue / Math.pow(2, n)
  }
  let val = BigInt(qValue)
  const signBit = 1n << BigInt(totalBits - 1)
  if (val & signBit) {
    val = val - (1n << BigInt(totalBits))
  }
  return Number(val) / Math.pow(2, n)
}

export function qToHex(qValue, bits) {
  let val = BigInt(qValue)
  if (val < 0) {
    val = (1n << BigInt(bits)) + val
  }
  return '0x' + val.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), '0')
}

export function qRange(m, n) {
  const total = m + n
  const maxInt = Math.pow(2, total) - 1
  const maxFloat = maxInt / Math.pow(2, n)
  return { min: -Math.pow(2, m), max: maxFloat, resolution: 1 / Math.pow(2, n) }
}
