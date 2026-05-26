/**
 * 哈希工具函数
 */
import SparkMD5 from 'spark-md5'

export const HASH_ALGOS = [
  { id: 'md5', name: 'MD5', bits: 128 },
  { id: 'SHA-1', name: 'SHA-1', bits: 160 },
  { id: 'SHA-256', name: 'SHA-256', bits: 256 },
  { id: 'SHA-512', name: 'SHA-512', bits: 512 },
]

export async function hashText(text, algo) {
  if (algo === 'md5') {
    return SparkMD5.hash(text)
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest(algo, data)
  return bufferToHex(hashBuffer)
}

export function hashTextSync(text, algo) {
  if (algo === 'md5') {
    return SparkMD5.hash(text)
  }
  return null
}

export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashBytes(bytes, algo) {
  if (algo === 'md5') {
    return SparkMD5.ArrayBuffer.hash(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  }
  const hashBuffer = await crypto.subtle.digest(algo, bytes)
  return bufferToHex(hashBuffer)
}

export function hexToBytes(hex) {
  const cleaned = hex.replace(/^0x/i, '').replace(/\s/g, '')
  if (!/^[0-9A-Fa-f]*$/.test(cleaned)) return null
  if (cleaned.length % 2 !== 0) return null
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16)
  }
  return bytes
}

export function base64ToBytes(b64) {
  try {
    const binary = atob(b64.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}
