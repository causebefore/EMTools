<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  width: { type: Number, default: 32 },
  registerValue: { type: [Number, BigInt, String], default: 0 },
  fields: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:registerValue', 'bitClick'])

const canvas = ref(null)
const tooltip = ref({ show: false, x: 0, y: 0, text: '', value: '' })
const hoveredBit = ref(-1)

const bitWidth = 22
const bitHeight = 46
const rowGap = 30
const padding = 12
const infoWidth = 170

// 10 种高饱和度颜色，用于区分不同位域
const FIELD_PALETTE = [
  '#E53935', // 红色
  '#1E88E5', // 蓝色
  '#43A047', // 绿色
  '#FB8C00', // 橙色
  '#8E24AA', // 紫色
  '#00ACC1', // 青色
  '#F4511E', // 深橙
  '#3949AB', // 靛蓝
  '#C0CA33', // 黄绿
  '#D81B60', // 粉红
]

function fieldInfo(bitIndex) {
  for (let idx = 0; idx < props.fields.length; idx++) {
    const f = props.fields[idx]
    if (bitIndex >= f.start && bitIndex <= f.end) {
      return { color: FIELD_PALETTE[idx % FIELD_PALETTE.length], field: f, idx }
    }
  }
  return null
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

onMounted(() => draw())
watch(() => [props.width, props.registerValue, props.fields], draw, { deep: true })

function bitsPerRow() {
  return props.width > 32 ? 32 : props.width
}

function rowCount() {
  return Math.ceil(props.width / bitsPerRow())
}

function bitPosition(displayIndex) {
  const perRow = bitsPerRow()
  const row = Math.floor(displayIndex / perRow)
  const col = displayIndex % perRow
  return {
    bitIndex: props.width - 1 - displayIndex,
    x: padding + col * bitWidth,
    y: padding + row * (bitHeight + rowGap),
    row,
    col,
  }
}

function draw() {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const perRow = bitsPerRow()
  const rows = rowCount()
  const cw = padding * 2 + perRow * bitWidth + (props.fields.length ? infoWidth : 0)
  const ch = padding * 2 + rows * bitHeight + (rows - 1) * rowGap + 30
  c.width = cw
  c.height = ch

  ctx.clearRect(0, 0, cw, ch)

  const textColor = isDark ? '#eee' : '#333'
  const textDim = isDark ? '#888' : '#999'
  const bit0Bg = isDark ? '#3c3c3c' : '#e4e4e4'
  const noFieldBg = isDark ? '#333' : '#ddd'

  // 寄存器背景
  ctx.fillStyle = isDark ? '#252525' : '#fafafa'
  ctx.beginPath()
  const regVal = BigInt(props.registerValue)

  for (let row = 0; row < rows; row++) {
    const rowBits = Math.min(perRow, props.width - row * perRow)
    const y = padding + row * (bitHeight + rowGap)
    ctx.fillStyle = isDark ? '#252525' : '#fafafa'
    ctx.beginPath()
    ctx.roundRect(padding - 2, y - 2, rowBits * bitWidth + 4, bitHeight + 4, 5)
    ctx.fill()
    ctx.strokeStyle = isDark ? '#555' : '#bbb'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 先画位域底色条（字段归属背景色）
  for (let i = 0; i < props.width; i++) {
    const { bitIndex: bi, x, y } = bitPosition(i)
    const info = fieldInfo(bi)
    if (info) {
      const rgb = hexToRgb(info.color)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`
      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, bitWidth - 2, bitHeight - 2, 3)
      ctx.fill()
    }
  }

  // 位域分隔线
  if (props.fields.length) {
    for (let i = 0; i < props.width - 1; i++) {
      const pos = bitPosition(i)
      const nextPos = bitPosition(i + 1)
      if (pos.row !== nextPos.row) continue
      const bi = pos.bitIndex
      const biNext = nextPos.bitIndex
      const fi = fieldInfo(bi)
      const fiNext = fieldInfo(biNext)
      if (fi && fiNext && fi.field !== fiNext.field) {
        const x = nextPos.x
        ctx.strokeStyle = isDark ? '#666' : '#ccc'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.moveTo(x, pos.y + 2)
        ctx.lineTo(x, pos.y + bitHeight - 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  // 画每个位
  for (let i = 0; i < props.width; i++) {
    const { bitIndex: bi, x: bitX, y: bitY } = bitPosition(i)
    const bitVal = (regVal >> BigInt(bi)) & 1n
    const info = fieldInfo(bi)
    const x = bitX + 2
    const y = bitY + 2
    const w = bitWidth - 4
    const h = bitHeight - 4

    if (bitVal) {
      // 位=1: 用字段亮色
      ctx.fillStyle = info ? info.color : '#26A69A'
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 3)
      ctx.fill()

      // 顶部高光
      const rgb2 = info ? hexToRgb(info.color) : { r: 38, g: 166, b: 154 }
      ctx.fillStyle = `rgba(255,255,255,0.25)`
      ctx.beginPath()
      ctx.roundRect(x, y, w, h / 2, [3, 3, 0, 0])
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 1
      ctx.fillText('1', x + w / 2, y + h / 2)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    } else {
      // 位=0: 浅色，若有字段则用字段淡色
      if (info) {
        const rgb = hexToRgb(info.color)
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`
      } else {
        ctx.fillStyle = noFieldBg
      }
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 3)
      ctx.fill()
      ctx.strokeStyle = isDark ? '#4a4a4a' : '#d0d0d0'
      ctx.lineWidth = 0.5
      ctx.stroke()

      ctx.fillStyle = info ? info.color : textDim
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('0', x + w / 2, y + h / 2)
    }
  }

  // 底部字段标尺
  if (props.fields.length) {
    for (let i = 0; i < props.width; i++) {
      const { bitIndex: bi, x, y } = bitPosition(i)
      const info2 = fieldInfo(bi)
      if (info2 && (i === 0 || fieldInfo(bi + 1)?.field !== info2.field)) {
        // 字段起始画标记
        ctx.fillStyle = info2.color
        ctx.fillRect(x, y + bitHeight + 4, 3, 16)
      }
    }
  }

  // 位号
  ctx.fillStyle = textColor
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = 0; i < props.width; i += 4) {
    const { bitIndex, x, y } = bitPosition(i)
    ctx.fillText(String(bitIndex), x + bitWidth / 2, y + bitHeight + 22)
  }

  // MSB/LSB
  ctx.font = 'bold 10px sans-serif'
  ctx.fillStyle = textDim
  ctx.textAlign = 'left'
  ctx.fillText('MSB', padding, padding - 6)
  ctx.textAlign = 'right'
  ctx.fillText('LSB', padding + Math.min(perRow, props.width) * bitWidth, padding + (rows - 1) * (bitHeight + rowGap) - 6)

  // 右侧图例
  if (props.fields.length) {
    const lx = padding + perRow * bitWidth + 14
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let idx = 0; idx < props.fields.length; idx++) {
      const f2 = props.fields[idx]
      const y2 = padding + idx * 22 + 10
      const c2 = FIELD_PALETTE[idx % FIELD_PALETTE.length]

      ctx.fillStyle = c2
      ctx.beginPath()
      ctx.roundRect(lx, y2 - 7, 14, 14, 3)
      ctx.fill()

      ctx.fillStyle = textColor
      ctx.font = '12px sans-serif'
      ctx.fillText(`${f2.name}`, lx + 20, y2)

      ctx.fillStyle = textDim
      ctx.font = '10px monospace'
      ctx.fillText(`[${f2.end}:${f2.start}]`, lx + 20 + ctx.measureText(f2.name).width + 8, y2)
    }
  }
}

