<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  data: { type: Uint8Array, default: () => new Uint8Array(0) },
  baseOffset: { type: Number, default: 0 },
  bytesPerLine: { type: Number, default: 16 },
  editable: { type: Boolean, default: true },
  searchResults: { type: Array, default: () => [] },
  currentSearchIdx: { type: Number, default: -1 },
})

const emit = defineEmits(['byteSelected', 'dataChanged', 'gotoLine'])

const canvas = ref(null)
const editInput = ref(null)
const container = ref(null)

const CELL_W = 24
const CELL_H = 20
const ADDR_W = 72
const GAP_W = 8
const ASCII_W = 13
const PAD = 4
const HEADER_H = 22

const rowCount = ref(0)
const scrollTop = ref(0)
const visibleStart = ref(0)
const visibleEnd = ref(0)
const totalHeight = ref(0)
const viewportHeight = ref(500)
const spacerHeight = computed(() => Math.max(0, totalHeight.value - viewportHeight.value))

// Selection & editing
const selectedOffset = ref(-1)
const editingOffset = ref(-1)
const editingByte = ref('')
const modifiedSet = ref(new Set())

// Internal data (mutable for editing)
const internalData = ref(new Uint8Array(0))

watch(() => props.data, (val) => {
  internalData.value = new Uint8Array(val || new Uint8Array(0))
  modifiedSet.value = new Set()
  rowCount.value = Math.ceil(internalData.value.length / props.bytesPerLine)
  totalHeight.value = HEADER_H + rowCount.value * CELL_H
  selectedOffset.value = -1
  editingOffset.value = -1
  draw()
}, { immediate: true })

watch(() => props.searchResults, draw)
watch(() => props.currentSearchIdx, (idx) => {
  const off = props.searchResults[idx]
  if (Number.isInteger(off)) scrollToOffset(off)
  draw()
})
watch(() => props.baseOffset, draw)

const CHARS = '.'
function toAscii(b) {
  return (b >= 32 && b < 127) ? String.fromCharCode(b) : '.'
}

