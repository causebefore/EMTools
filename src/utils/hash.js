/**
 * 哈希工具函数
 */
import SparkMD5 from 'spark-md5'

export const HASH_ALGOS = [
  { id: 'md5', name: 'MD5', bits: 128 },
  { id: 'sha1', name: 'SHA-1', bits: 160 },
  { id: 'sha256', name: 'SHA-256', bits: 256 },
  { id: 'sha512', name: 'SHA-512', bits: 512 },
]

export async function hashText(text, algo) {
  if (algo === 'md5') {
    return SparkMD5.hash(text)
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest(algo.toUpperCase(), data)
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
