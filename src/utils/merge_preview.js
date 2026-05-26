const DEFAULT_COLORS = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#1abc9c', '#e74c3c', '#f39c12', '#2980b9']

export function createMergePreviewModel(files, options = {}) {
  const mode = options.mode === 'concat' ? 'concat' : 'address'
  const colors = options.colors?.length ? options.colors : DEFAULT_COLORS
  const widthUnits = positiveNumber(options.widthUnits, 1000)
  const minHitUnits = positiveNumber(options.minHitUnits, 10)
  const sourceFiles = Array.isArray(files) ? files : []
  const items = sourceFiles
    .map((file, idx) => ({
      idx,
      name: file?.name || `file-${idx + 1}`,
      baseAddr: numeric(file?.baseAddr, 0),
      size: Math.max(0, numeric(file?.size, file?.data?.length || 0)),
      color: colors[idx % colors.length],
    }))
    .filter(file => file.size > 0)

  if (!items.length) {
    return emptyModel(mode)
  }

  const positioned = mode === 'concat'
    ? positionConcatenated(items)
    : positionAddressed(items)
  const minAddr = Math.min(...positioned.map(file => file.start))
  let maxAddr = Math.max(...positioned.map(file => file.end))
  if (maxAddr <= minAddr) maxAddr = minAddr + 1
  const totalRange = maxAddr - minAddr
  const scale = mode === 'address'
    ? createCompressedAddressScale(positioned, minAddr, maxAddr, widthUnits, options)
    : createLinearScale(minAddr, totalRange, widthUnits)

  const filesModel = positioned.map(file => {
    const x = scale.toUnits(file.start)
    const endX = scale.toUnits(file.end)
    const width = Math.max(0, endX - x)
    const hit = hitBounds(x, width, widthUnits, minHitUnits)
    return {
      ...file,
      endInclusive: file.end - 1,
      x,
      width,
      hitX: hit.x,
      hitWidth: hit.width,
      label: `${file.name}`,
    }
  })

  const gaps = mode === 'address'
    ? buildGaps(filesModel, minAddr, maxAddr, scale)
    : []
  const conflicts = mode === 'address'
    ? buildConflicts(filesModel, scale)
    : []
  const viewport = buildViewport(options, minAddr, maxAddr, scale, widthUnits)
  const detail = buildDetailModel(positioned, conflicts, viewport, {
    mode,
    widthUnits: positiveNumber(options.detailWidthUnits, widthUnits),
    minHitUnits,
    maxTicks: options.detailMaxTicks || 6,
  })

  return {
    mode,
    minAddr,
    maxAddr,
    maxInclusive: maxAddr - 1,
    totalRange,
    totalData: items.reduce((sum, file) => sum + file.size, 0),
    gapSize: gaps.reduce((sum, gap) => sum + gap.size, 0),
    files: filesModel,
    gaps,
    conflicts,
    viewport,
    detail,
    ticks: scale.compressed
      ? buildBoundaryTicks(positioned, minAddr, maxAddr, scale, options.maxTicks || 8)
      : buildTicks(minAddr, maxAddr, totalRange, scale, options.maxTicks || 6),
  }
}

function emptyModel(mode) {
  return {
    mode,
    minAddr: 0,
    maxAddr: 0,
    maxInclusive: 0,
    totalRange: 0,
    totalData: 0,
    gapSize: 0,
    files: [],
    gaps: [],
    conflicts: [],
    viewport: { start: 0, end: 0, x: 0, width: 0 },
    detail: { files: [], gaps: [], conflicts: [], ticks: [], minAddr: 0, maxAddr: 0, totalRange: 0 },
    ticks: [],
  }
}

function positionConcatenated(items) {
  let cursor = 0
  return items.map(file => {
    const start = cursor
    cursor += file.size
    return { ...file, start, end: cursor }
  })
}

function positionAddressed(items) {
  return items.map(file => ({
    ...file,
    start: file.baseAddr,
    end: file.baseAddr + file.size,
  }))
}

function buildGaps(files, minAddr, maxAddr, scale) {
  const sorted = [...files].sort((a, b) => a.start - b.start || a.end - b.end)
  const gaps = []
  let cursor = minAddr

  for (const file of sorted) {
    if (file.start > cursor) {
      const x = scale.toUnits(cursor)
      const endX = scale.toUnits(file.start)
      gaps.push({
        start: cursor,
        end: file.start,
        endInclusive: file.start - 1,
        size: file.start - cursor,
        x,
        width: Math.max(0, endX - x),
      })
    }
    cursor = Math.max(cursor, file.end)
  }

  if (cursor < maxAddr) {
    const x = scale.toUnits(cursor)
    const endX = scale.toUnits(maxAddr)
    gaps.push({
      start: cursor,
      end: maxAddr,
      endInclusive: maxAddr - 1,
      size: maxAddr - cursor,
      x,
      width: Math.max(0, endX - x),
    })
  }

  return gaps
}

