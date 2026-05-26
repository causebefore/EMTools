/**
 * 固件文件格式工具
 * Intel HEX / Motorola S-Record 解析与生成
 */

/**
 * 解析 Intel HEX 格式
 * @returns {{ baseAddr: number, data: Uint8Array }}
 */
export function parseIntelHex(content) {
  if (typeof content !== 'string') {
    throw new TypeError('Intel HEX content must be a string')
  }
  const dataMap = new Map()
  let upperAddr = 0
  let startAddr = 0

  let lineNo = 0
  for (const raw of content.split(/\r?\n/)) {
    lineNo++
    const line = raw.trim()
    if (!line.startsWith(':')) continue

    if (!/^:[0-9A-Fa-f]+$/.test(line) || line.length < 11 || line.length % 2 !== 1) {
      throw new Error(`Invalid Intel HEX record at line ${lineNo}: malformed hex`)
    }

    const byteCount = parseInt(line.slice(1, 3), 16)
    const expectedLen = 1 + (byteCount + 5) * 2
    if (line.length !== expectedLen) {
      throw new Error(`Invalid Intel HEX record length at line ${lineNo}`)
    }

    const bytes = []
    for (let i = 1; i < line.length; i += 2) {
      bytes.push(parseInt(line.slice(i, i + 2), 16))
    }
    if ((bytes.reduce((sum, byte) => sum + byte, 0) & 0xFF) !== 0) {
      throw new Error(`Invalid Intel HEX checksum at line ${lineNo}`)
    }

    const address = (bytes[1] << 8) + bytes[2]
    const recordType = bytes[3]
    const data = bytes.slice(4, 4 + byteCount)

    if (recordType === 0x00) {
      const fullAddr = upperAddr + address
      for (let i = 0; i < byteCount; i++) {
        dataMap.set(fullAddr + i, data[i])
      }
    } else if (recordType === 0x01) {
      if (byteCount !== 0) throw new Error(`Invalid Intel HEX EOF length at line ${lineNo}`)
      break
    } else if (recordType === 0x02) {
      if (byteCount !== 2) throw new Error(`Invalid Intel HEX segment address length at line ${lineNo}`)
      upperAddr = ((data[0] << 8) + data[1]) * 16
    } else if (recordType === 0x03) {
      if (byteCount !== 4) throw new Error(`Invalid Intel HEX start segment length at line ${lineNo}`)
      const cs = (data[0] << 8) + data[1]
      const ip = (data[2] << 8) + data[3]
      startAddr = cs * 16 + ip
    } else if (recordType === 0x04) {
      if (byteCount !== 2) throw new Error(`Invalid Intel HEX linear address length at line ${lineNo}`)
      upperAddr = ((data[0] << 8) + data[1]) * 0x10000
    } else if (recordType === 0x05) {
      if (byteCount !== 4) throw new Error(`Invalid Intel HEX start linear length at line ${lineNo}`)
      startAddr = data.reduce((value, byte) => (value * 0x100) + byte, 0)
    }
  }

  if (!dataMap.size) return { baseAddr: 0, data: new Uint8Array(0) }

  const addrs = [...dataMap.keys()]
  const minAddr = Math.min(...addrs)
  const maxAddr = Math.max(...addrs)
  const result = new Uint8Array(maxAddr - minAddr + 1)
  for (const [addr, byte] of dataMap) {
    result[addr - minAddr] = byte
  }
  return { baseAddr: minAddr, data: result }
}

/**
 * 解析 Motorola S-Record (S19) 格式
 */
