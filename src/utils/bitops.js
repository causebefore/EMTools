/**
 * 位运算工具
 */
export function bitAnd(a, b) {
  return BigInt(a) & BigInt(b)
}

export function bitOr(a, b) {
  return BigInt(a) | BigInt(b)
}

export function bitXor(a, b) {
  return BigInt(a) ^ BigInt(b)
}

export function bitNot(a, bits) {
  const mask = (1n << BigInt(bits)) - 1n
  return (~BigInt(a)) & mask
}

export function bitShl(a, n) {
  return BigInt(a) << BigInt(n)
}

export function bitShr(a, n) {
  return BigInt(a) >> BigInt(n)
}

export function bitTest(value, bitIndex) {
  return ((BigInt(value) >> BigInt(bitIndex)) & 1n) === 1n
}

export function bitSet(value, bitIndex) {
  return BigInt(value) | (1n << BigInt(bitIndex))
}

export function bitClear(value, bitIndex) {
  return BigInt(value) & ~(1n << BigInt(bitIndex))
}

export function bitToggle(value, bitIndex) {
  return BigInt(value) ^ (1n << BigInt(bitIndex))
}

export function bitExtract(value, start, length) {
  const mask = ((1n << BigInt(length)) - 1n) << BigInt(start)
  return (BigInt(value) & mask) >> BigInt(start)
}

export function formatBits(value, bits) {
  return value.toString(2).padStart(bits || 8, '0')
}

export function bitsToUint32Array(value) {
  const bits = []
  for (let i = 31; i >= 0; i--) {
    bits.push((value >> BigInt(i)) & 1n)
  }
  return bits
}