function buildConflicts(files, scale) {
  const events = []
  for (const file of files) {
    events.push({ addr: file.start, type: 'start', idx: file.idx, name: file.name })
    events.push({ addr: file.end, type: 'end', idx: file.idx, name: file.name })
  }
  events.sort((a, b) => a.addr - b.addr)

  const active = new Map()
  const conflicts = []
  let prev = events[0]?.addr ?? 0
  let pos = 0

  while (pos < events.length) {
    const addr = events[pos].addr
    if (addr > prev && active.size > 1) {
      const x = scale.toUnits(prev)
      const endX = scale.toUnits(addr)
      const activeFiles = [...active.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([idx, name]) => ({ idx, name }))
      conflicts.push({
        start: prev,
        end: addr,
        endInclusive: addr - 1,
        size: addr - prev,
        x,
        width: Math.max(0, endX - x),
        fileIndexes: activeFiles.map(file => file.idx),
        fileNames: activeFiles.map(file => file.name),
      })
    }

    while (pos < events.length && events[pos].addr === addr) {
      const event = events[pos]
      if (event.type === 'end') active.delete(event.idx)
      else active.set(event.idx, event.name)
      pos += 1
    }
    prev = addr
  }

  return conflicts
}

function buildViewport(options, minAddr, maxAddr, overviewScale, widthUnits) {
  let start = numeric(options.viewportStart, minAddr)
  let end = numeric(options.viewportEnd, maxAddr)
  start = Math.max(minAddr, Math.min(maxAddr, start))
  end = Math.max(minAddr, Math.min(maxAddr, end))
  if (end <= start) {
    start = minAddr
    end = maxAddr
  }
  const x = overviewScale.toUnits(start)
  const endX = overviewScale.toUnits(end)
  return {
    start,
    end,
    endInclusive: end - 1,
    x,
    width: Math.max(1, Math.min(widthUnits - x, endX - x)),
  }
}

function buildDetailModel(files, conflicts, viewport, options) {
  const minAddr = viewport.start
  const maxAddr = viewport.end
  const totalRange = Math.max(1, maxAddr - minAddr)
  const scale = createLinearScale(minAddr, totalRange, options.widthUnits)
  const clippedFiles = files
    .map(file => clipRange(file, minAddr, maxAddr))
    .filter(Boolean)
    .map(file => {
      const x = scale.toUnits(file.start)
      const endX = scale.toUnits(file.end)
      const width = Math.max(0, endX - x)
      const hit = hitBounds(x, width, options.widthUnits, options.minHitUnits)
      return {
        ...file,
        endInclusive: file.end - 1,
        x,
        width,
        hitX: hit.x,
        hitWidth: hit.width,
      }
    })
  const clippedConflicts = conflicts
    .map(conflict => clipRange(conflict, minAddr, maxAddr))
    .filter(Boolean)
    .map(conflict => {
      const x = scale.toUnits(conflict.start)
      const endX = scale.toUnits(conflict.end)
      return {
        ...conflict,
        endInclusive: conflict.end - 1,
        x,
        width: Math.max(0, endX - x),
      }
    })

  return {
    minAddr,
    maxAddr,
    maxInclusive: maxAddr - 1,
    totalRange,
    files: clippedFiles,
    gaps: options.mode === 'address'
      ? buildGaps(clippedFiles, minAddr, maxAddr, scale)
      : [],
    conflicts: options.mode === 'address' ? clippedConflicts : [],
    ticks: buildTicks(minAddr, maxAddr, totalRange, scale, options.maxTicks),
  }
}

function clipRange(item, start, end) {
  const nextStart = Math.max(item.start, start)
  const nextEnd = Math.min(item.end, end)
  if (nextEnd <= nextStart) return null
  return {
    ...item,
    start: nextStart,
    end: nextEnd,
    size: nextEnd - nextStart,
  }
}

function buildTicks(minAddr, maxAddr, totalRange, scale, maxTicks) {
  if (totalRange <= 0) return []
  const target = Math.max(2, Math.min(8, Math.floor(maxTicks)))
  const step = niceStep(totalRange / (target - 1))
  const seen = new Set()
  const ticks = []
  const addTick = addr => {
    const clamped = Math.min(maxAddr, Math.max(minAddr, addr))
    if (seen.has(clamped)) return
    seen.add(clamped)
    ticks.push({
      addr: clamped,
      x: scale.toUnits(clamped),
    })
  }

  addTick(minAddr)
  for (let addr = Math.ceil(minAddr / step) * step; addr < maxAddr; addr += step) {
    addTick(addr)
  }
  addTick(maxAddr)

  return ticks.sort((a, b) => a.addr - b.addr)
}

