/**
 * 字节序（大小端）转换
 */
export function swap16(value) {
  const v = BigInt(value) & 0xFFFFn
  return ((v & 0xFFn) << 8n) | ((v >> 8n) & 0xFFn)
}

export function swap32(value) {
  const v = BigInt(value) & 0xFFFFFFFFn
  return ((v & 0xFFn) << 24n) |
    ((v & 0xFF00n) << 8n) |
    ((v >> 8n) & 0xFF00n) |
    ((v >> 24n) & 0xFFn)
}

export function swap64(value) {
  const v = BigInt(value)
  return ((v & 0xFFn) << 56n) |
    ((v & 0xFF00n) << 40n) |
    ((v & 0xFF0000n) << 24n) |
    ((v & 0xFF000000n) << 8n) |
    ((v >> 8n) & 0xFF000000n) |
    ((v >> 24n) & 0xFF0000n) |
    ((v >> 40n) & 0xFF00n) |
    ((v >> 56n) & 0xFFn)
}

export function hexToBytes(hexStr) {
  hexStr = hexStr.replace(/^0x/i, '').replace(/\s/g, '')
  const bytes = []
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(parseInt(hexStr.substring(i, i + 2), 16))
  }
  return bytes
}

export function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')
}

export function reverseBytes(hexStr) {
  const bytes = hexToBytes(hexStr)
  bytes.reverse()
  return bytesToHex(bytes)
}

export function bytesToUint16BE(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0
}

export function bytesToUint16LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0
}

export function bytesToUint32BE(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

export function bytesToUint32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}