export function parseSrec(content) {
  if (typeof content !== 'string') {
    throw new TypeError('S-Record content must be a string')
  }
  const dataMap = new Map()

  let lineNo = 0
  for (const raw of content.split(/\r?\n/)) {
    lineNo++
    const line = raw.trim()
    if (!line.startsWith('S')) continue
    if (!/^S[0-9][0-9A-Fa-f]+$/.test(line) || line.length < 4 || line.length % 2 !== 0) {
      throw new Error(`Invalid S-Record at line ${lineNo}: malformed hex`)
    }

    const recordType = line[1]
    const byteCount = parseInt(line.slice(2, 4), 16)
    if (line.length !== 4 + byteCount * 2) {
      throw new Error(`Invalid S-Record length at line ${lineNo}`)
    }

    const bytes = []
    for (let i = 2; i < line.length; i += 2) {
      bytes.push(parseInt(line.slice(i, i + 2), 16))
    }
    if ((bytes.reduce((sum, byte) => sum + byte, 0) & 0xFF) !== 0xFF) {
      throw new Error(`Invalid S-Record checksum at line ${lineNo}`)
    }

    let addrBytes
    if (recordType === '1') addrBytes = 2
    else if (recordType === '2') addrBytes = 3
    else if (recordType === '3') addrBytes = 4
    else continue

    const payload = bytes.slice(1, -1)
    const addressBytes = payload.slice(0, addrBytes)
    const dataBytes = payload.slice(addrBytes)
    const address = addressBytes.reduce((value, byte) => (value * 0x100) + byte, 0)

    for (let i = 0; i < dataBytes.length; i++) {
      dataMap.set(address + i, dataBytes[i])
    }
  }

  if (!dataMap.size) return { baseAddr: 0, data: new Uint8Array(0) }

  const addrs = [...dataMap.keys()]
  const minAddr = Math.min(...addrs)
  const maxAddr = Math.max(...addrs)
  const result = new Uint8Array(maxAddr - minAddr + 1)
  for (const [addr, byte] of dataMap) {
    result[addr - minAddr] = byte
  }
  return { baseAddr: minAddr, data: result }
}

/**
 * 自动检测并解析固件文件
 */
export function detectAndParse(content, filename) {
  if (content instanceof Uint8Array) {
    return { baseAddr: 0, data: content }
  }
  if (content instanceof ArrayBuffer) {
    return { baseAddr: 0, data: new Uint8Array(content) }
  }
  if (typeof content !== 'string') {
    return { baseAddr: 0, data: new Uint8Array(0) }
  }
  const trimmed = content.trim()
  if (trimmed.startsWith(':')) return parseIntelHex(content)
  if (trimmed.startsWith('S')) return parseSrec(content)
  return { baseAddr: 0, data: new Uint8Array(0) }
}

/**
 * 生成 Intel HEX 格式
 */
export function generateIntelHex(data, baseAddr) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const lines = []
  let currentUpper = null

  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, Math.min(i + 16, bytes.length))
    const absAddr = baseAddr + i
    const upperAddr = Math.floor(absAddr / 0x10000) & 0xFFFF
    const lowerAddr = absAddr % 0x10000

    if (upperAddr !== currentUpper) {
      let sum = 0x02 + 0x00 + 0x00 + 0x04 + ((upperAddr >> 8) & 0xFF) + (upperAddr & 0xFF)
      sum = ((~sum + 1) & 0xFF)
      lines.push(`:02000004${upperAddr.toString(16).toUpperCase().padStart(4, '0')}${sum.toString(16).toUpperCase().padStart(2, '0')}`)
      currentUpper = upperAddr
    }

    let sum = chunk.length + ((lowerAddr >> 8) & 0xFF) + (lowerAddr & 0xFF) + 0x00
    for (const b of chunk) sum += b
    sum = ((~sum + 1) & 0xFF)

    const dataHex = [...chunk].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')
    lines.push(`:${chunk.length.toString(16).toUpperCase().padStart(2, '0')}${lowerAddr.toString(16).toUpperCase().padStart(4, '0')}00${dataHex}${sum.toString(16).toUpperCase().padStart(2, '0')}`)
  }

  lines.push(':00000001FF')
  return lines.join('\n')
}

/**
 * 生成 Motorola S-Record (S19) 格式
 */
