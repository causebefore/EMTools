export function parseRegisterHex(value) {
  const raw = String(value ?? '').trim().replace(/^0x/i, '').replace(/\s/g, '')
  if (!raw) return 0n
  if (!/^[0-9a-f]+$/i.test(raw)) throw new Error('Invalid hex value')
  return BigInt(`0x${raw}`)
}

export function clampRegister(value, width) {
  const mask = (1n << BigInt(width)) - 1n
  return BigInt(value) & mask
}

export function formatRegisterHex(value, width) {
  const hexLen = Math.ceil(width / 4)
  return `0x${clampRegister(value, width).toString(16).toUpperCase().padStart(hexLen, '0')}`
}

export function toggleRegisterBit(value, bitIndex, width) {
  const idx = BigInt(bitIndex)
  if (idx < 0n || idx >= BigInt(width)) return clampRegister(value, width)
  return clampRegister(BigInt(value) ^ (1n << idx), width)
}

export function fieldMaskValue(field) {
  const start = BigInt(field.start)
  const end = BigInt(field.end)
  if (start < 0n || end < start) return 0n
  const length = end - start + 1n
  return ((1n << length) - 1n) << start
}

export function buildFieldMask(field, width) {
  return formatRegisterHex(fieldMaskValue(field), width)
}

export function normalizeFieldRange(start, end, width) {
  const max = Math.max(0, width - 1)
  const a = Math.min(Math.max(Number(start) || 0, 0), max)
  const b = Math.min(Math.max(Number(end) || 0, 0), max)
  return {
    start: Math.min(a, b),
    end: Math.max(a, b),
  }
}
