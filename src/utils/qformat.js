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
  let val = qValue
  const totalBits = m + n + 1
  const signBit = 1 << (totalBits - 1)
  if (val & signBit) {
    val = val - (1 << totalBits)
  }
  return val / Math.pow(2, n)
}

export function qToHex(qValue, bits) {
  if (qValue < 0) {
    qValue = (1 << bits) + qValue
  }
  return '0x' + qValue.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), '0')
}

export function qRange(m, n) {
  const total = m + n
  const maxInt = Math.pow(2, total) - 1
  const maxFloat = maxInt / Math.pow(2, n)
  return { min: -Math.pow(2, m), max: maxFloat, resolution: 1 / Math.pow(2, n) }
}
