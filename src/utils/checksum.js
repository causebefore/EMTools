/**
 * 校验和算法 — XOR、求和取低字节、补码和、Fletcher-16
 */

/**
 * XOR校验：所有字节异或
 */
export function checksumXor(data) {
  let result = 0
  for (const byte of data) result ^= byte
  return result
}

/**
 * 求和取低字节
 */
export function checksumSumLow(data) {
  let sum = 0
  for (const byte of data) sum += byte
  return sum & 0xFF
}

/**
 * 补码和：字节求和后取 8 位补码（Intel HEX / SRecord 模式）
 */
export function checksumTwosComplement(data) {
  let sum = 0
  for (const byte of data) sum += byte
  return ((~sum) + 1) & 0xFF
}

/**
 * Fletcher-16 校验和
 * 返回 { sum1, sum2, combined }，模 255
 */
export function checksumFletcher16(data) {
  let sum1 = 0
  let sum2 = 0
  for (const byte of data) {
    sum1 = (sum1 + byte) % 255
    sum2 = (sum2 + sum1) % 255
  }
  return { sum1, sum2, combined: (sum2 << 8) | sum1 }
}