function bitFromEvent(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left - padding
  const y = e.clientY - rect.top - padding
  const perRow = bitsPerRow()
  const rowStride = bitHeight + rowGap
  const row = Math.floor(y / rowStride)
  const rowY = y - row * rowStride
  const col = Math.floor(x / bitWidth)
  if (x < 0 || rowY < 0 || rowY >= bitHeight || row < 0 || row >= rowCount()) return -1
  if (col < 0 || col >= perRow) return -1
  const bitIndex = props.width - 1 - (row * perRow + col)
  return bitIndex >= 0 ? bitIndex : -1
}

function handleClick(e) {
  if (!props.editable) return
  const bi = bitFromEvent(e)
  if (bi >= 0) emit('bitClick', bi)
}

function handleMove(e) {
  const bi = bitFromEvent(e)
  if (bi >= 0 && bi !== hoveredBit.value) {
    hoveredBit.value = bi
    const info = fieldInfo(bi)
    const regVal = BigInt(props.registerValue)
    const bv = (regVal >> BigInt(bi)) & 1n
    const rect = canvas.value.getBoundingClientRect()
    tooltip.value = {
      show: true,
      x: e.clientX - rect.left + 14,
      y: e.clientY - rect.top - 30,
      text: info ? `${info.field.name}` : `Bit ${bi}`,
      value: `= ${bv}`,
    }
  }
}

function handleLeave() {
  hoveredBit.value = -1
  tooltip.value.show = false
}
</script>

<template>
  <div style="position:relative;width:100%">
    <canvas ref="canvas"
      @click="handleClick"
      @mousemove="handleMove"
      @mouseleave="handleLeave"
      :style="{ cursor: editable ? 'pointer' : 'default', maxWidth: '100%', height: 'auto' }"
    ></canvas>
    <div v-if="tooltip.show" class="bit-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <b>{{ tooltip.text }}</b> {{ tooltip.value }}
    </div>
  </div>
</template>

<style scoped>
.bit-tooltip {
  position: absolute;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  box-shadow: var(--shadow);
}
</style>