function isDark() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function draw() {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  const dk = isDark()
  const W = props.bytesPerLine * CELL_W + ADDR_W + GAP_W + props.bytesPerLine * ASCII_W + PAD * 2
  const H = container.value?.clientHeight || 500
  const dpr = window.devicePixelRatio || 1
  viewportHeight.value = H

  c.width = Math.floor(W * dpr)
  c.height = Math.floor(H * dpr)
  c.style.width = W + 'px'
  c.style.height = H + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.clearRect(0, 0, W, H)

  const textColor = dk ? '#ddd' : '#333'
  const dimColor = dk ? '#777' : '#999'
  const headerBg = dk ? '#2a2a2a' : '#eaeaea'
  const rowEven = dk ? '#252525' : '#f8f8f8'
  const rowOdd = dk ? '#2a2a2a' : '#f0f0f0'
  const selBg = dk ? 'rgba(77,182,172,0.3)' : 'rgba(0,150,136,0.15)'
  const searchBg = dk ? 'rgba(255,193,7,0.35)' : 'rgba(255,152,0,0.25)'
  const modColor = dk ? '#e57373' : '#d32f2f'
  const borderColor = dk ? '#444' : '#ddd'

  // Header
  ctx.fillStyle = headerBg
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, HEADER_H)
  ctx.lineTo(W, HEADER_H)
  ctx.stroke()

  ctx.fillStyle = dimColor
  ctx.font = '11px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Offset', PAD + 4, HEADER_H / 2)

  ctx.textAlign = 'center'
  for (let i = 0; i < props.bytesPerLine; i++) {
    const x = PAD + ADDR_W + GAP_W + i * CELL_W + CELL_W / 2
    ctx.fillText(i.toString(16).toUpperCase().padStart(2, '0'), x, HEADER_H / 2)
  }

  ctx.textAlign = 'left'
  const asciiX = PAD + ADDR_W + GAP_W + props.bytesPerLine * CELL_W + 6
  ctx.fillText('ASCII', asciiX, HEADER_H / 2)

  // Row range
  const bodyScrollTop = Math.max(0, scrollTop.value - HEADER_H)
  const startRow = Math.max(0, Math.floor(bodyScrollTop / CELL_H))
  const endRow = Math.min(rowCount.value, startRow + Math.ceil(H / CELL_H) + 1)
  visibleStart.value = startRow
  visibleEnd.value = endRow

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, HEADER_H, W, Math.max(0, H - HEADER_H))
  ctx.clip()

  // Draw rows
  for (let r = startRow; r < endRow; r++) {
    const y = HEADER_H + r * CELL_H - scrollTop.value
    const addr = props.baseOffset + r * props.bytesPerLine
    const isSel = selectedOffset.value >= r * props.bytesPerLine && selectedOffset.value < (r + 1) * props.bytesPerLine

    ctx.fillStyle = isSel ? selBg : (r % 2 === 0 ? rowEven : rowOdd)
    ctx.fillRect(0, y, W, CELL_H)

    // Address
    ctx.fillStyle = textColor
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(addr.toString(16).toUpperCase().padStart(8, '0'), PAD + 4, y + CELL_H / 2)

    // Hex bytes
    ctx.textAlign = 'center'
    for (let b = 0; b < props.bytesPerLine; b++) {
      const offset = r * props.bytesPerLine + b
      if (offset >= internalData.value.length) break
      const byte = internalData.value[offset]
      const x = PAD + ADDR_W + GAP_W + b * CELL_W + CELL_W / 2

      const isModified = modifiedSet.value.has(offset)
      const isSearchHit = props.searchResults.includes(offset)
      const isActive = props.currentSearchIdx >= 0 && props.searchResults[props.currentSearchIdx] === offset
      const selCol = selectedOffset.value === offset

      if (isActive) {
        ctx.fillStyle = 'rgba(255,235,59,0.5)'
        ctx.fillRect(x - CELL_W / 2 + 1, y + 1, CELL_W - 2, CELL_H - 2)
      } else if (isSearchHit) {
        ctx.fillStyle = searchBg
        ctx.fillRect(x - CELL_W / 2 + 1, y + 1, CELL_W - 2, CELL_H - 2)
      }
      if (selCol && !isActive) {
        ctx.fillStyle = selBg
        ctx.fillRect(x - CELL_W / 2 + 1, y + 1, CELL_W - 2, CELL_H - 2)
      }

      ctx.fillStyle = isModified ? modColor : textColor
      ctx.font = (isModified ? 'bold ' : '') + '12px monospace'
      ctx.fillText(byte.toString(16).toUpperCase().padStart(2, '0'), x, y + CELL_H / 2)
    }

    // ASCII
    ctx.textAlign = 'left'
    for (let b = 0; b < props.bytesPerLine; b++) {
      const offset = r * props.bytesPerLine + b
      if (offset >= internalData.value.length) break
      const byte = internalData.value[offset]
      const x = asciiX + b * ASCII_W
      const isModified = modifiedSet.value.has(offset)
      ctx.fillStyle = isModified ? modColor : dimColor
      ctx.font = '11px monospace'
      ctx.fillText(toAscii(byte), x, y + CELL_H / 2)
    }
  }
  ctx.restore()

  // Separator line between hex and ASCII
  const sepX = PAD + ADDR_W + GAP_W + props.bytesPerLine * CELL_W + 2
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(sepX, HEADER_H)
  ctx.lineTo(sepX, H)
  ctx.stroke()
}

function handleScroll() {
  scrollTop.value = container.value?.scrollTop || 0
  draw()
}

function getOffsetFromEvent(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const col = Math.floor((x - PAD - ADDR_W - GAP_W) / CELL_W)
  const bodyScrollTop = Math.max(0, scrollTop.value - HEADER_H)
  const row = Math.floor((y - HEADER_H + bodyScrollTop) / CELL_H)
  if (col < 0 || col >= props.bytesPerLine || row < 0 || row >= rowCount.value) return -1
  return row * props.bytesPerLine + col
}

function handleClick(e) {
  const off = getOffsetFromEvent(e)
  if (off >= 0 && off < internalData.value.length) {
    selectedOffset.value = off
    emit('byteSelected', off, internalData.value.slice(off))
    draw()
  }
}

