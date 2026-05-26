import {
  detectAndParse,
  generateIntelHex,
  generateSrec,
  parseIntelHex,
  parseSrec,
} from './hextools.js'

const textDecoder = new TextDecoder('utf-8', { fatal: false })

export function parseNumericText(text, fallback = 0) {
  const raw = String(text ?? '').trim()
  if (!raw) return fallback
  const radix = /^[-+]?0x/i.test(raw) ? 16 : 10
  const normalized = raw.replace(/^([-+]?)0x/i, '$1')
  const value = parseInt(normalized, radix)
  return Number.isFinite(value) ? value : fallback
}

export function parseFirmwareBytes(bytes, filename = '') {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0)
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  if (ext === 'hex' || ext === 'ihx') {
    return parseIntelHex(textDecoder.decode(buffer))
  }
  if (ext === 's19' || ext === 'srec' || ext === 'mot') {
    return parseSrec(textDecoder.decode(buffer))
  }

  const sample = textDecoder.decode(buffer.slice(0, Math.min(buffer.length, 4096))).trimStart()
  if (sample.startsWith(':') || sample.startsWith('S')) {
    return detectAndParse(textDecoder.decode(buffer), filename)
  }

  return { baseAddr: 0, data: buffer }
}

export function convertFirmware(parsed, options = {}) {
  const outputFmt = options.outputFmt || 'hex'
  const hasBaseOverride = String(options.baseAddrText ?? '').trim() !== ''
  const base = hasBaseOverride
    ? parseNumericText(options.baseAddrText, parsed.baseAddr || 0)
    : (parsed.baseAddr || 0)

  if (outputFmt === 'bin') {
    return { extension: 'bin', baseAddr: base, data: parsed.data }
  }
  if (outputFmt === 's19') {
    return { extension: 's19', baseAddr: base, data: generateSrec(parsed.data, base) }
  }
  return { extension: 'hex', baseAddr: base, data: generateIntelHex(parsed.data, base) }
}

export function sliceBuffer(buffer, options = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0)
  const start = clamp(parseNumericText(options.startText, 0), 0, bytes.length)
  const end = String(options.lengthText ?? '').trim()
    ? start + Math.max(0, parseNumericText(options.lengthText, 0))
    : parseNumericText(options.endText, bytes.length)
  return bytes.slice(start, clamp(end, start, bytes.length))
}

export function fillBuffer(buffer, options = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0)
  const requestedTarget = Math.max(0, parseNumericText(options.sizeText, bytes.length))
  const target = options.position === 'align'
    ? alignedSize(bytes.length, requestedTarget)
    : requestedTarget
  const fillValue = parseNumericText(options.fillValueText, 0xFF) & 0xFF
  const result = new Uint8Array(target)
  result.fill(fillValue)

  const copyLen = Math.min(bytes.length, target)
  if (options.position === 'head') {
    result.set(bytes.subarray(bytes.length - copyLen), target - copyLen)
  } else {
    result.set(bytes.subarray(0, copyLen), 0)
  }

  return result
}

export function buildSlicePreview(fileSize, options = {}) {
  const totalSize = Math.max(0, parseNumericText(fileSize, 0))
  const start = clamp(parseNumericText(options.startText, 0), 0, totalSize)
  const end = String(options.lengthText ?? '').trim()
    ? start + Math.max(0, parseNumericText(options.lengthText, 0))
    : parseNumericText(options.endText, totalSize)
  const clampedEnd = clamp(end, start, totalSize)
  const outputSize = clampedEnd - start

  return {
    totalSize,
    start,
    end: clampedEnd,
    endInclusive: outputSize ? clampedEnd - 1 : start,
    outputSize,
    beforeSize: start,
    afterSize: Math.max(0, totalSize - clampedEnd),
    selectionLeftPct: percent(start, totalSize),
    selectionWidthPct: percent(outputSize, totalSize),
  }
}

export function buildFillPreview(fileSize, options = {}) {
  const inputSize = Math.max(0, parseNumericText(fileSize, 0))
  const requestedTarget = Math.max(0, parseNumericText(options.sizeText, inputSize))
  const position = ['head', 'align'].includes(options.position) ? options.position : 'tail'
  const targetSize = position === 'align'
    ? alignedSize(inputSize, requestedTarget)
    : requestedTarget
  const fillValue = parseNumericText(options.fillValueText, 0xFF) & 0xFF
  const fillSize = Math.max(0, targetSize - inputSize)
  const truncatedSize = Math.max(0, inputSize - targetSize)
  const dataSize = Math.min(inputSize, targetSize)
  const outputSize = targetSize
  const segments = []

  if (targetSize >= inputSize && position === 'head' && fillSize) {
    segments.push(fillSegment(fillSize, outputSize, fillValue))
  }
  if (dataSize) {
    segments.push({
      kind: 'data',
      size: dataSize,
      widthPct: percent(dataSize, outputSize),
    })
  }
  if (targetSize >= inputSize && position !== 'head' && fillSize) {
    segments.push(fillSegment(fillSize, outputSize, fillValue))
  }

  return {
    inputSize,
    targetSize,
    outputSize,
    fillSize,
    fillValue,
    position,
    truncated: truncatedSize > 0,
    truncatedSize,
    segments,
  }
}

export function mergeFirmwareSegments(segments, options = {}) {
  const items = segments.filter(segment => segment?.data?.length)
  if (!items.length) {
    return { baseAddr: 0, data: new Uint8Array(0), extension: options.outputFmt || 'bin' }
  }

  let baseAddr = 0
  let merged
  if (options.mode === 'concat') {
    const total = items.reduce((sum, segment) => sum + segment.data.length, 0)
    merged = new Uint8Array(total)
    let offset = 0
    for (const segment of items) {
      merged.set(segment.data, offset)
      offset += segment.data.length
    }
  } else {
    const minAddr = Math.min(...items.map(segment => segment.baseAddr || 0))
    const maxAddr = Math.max(...items.map(segment => (segment.baseAddr || 0) + segment.data.length))
    const fillValue = parseNumericText(options.fillValueText, 0xFF) & 0xFF
    baseAddr = minAddr
    merged = new Uint8Array(maxAddr - minAddr)
    merged.fill(fillValue)
    for (const segment of items) {
      merged.set(segment.data, (segment.baseAddr || 0) - minAddr)
    }
  }

  const outputFmt = options.outputFmt || 'bin'
  if (outputFmt === 'hex') {
    return { baseAddr, extension: 'hex', data: generateIntelHex(merged, baseAddr) }
  }
  if (outputFmt === 's19') {
    return { baseAddr, extension: 's19', data: generateSrec(merged, baseAddr) }
  }
  return { baseAddr, extension: 'bin', data: merged }
}

export function replaceByte(buffer, offset, value) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0)
  if (!Number.isInteger(offset) || offset < 0 || offset >= bytes.length) {
    throw new Error('Invalid byte offset')
  }
  if (!Number.isInteger(value) || value < 0 || value > 0xFF) {
    throw new Error('Invalid byte value')
  }
  const next = new Uint8Array(bytes)
  next[offset] = value
  return next
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function percent(value, total) {
  if (!total) return 0
  return (value / total) * 100
}

function fillSegment(size, outputSize, fillValue) {
  return {
    kind: 'fill',
    size,
    fillValue,
    widthPct: percent(size, outputSize),
  }
}

function alignedSize(inputSize, alignment) {
  if (alignment <= 0) return inputSize
  return Math.ceil(inputSize / alignment) * alignment
}