function buildBoundaryTicks(files, minAddr, maxAddr, scale, maxTicks) {
  const addresses = [minAddr]
  for (const file of [...files].sort((a, b) => a.start - b.start || a.end - b.end)) {
    addresses.push(file.start, file.end)
  }
  addresses.push(maxAddr)

  const unique = [...new Set(addresses)]
    .filter(addr => addr >= minAddr && addr <= maxAddr)
    .sort((a, b) => a - b)
  const limit = Math.max(2, Math.min(12, Math.floor(maxTicks)))
  const chosen = unique.length <= limit
    ? unique
    : reduceTicks(unique, limit)

  return chosen.map(addr => ({ addr, x: scale.toUnits(addr) }))
}

function reduceTicks(ticks, limit) {
  if (ticks.length <= limit) return ticks
  const result = [ticks[0]]
  const innerSlots = limit - 2
  for (let i = 1; i <= innerSlots; i++) {
    const idx = Math.round((i * (ticks.length - 1)) / (innerSlots + 1))
    result.push(ticks[idx])
  }
  result.push(ticks[ticks.length - 1])
  return [...new Set(result)].sort((a, b) => a - b)
}

function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1
  const exponent = Math.floor(Math.log10(rawStep))
  const magnitude = 10 ** exponent
  const fraction = rawStep / magnitude
  if (fraction <= 1) return magnitude
  if (fraction <= 2) return 2 * magnitude
  if (fraction <= 5) return 5 * magnitude
  return 10 * magnitude
}

function toUnits(addr, minAddr, totalRange, widthUnits) {
  if (totalRange <= 0) return 0
  return ((addr - minAddr) / totalRange) * widthUnits
}

function createLinearScale(minAddr, totalRange, widthUnits) {
  return {
    compressed: false,
    toUnits: addr => toUnits(addr, minAddr, totalRange, widthUnits),
  }
}

function createCompressedAddressScale(files, minAddr, maxAddr, widthUnits, options) {
  const occupied = mergeIntervals(files)
  const occupiedSize = occupied.reduce((sum, range) => sum + range.end - range.start, 0)
  const largestOccupied = occupied.reduce((max, range) => Math.max(max, range.end - range.start), 0)
  const gapWeightCap = positiveNumber(
    options.compressedGapWeight,
    Math.max(occupiedSize * 0.8, largestOccupied * 0.8, 4096),
  )
  const segments = []
  let cursor = minAddr

  for (const range of occupied) {
    if (range.start > cursor) {
      segments.push(createScaleSegment(cursor, range.start, Math.min(range.start - cursor, gapWeightCap)))
    }
    segments.push(createScaleSegment(range.start, range.end, range.end - range.start))
    cursor = Math.max(cursor, range.end)
  }

  if (cursor < maxAddr) {
    segments.push(createScaleSegment(cursor, maxAddr, Math.min(maxAddr - cursor, gapWeightCap)))
  }

  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0)
  if (totalWeight <= 0) return createLinearScale(minAddr, maxAddr - minAddr, widthUnits)

  let cursorWeight = 0
  for (const segment of segments) {
    segment.unitStart = (cursorWeight / totalWeight) * widthUnits
    cursorWeight += segment.weight
    segment.unitEnd = (cursorWeight / totalWeight) * widthUnits
  }

  return {
    compressed: true,
    toUnits(addr) {
      if (addr <= minAddr) return 0
      if (addr >= maxAddr) return widthUnits
      const segment = segments.find(item => addr >= item.start && addr <= item.end)
      if (!segment || segment.end <= segment.start) return 0
      const ratio = (addr - segment.start) / (segment.end - segment.start)
      return segment.unitStart + ratio * (segment.unitEnd - segment.unitStart)
    },
  }
}

function createScaleSegment(start, end, weight) {
  return {
    start,
    end,
    weight: Math.max(1, weight),
    unitStart: 0,
    unitEnd: 0,
  }
}

function mergeIntervals(files) {
  const sorted = files
    .map(file => ({ start: file.start, end: file.end }))
    .filter(range => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = []

  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (!last || range.start > last.end) {
      merged.push({ ...range })
    } else {
      last.end = Math.max(last.end, range.end)
    }
  }

  return merged
}

function hitBounds(x, width, widthUnits, minHitUnits) {
  if (width >= minHitUnits) return { x, width }
  const center = x + width / 2
  const hitWidth = Math.min(minHitUnits, widthUnits)
  let hitX = center - hitWidth / 2
  hitX = Math.max(0, Math.min(widthUnits - hitWidth, hitX))
  return { x: hitX, width: hitWidth }
}

function numeric(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}