function handleDblClick(e) {
  if (!props.editable) return
  const off = getOffsetFromEvent(e)
  if (off >= 0 && off < internalData.value.length) {
    editingOffset.value = off
    editingByte.value = internalData.value[off].toString(16).toUpperCase().padStart(2, '0')
    nextTick(() => {
      editInput.value?.focus()
      editInput.value?.select()
    })
  }
}

function commitEdit() {
  if (editingOffset.value < 0) return
  const val = parseInt(editingByte.value, 16)
  if (!isNaN(val) && val >= 0 && val <= 255) {
    const old = internalData.value[editingOffset.value]
    internalData.value[editingOffset.value] = val
    modifiedSet.value = new Set([...modifiedSet.value, editingOffset.value])
    emit('dataChanged', editingOffset.value, old, val)
    emit('byteSelected', editingOffset.value, internalData.value.slice(editingOffset.value))
  }
  editingOffset.value = -1
  draw()
}

function cancelEdit() {
  editingOffset.value = -1
  draw()
}

function handleEditKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
  if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
}

function handleKeydown(e) {
  if (editingOffset.value >= 0) return
  const off = selectedOffset.value
  if (off < 0) return

  let newOff = off
  if (e.key === 'ArrowUp') newOff = Math.max(0, off - props.bytesPerLine)
  else if (e.key === 'ArrowDown') newOff = Math.min(internalData.value.length - 1, off + props.bytesPerLine)
  else if (e.key === 'ArrowLeft') newOff = Math.max(0, off - 1)
  else if (e.key === 'ArrowRight') newOff = Math.min(internalData.value.length - 1, off + 1)
  else if (e.key === 'PageUp') newOff = Math.max(0, off - props.bytesPerLine * 8)
  else if (e.key === 'PageDown') newOff = Math.min(internalData.value.length - 1, off + props.bytesPerLine * 8)
  else if (e.key === 'Home') newOff = off - (off % props.bytesPerLine)
  else if (e.key === 'End') newOff = Math.min(internalData.value.length - 1, off - (off % props.bytesPerLine) + props.bytesPerLine - 1)
  else return

  e.preventDefault()
  selectedOffset.value = newOff
  scrollToOffset(newOff)
  emit('byteSelected', newOff, internalData.value.slice(newOff))
  draw()
}

function scrollToOffset(off) {
  const row = Math.floor(off / props.bytesPerLine)
  const y = HEADER_H + row * CELL_H
  const ch = container.value?.clientHeight || 500
  if (container.value) {
    container.value.scrollTop = Math.max(0, y - ch / 3)
    scrollTop.value = container.value.scrollTop
  }
}

function gotoOffset(addr) {
  const off = addr - props.baseOffset
  if (off >= 0 && off < internalData.value.length) {
    selectedOffset.value = off
    scrollToOffset(off)
    emit('byteSelected', off, internalData.value.slice(off))
    draw()
  }
}

defineExpose({ gotoOffset })

onMounted(() => {
  draw()
  if (container.value) {
    container.value.addEventListener('scroll', handleScroll)
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (container.value) {
    container.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="container" class="hex-container">
    <canvas ref="canvas" @click="handleClick" @dblclick="handleDblClick"></canvas>
    <div class="hex-spacer" :style="{ width: '1px', height: spacerHeight + 'px' }"></div>
    <input
      v-if="editingOffset >= 0"
      ref="editInput"
      v-model="editingByte"
      class="hex-edit-input"
      :style="{
        left: (PAD + ADDR_W + GAP_W + (editingOffset % bytesPerLine) * CELL_W + 2) + 'px',
        top: (HEADER_H + Math.floor(editingOffset / bytesPerLine) * CELL_H - scrollTop + 2) + 'px',
        width: (CELL_W - 4) + 'px',
        height: (CELL_H - 4) + 'px'
      }"
      maxlength="2"
      @keydown="handleEditKeydown"
      @blur="commitEdit"
    />
  </div>
</template>

<style scoped>
.hex-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--bg-primary);
}
.hex-container canvas {
  position: sticky;
  top: 0;
  left: 0;
  display: block;
}
.hex-spacer {
  pointer-events: none;
}
.hex-edit-input {
  position: sticky;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 2px;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  outline: none;
  z-index: 20;
}
</style>