export function generateSrec(data, baseAddr) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const lines = []

  // S0 头记录
  const header = new TextEncoder().encode('HDR')
  const headerCount = 2 + header.length + 1
  let sum = headerCount + 0 + 0 + [...header].reduce((a, b) => a + b, 0)
  sum = (~sum) & 0xFF
  lines.push(`S0${headerCount.toString(16).toUpperCase().padStart(2, '0')}0000${[...header].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')}${sum.toString(16).toUpperCase().padStart(2, '0')}`)

  const maxAddr = baseAddr + bytes.length
  const addrBytes = maxAddr <= 0xFFFF ? 2 : maxAddr <= 0xFFFFFF ? 3 : 4
  const recordType = addrBytes === 2 ? 'S1' : addrBytes === 3 ? 'S2' : 'S3'
  const endType = addrBytes === 2 ? 'S9' : addrBytes === 3 ? 'S8' : 'S7'

  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, Math.min(i + 16, bytes.length))
    const addr = baseAddr + i
    const headerLen = addrBytes + 1
    const totalLen = chunk.length + headerLen

    const addrHex = addr.toString(16).toUpperCase().padStart(addrBytes * 2, '0')
    let addrSum = 0
    for (let j = 0; j < addrBytes; j++) {
      addrSum += (addr >> ((addrBytes - 1 - j) * 8)) & 0xFF
    }

    const dataHex = [...chunk].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')
    sum = totalLen + addrSum + [...chunk].reduce((a, b) => a + b, 0)
    sum = (~sum) & 0xFF

    lines.push(`${recordType}${totalLen.toString(16).toUpperCase().padStart(2, '0')}${addrHex}${dataHex}${sum.toString(16).toUpperCase().padStart(2, '0')}`)
  }

  // 结束记录
  if (endType === 'S9') lines.push('S9030000FC')
  else if (endType === 'S8') lines.push('S804000000FB')
  else lines.push('S70500000000FA')

  return lines.join('\n')
}

/**
 * Hex ↔ Base64
 */
export function hexToBase64(hexStr) {
  const cleaned = hexStr.replace(/\s/g, '')
  if (!/^[0-9A-Fa-f]*$/.test(cleaned) || cleaned.length % 2 !== 0) {
    throw new Error('无效的十六进制字符串')
  }
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16)
  }
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function base64ToHex(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return [...bytes].map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

/**
 * 生成 C 数组代码
 */
export function generateCArray(data, name, dtype, perLine) {
  name = name || 'data'
  dtype = dtype || 'uint8_t'
  perLine = perLine || 16
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const lines = [`const ${dtype} ${name}[${bytes.length}] = {`]
  for (let i = 0; i < bytes.length; i += perLine) {
    const chunk = [...bytes.slice(i, Math.min(i + perLine, bytes.length))]
    lines.push('    ' + chunk.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ') + ',')
  }
  lines.push('};')
  return lines.join('\n')
}

/**
 * 搜索匹配 — Hex模式支持 ?? 通配符
 * @returns {number[]} 匹配的偏移量数组
 */
export function searchHex(data, pattern) {
  const cleaned = pattern.replace(/\s/g, '')
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex search pattern')
  }
  const tokens = []
  for (let i = 0; i < cleaned.length; i += 2) {
    const tok = cleaned.slice(i, i + 2).toUpperCase()
    if (tok !== '??' && !/^[0-9A-F]{2}$/.test(tok)) {
      throw new Error('Invalid hex search pattern')
    }
    tokens.push(tok === '??' ? null : parseInt(tok, 16))
  }
  if (!tokens.length) return []

  const results = []
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  for (let i = 0; i <= bytes.length - tokens.length; i++) {
    let match = true
    for (let j = 0; j < tokens.length; j++) {
      if (tokens[j] !== null && bytes[i + j] !== tokens[j]) {
        match = false
        break
      }
    }
    if (match) results.push(i)
  }
  return results
}

export function searchAscii(data, pattern) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const search = new TextEncoder().encode(pattern)
  const results = []
  for (let i = 0; i <= bytes.length - search.length; i++) {
    let match = true
    for (let j = 0; j < search.length; j++) {
      if (bytes[i + j] !== search[j]) { match = false; break }
    }
    if (match) results.push(i)
  }
  return results
}
