<script setup>
import { ref, computed, nextTick, inject, onUnmounted } from 'vue'
import {
  mergeFirmwareSegments,
  parseFirmwareBytes,
  parseNumericText,
} from '../../../utils/hex_filetools.js'
import { createMergePreviewModel } from '../../../utils/merge_preview.js'

const copyText = inject('copyText', () => {})

// ===== 文件合并 =====
const mergeFiles = ref([])
const mergeMode = ref('address')
const mergeOutputFmt = ref('bin')
const mergeFillVal = ref('0xFF')

const FILE_COLORS = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#1abc9c', '#e74c3c', '#f39c12', '#2980b9']
function fileColor(idx) { return FILE_COLORS[idx % FILE_COLORS.length] }

const MERGE_TIMELINE_WIDTH = 1000
const MERGE_MIN_HIT_WIDTH = 10
const mergeViewportOverride = ref(null)

const activeMergeViewport = computed(() => {
  if (!mergeFiles.value.length) return null
  if (mergeViewportOverride.value) return mergeViewportOverride.value
  const conflict = findFirstRawConflict()
  if (conflict) return paddedRange(conflict.start, conflict.end)
  const file = mergeFiles.value[selectedMergeIdx.value] || mergeFiles.value[0]
  return rangeForFile(file, mergeFiles.value.indexOf(file))
})

const mergePreview = computed(() => createMergePreviewModel(mergeFiles.value, {
  mode: mergeMode.value,
  colors: FILE_COLORS,
  widthUnits: MERGE_TIMELINE_WIDTH,
  detailWidthUnits: MERGE_TIMELINE_WIDTH,
  minHitUnits: MERGE_MIN_HIT_WIDTH,
  viewportStart: activeMergeViewport.value?.start,
  viewportEnd: activeMergeViewport.value?.end,
}))

const mergeConflicts = computed(() => mergePreview.value.conflicts)

// 合并统计
const mergeStats = computed(() => {
  const model = mergePreview.value
  if (!model.files.length) return null
  return {
    totalRange: model.totalRange,
    totalData: model.totalData,
    gapSize: model.gapSize,
    minAddr: model.minAddr,
    maxAddr: Math.max(model.minAddr, model.maxInclusive),
  }
})

const selectedMergeIdx = ref(null)
const selectedMergeConflictIdx = ref(null)
const mergeTooltip = ref(null)
let mergeTooltipFrame = 0
let pendingMergeTooltip = null

const mergeDetailHeight = computed(() => Math.min(360, Math.max(138, 58 + mergePreview.value.detail.files.length * 34)))

const detailConflictsByFile = computed(() => {
  const grouped = new Map()
  for (const conflict of mergePreview.value.detail.conflicts) {
    for (const idx of conflict.fileIndexes) {
      if (!grouped.has(idx)) grouped.set(idx, [])
      grouped.get(idx).push(conflict)
    }
  }
  return grouped
})

function toPct(value) {
  return `${value / (MERGE_TIMELINE_WIDTH / 100)}%`
}

function mergeTrackY(idx) {
  return 46 + idx * 34
}

function tickStyle(tick, idx, ticks) {
  const isFirst = idx === 0
  const isLast = idx === ticks.length - 1
  return {
    left: toPct(tick.x),
    top: '52px',
    transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
  }
}

function showMergeFileTooltip(e, file) {
  showMergeTooltip(e, {
    kind: 'file',
    title: file.name,
    lines: [
      `${mergeMode.value === 'concat' ? '输出范围' : '地址范围'}: ${formatRange(file.start, file.endInclusive)}`,
      `大小: ${formatSize(file.size)}`,
    ],
  })
}

function showMergeConflictTooltip(e, conflict) {
  showMergeTooltip(e, {
    kind: 'conflict',
    title: '地址冲突',
    lines: [
      `文件: ${conflict.fileNames.join('、')}`,
      `范围: ${formatRange(conflict.start, conflict.endInclusive)}`,
      `大小: ${formatSize(conflict.size)}`,
    ],
  })
}

function showMergeTooltip(e, payload) {
  const el = e.currentTarget.closest('.merge-map-shell')
  if (!el) return
  const rect = el.getBoundingClientRect()
  pendingMergeTooltip = {
    ...payload,
    key: `${payload.kind}:${payload.title}:${payload.lines.join('|')}`,
    x: Math.min(Math.max(e.clientX - rect.left + 12, 8), Math.max(8, rect.width - 230)),
    y: Math.min(Math.max(e.clientY - rect.top + 12, 8), Math.max(8, rect.height - 86)),
  }
  if (mergeTooltipFrame) return
  mergeTooltipFrame = requestAnimationFrame(() => {
    mergeTooltipFrame = 0
    const next = pendingMergeTooltip
    pendingMergeTooltip = null
    const prev = mergeTooltip.value
    if (
      prev &&
      next &&
      prev.key === next.key &&
      Math.abs(prev.x - next.x) < 2 &&
      Math.abs(prev.y - next.y) < 2
    ) return
    mergeTooltip.value = next
  })
}

function hideMergeTooltip() {
  if (mergeTooltipFrame) cancelAnimationFrame(mergeTooltipFrame)
  mergeTooltipFrame = 0
  pendingMergeTooltip = null
  mergeTooltip.value = null
}

function detailConflictsForFile(idx) {
  return detailConflictsByFile.value.get(idx) || []
}

function detailTrackY(rowIdx) {
  return 46 + rowIdx * 34
}

function selectMergeFile(idx) {
  const el = document.querySelector(`.merge-file-row[data-idx="${idx}"]`)
  selectedMergeIdx.value = idx
  selectedMergeConflictIdx.value = null
  const file = mergeFiles.value[idx]
  if (file) mergeViewportOverride.value = rangeForFile(file, idx)
  nextTick(() => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el?.classList.remove('merge-flash')
    void el?.offsetWidth
    el?.classList.add('merge-flash')
    setTimeout(() => el?.classList.remove('merge-flash'), 1400)
  })
}

function selectMergeConflict(idx) {
  const conflict = mergeConflicts.value[idx]
  if (!conflict) return
  selectedMergeConflictIdx.value = idx
  selectedMergeIdx.value = conflict.fileIndexes[0]
  mergeViewportOverride.value = paddedRange(conflict.start, conflict.end)
}

function fitMergeAll() {
  mergeViewportOverride.value = { start: mergePreview.value.minAddr, end: mergePreview.value.maxAddr }
  selectedMergeConflictIdx.value = null
}

function onMergeOverviewClick(e) {
  if (!mergeFiles.value.length) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const center = mergePreview.value.unitToAddr(ratio * MERGE_TIMELINE_WIDTH)
  const currentRange = activeMergeViewport.value
    ? activeMergeViewport.value.end - activeMergeViewport.value.start
    : Math.max(1, mergePreview.value.totalRange / 4)
  mergeViewportOverride.value = clampRange(center - currentRange / 2, center + currentRange / 2)
}

function rangeForFile(file, idx) {
  if (!file) return null
  if (mergeMode.value === 'concat') {
    const start = mergeFiles.value.slice(0, idx).reduce((sum, item) => sum + item.size, 0)
    return paddedRange(start, start + file.size)
  }
  return paddedRange(file.baseAddr, file.baseAddr + file.size)
}

function paddedRange(start, end) {
  const modelMin = rawMinAddr()
  const modelMax = rawMaxAddr()
  const size = Math.max(1, end - start)
  const pad = Math.max(Math.floor(size * 0.35), 16)
  return clampRange(start - pad, end + pad, modelMin, modelMax)
}

function clampRange(start, end, min = rawMinAddr(), max = rawMaxAddr()) {
  if (max <= min) return { start: min, end: min + 1 }
  let nextStart = Math.max(min, Math.min(max, Math.floor(start)))
  let nextEnd = Math.max(min, Math.min(max, Math.ceil(end)))
  if (nextEnd <= nextStart) nextEnd = Math.min(max, nextStart + 1)
  if (nextEnd > max) {
    const shift = nextEnd - max
    nextEnd = max
    nextStart = Math.max(min, nextStart - shift)
  }
  if (nextStart < min) {
    const shift = min - nextStart
    nextStart = min
    nextEnd = Math.min(max, nextEnd + shift)
  }
  return { start: nextStart, end: nextEnd }
}

function rawMinAddr() {
  if (!mergeFiles.value.length) return 0
  if (mergeMode.value === 'concat') return 0
  return Math.min(...mergeFiles.value.map(file => file.baseAddr))
}

function rawMaxAddr() {
  if (!mergeFiles.value.length) return 1
  if (mergeMode.value === 'concat') return Math.max(1, mergeFiles.value.reduce((sum, file) => sum + file.size, 0))
  return Math.max(...mergeFiles.value.map(file => file.baseAddr + file.size))
}

function findFirstRawConflict() {
  if (mergeMode.value !== 'address' || mergeFiles.value.length < 2) return null
  const events = []
  for (let idx = 0; idx < mergeFiles.value.length; idx++) {
    const file = mergeFiles.value[idx]
    events.push({ addr: file.baseAddr, type: 'start', idx })
    events.push({ addr: file.baseAddr + file.size, type: 'end', idx })
  }
  events.sort((a, b) => a.addr - b.addr || (a.type === 'end' ? -1 : 1))
  const active = new Set()
  let prev = events[0]?.addr ?? 0
  for (const event of events) {
    if (event.addr > prev && active.size > 1) return { start: prev, end: event.addr }
    if (event.type === 'end') active.delete(event.idx)
    else active.add(event.idx)
    prev = event.addr
  }
  return null
}

// 拖拽排序
let mergeDragIdx = null
function onMergeDragStart(e, idx) {
  if (mergeMode.value !== 'concat') return
  mergeDragIdx = idx
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(idx))
  e.target.classList.add('merge-dragging')
}
function onMergeDragOver(e, idx) {
  if (mergeMode.value !== 'concat' || mergeDragIdx === null || mergeDragIdx === idx) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
function onMergeDragEnter(e) {
  if (mergeMode.value !== 'concat') return
  e.preventDefault()
}
function onMergeDrop(e, idx) {
  if (mergeMode.value !== 'concat' || mergeDragIdx === null) return
  e.preventDefault()
  const from = mergeDragIdx
  if (from === idx) return
  const arr = mergeFiles.value
  const [item] = arr.splice(from, 1)
  arr.splice(idx, 0, item)
}
function onMergeDragEnd(e) {
  e.target.classList.remove('merge-dragging')
  mergeDragIdx = null
}

function formatSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatAddr(addr) {
  return '0x' + Number(addr || 0).toString(16).toUpperCase()
}

function formatRange(start, end) {
  return `${formatAddr(start)} - ${formatAddr(end)}`
}

// ===== 文件合并操作 =====
async function readFirmwareForConvert(path) {
  const buf = await window.services.readFileBuffer(path)
  return parseFirmwareBytes(buf, path)
}

async function mergeAddFiles() {
  const r = await window.services.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '固件文件', extensions: ['hex', 'ihx', 's19', 'srec', 'mot', 'bin'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (!r) return
  for (const fp of r) {
    if (mergeFiles.value.some(f => f.path === fp)) continue
    try {
      const buf = await window.services.readFileBuffer(fp)
      const parsed = parseFirmwareBytes(buf, fp)
      const name = fp.split(/[\\/]/).pop() || fp
      mergeFiles.value.push({
        path: fp,
        name,
        size: parsed.data.length,
        baseAddr: parsed.baseAddr,
        originalBaseAddr: parsed.baseAddr,
        endAddr: parsed.baseAddr + parsed.data.length - 1,
      })
    } catch { /* skip unreadable files */ }
  }
}

function removeMergeFile(idx) {
  mergeFiles.value.splice(idx, 1)
}

function moveMergeFile(idx, dir) {
  const target = idx + dir
  if (target < 0 || target >= mergeFiles.value.length) return
  const arr = mergeFiles.value
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

function clearMergeFiles() {
  mergeFiles.value = []
}

async function doMerge() {
  if (mergeFiles.value.length < 2) return
  const segments = []
  for (const f of mergeFiles.value) {
    const parsed = await readFirmwareForConvert(f.path)
    const hasCustomBase = f.originalBaseAddr !== undefined && f.baseAddr !== f.originalBaseAddr
    const baseAddr = hasCustomBase ? f.baseAddr : parsed.baseAddr
    f.baseAddr = baseAddr
    f.originalBaseAddr = parsed.baseAddr
    f.size = parsed.data.length
    f.endAddr = baseAddr + parsed.data.length - 1
    segments.push({ baseAddr, data: parsed.data })
  }
  const merged = mergeFirmwareSegments(segments, {
    mode: mergeMode.value,
    outputFmt: mergeOutputFmt.value,
    fillValueText: mergeFillVal.value,
  })
  const path = await window.services.showSaveDialog({ defaultPath: `merged.${merged.extension}` })
  if (path) await window.services.writeFile(path, merged.data)
}

onUnmounted(() => {
  hideMergeTooltip()
})
</script>

<template>
  <div class="merge-page">
    <div class="card merge-card"><h4 style="margin:0 0 8px">文件合并</h4>
      <!-- 工具栏 -->
      <div class="form-row">
        <button class="btn btn-secondary btn-sm" @click="mergeAddFiles">添加文件</button>
        <button v-if="mergeFiles.length" class="btn btn-secondary btn-sm" @click="clearMergeFiles">清空</button>
        <select v-model="mergeMode" style="width:130px">
          <option value="address">按地址合并</option><option value="concat">顺序拼接</option>
        </select>
        <select v-model="mergeOutputFmt" style="width:110px">
          <option value="bin">BIN</option><option value="hex">Intel HEX</option><option value="s19">S19</option>
        </select>
        <span style="color:var(--text-muted);font-size:11px">填充</span>
        <input v-model="mergeFillVal" style="width:50px" />
        <button class="btn btn-primary btn-sm" @click="doMerge" :disabled="mergeFiles.length<2">合并并保存</button>
      </div>

      <div v-if="!mergeFiles.length" class="merge-empty">
        添加两个或更多固件文件后，这里会显示 MiniMap 总览和当前地址视窗。
      </div>

      <div v-else class="merge-map-shell" @mouseleave="hideMergeTooltip">
        <div class="merge-map-toolbar">
          <span v-if="mergeStats" class="mono">总范围 {{ formatRange(mergeStats.minAddr, mergeStats.maxAddr) }}</span>
          <span v-else class="mono">没有可合并数据</span>
          <button class="btn btn-secondary btn-sm" @click="fitMergeAll" :disabled="!mergeStats">适应全部</button>
          <span v-if="mergeMode === 'address'" class="merge-scale-note">空隙已压缩显示</span>
        </div>

        <div class="merge-minimap">
          <svg class="merge-timeline" height="92" role="img" aria-label="文件合并总览" @click="onMergeOverviewClick">
            <defs>
              <pattern id="merge-gap-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" class="merge-gap-stripe" />
              </pattern>
            </defs>
            <rect class="merge-track-bg" x="0" y="24" width="100%" height="24" rx="3" />
            <rect v-for="gap in mergePreview.gaps" :key="`mini-gap-${gap.start}`" class="merge-gap-block" :x="toPct(gap.x)" y="24" :width="toPct(gap.width)" height="24" />
            <rect
              v-for="file in mergePreview.files"
              :key="`mini-file-${file.idx}`"
              class="merge-file-block"
              :class="{ active: selectedMergeIdx === file.idx }"
              :x="toPct(file.x)"
              y="24"
              :width="toPct(file.width)"
              height="24"
              :fill="file.color"
              @mousemove="showMergeFileTooltip($event, file)"
              @click.stop="selectMergeFile(file.idx)"
            />
            <rect
              v-for="file in mergePreview.files"
              :key="`mini-hit-${file.idx}`"
              class="merge-hit-area"
              :x="toPct(file.hitX)"
              y="16"
              :width="toPct(file.hitWidth)"
              height="40"
              @mousemove="showMergeFileTooltip($event, file)"
              @click.stop="selectMergeFile(file.idx)"
            />
            <rect
              v-for="(conflict, conflictIdx) in mergeConflicts"
              :key="`mini-conflict-${conflict.start}-${conflict.fileIndexes.join('-')}`"
              class="merge-conflict-block"
              :class="{ active: selectedMergeConflictIdx === conflictIdx }"
              :x="toPct(conflict.x)"
              y="24"
              :width="toPct(conflict.width)"
              height="24"
              @mousemove="showMergeConflictTooltip($event, conflict)"
              @click.stop="selectMergeConflict(conflictIdx)"
            />
            <rect class="merge-viewport-frame" :x="toPct(mergePreview.viewport.x)" y="12" :width="toPct(mergePreview.viewport.width)" height="50" rx="3" />
            <line class="merge-axis-line" x1="0" y1="66" x2="100%" y2="66" />
            <line v-for="tick in mergePreview.ticks" :key="`mini-tick-${tick.addr}`" class="merge-axis-tick" :x1="toPct(tick.x)" y1="62" :x2="toPct(tick.x)" y2="70" />
          </svg>
          <div v-for="(tick, tickIdx) in mergePreview.ticks" :key="`mini-label-${tick.addr}`" class="merge-tick-label mono" :style="tickStyle(tick, tickIdx, mergePreview.ticks)">
            {{ formatAddr(tick.addr) }}
          </div>
        </div>

        <div class="merge-detail">
          <div class="merge-detail-title">
            <span>详情视窗</span>
            <span class="mono">{{ formatRange(mergePreview.detail.minAddr, mergePreview.detail.maxInclusive) }}</span>
          </div>
          <svg class="merge-timeline" :height="mergeDetailHeight" role="img" aria-label="文件合并详情视窗">
            <rect class="merge-track-bg" x="0" y="26" width="100%" :height="mergeDetailHeight - 54" rx="3" />
            <rect v-for="gap in mergePreview.detail.gaps" :key="`detail-gap-${gap.start}`" class="merge-gap-block" :x="toPct(gap.x)" y="26" :width="toPct(gap.width)" :height="mergeDetailHeight - 54" />
            <g v-for="(file, rowIdx) in mergePreview.detail.files" :key="`detail-file-${file.idx}`">
              <rect class="merge-file-track-bg" x="0" :y="detailTrackY(rowIdx)" width="100%" height="20" rx="3" />
              <rect class="merge-file-track-block" :class="{ active: selectedMergeIdx === file.idx }" :x="toPct(file.x)" :y="detailTrackY(rowIdx)" :width="toPct(file.width)" height="20" :fill="file.color" @mousemove="showMergeFileTooltip($event, file)" @click="selectMergeFile(file.idx)" />
              <rect class="merge-hit-area" :x="toPct(file.hitX)" :y="detailTrackY(rowIdx) - 5" :width="toPct(file.hitWidth)" height="30" @mousemove="showMergeFileTooltip($event, file)" @click="selectMergeFile(file.idx)" />
              <rect v-for="conflict in detailConflictsForFile(file.idx)" :key="`detail-conflict-${file.idx}-${conflict.start}`" class="merge-conflict-block" :x="toPct(conflict.x)" :y="detailTrackY(rowIdx)" :width="toPct(conflict.width)" height="20" @mousemove="showMergeConflictTooltip($event, conflict)" />
            </g>
            <line class="merge-axis-line" x1="0" :y1="mergeDetailHeight - 22" x2="100%" :y2="mergeDetailHeight - 22" />
            <line v-for="tick in mergePreview.detail.ticks" :key="`detail-tick-${tick.addr}`" class="merge-axis-tick" :x1="toPct(tick.x)" :y1="mergeDetailHeight - 26" :x2="toPct(tick.x)" :y2="mergeDetailHeight - 18" />
          </svg>
          <div v-for="(file, rowIdx) in mergePreview.detail.files" :key="`detail-label-${file.idx}`" class="merge-track-title merge-track-title-file" :style="{ top: detailTrackY(rowIdx) + 1 + 'px', borderColor: file.color }">
            {{ file.idx + 1 }}. {{ file.name }}
          </div>
          <div v-for="(tick, tickIdx) in mergePreview.detail.ticks" :key="`detail-label-${tick.addr}`" class="merge-tick-label mono" :style="{ ...tickStyle(tick, tickIdx, mergePreview.detail.ticks), top: mergeDetailHeight - 18 + 'px' }">
            {{ formatAddr(tick.addr) }}
          </div>
        </div>

        <div v-if="mergeTooltip" class="merge-tooltip" :class="`is-${mergeTooltip.kind}`" :style="{ left: mergeTooltip.x + 'px', top: mergeTooltip.y + 'px' }">
          <strong>{{ mergeTooltip.title }}</strong>
          <span v-for="line in mergeTooltip.lines" :key="line">{{ line }}</span>
        </div>
      </div>

      <div v-if="mergeFiles.length" class="merge-bottom-grid">
        <div class="merge-file-list">
          <div class="merge-file-header">
            <span style="width:18px"></span><span style="width:20px">#</span><span style="flex:1">文件名</span><span style="width:80px">大小</span><span style="width:130px">起始地址</span><span style="width:50px"></span>
          </div>
          <div v-for="(f, idx) in mergeFiles" :key="f.path" class="merge-file-row" :data-idx="idx"
            :class="{ selected: selectedMergeIdx === idx }"
            :draggable="mergeMode === 'concat'"
            @click="selectMergeFile(idx)"
            @dragstart="onMergeDragStart($event, idx)"
            @dragover="onMergeDragOver($event, idx)"
            @dragenter="onMergeDragEnter($event)"
            @drop="onMergeDrop($event, idx)"
            @dragend="onMergeDragEnd"
            :style="{ borderLeftColor: fileColor(idx), borderLeftWidth: '3px', borderLeftStyle: 'solid' }">
            <span class="merge-drag-handle" v-if="mergeMode === 'concat'" style="width:18px;cursor:grab;color:var(--text-muted);font-size:12px">&#9776;</span>
            <span v-else style="width:18px"></span>
            <span class="mono" style="width:20px;color:var(--text-muted);font-size:11px">{{ idx + 1 }}</span>
            <span class="merge-filename" :title="f.path">{{ f.name }}</span>
            <span class="mono" style="width:80px;font-size:11px">{{ formatSize(f.size) }}</span>
            <input :value="'0x' + f.baseAddr.toString(16).toUpperCase()" class="mono merge-addr-input" style="width:130px;font-size:11px" @click.stop @change="f.baseAddr = parseNumericText($event.target.value, f.baseAddr); mergeViewportOverride = null" />
            <button class="btn btn-sm" style="width:22px;padding:0;font-size:12px;color:#e74c3c;flex-shrink:0" title="移除" @click.stop="removeMergeFile(idx)">&#10005;</button>
          </div>
        </div>

        <div class="merge-conflict-list">
          <div class="merge-panel-title">冲突 {{ mergeConflicts.length }}</div>
          <div v-if="!mergeConflicts.length" class="merge-muted">没有地址重叠</div>
          <button v-for="(cf, cfIdx) in mergeConflicts" :key="`${cf.start}-${cf.fileIndexes.join('-')}`" class="merge-conflict-item" :class="{ selected: selectedMergeConflictIdx === cfIdx }" @click="selectMergeConflict(cfIdx)">
            <strong>{{ cf.fileNames.join('、') }}</strong>
            <span class="mono">{{ formatRange(cf.start, cf.endInclusive) }}</span>
            <span>{{ formatSize(cf.size) }}</span>
          </button>
        </div>
      </div>

      <!-- 统计 -->
      <div v-if="mergeStats" class="merge-stats">
        <span>文件 {{ mergeFiles.length }} 个</span>
        <span>数据 {{ formatSize(mergeStats.totalData) }}</span>
        <span v-if="mergeMode === 'address'">地址 0x{{ mergeStats.minAddr.toString(16).toUpperCase() }} - 0x{{ mergeStats.maxAddr.toString(16).toUpperCase() }}</span>
        <span v-if="mergeMode === 'address' && mergeStats.gapSize > 0">空隙 {{ formatSize(mergeStats.gapSize) }}</span>
        <span style="color:var(--accent)">输出 {{ formatSize(mergeStats.totalRange) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.merge-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.merge-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.merge-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  margin-top: 8px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  color: var(--text-muted);
}
.merge-map-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.merge-map-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
}
.merge-map-toolbar .btn {
  margin-left: 0;
}
.merge-map-toolbar .btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.merge-scale-note {
  color: var(--text-muted);
  font-size: 11px;
}
.merge-minimap,
.merge-detail {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  overflow: hidden;
}
.merge-minimap {
  height: 92px;
}
.merge-detail {
  min-height: 150px;
}
.merge-detail-title {
  position: absolute;
  z-index: 3;
  top: 5px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 11px;
  pointer-events: none;
}
.merge-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 8px;
  align-items: start;
}
.merge-conflict-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-height: 260px;
  overflow-y: auto;
  background: var(--bg-card);
}
.merge-panel-title {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}
.merge-muted {
  padding: 12px 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.merge-conflict-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}
.merge-conflict-item:hover,
.merge-conflict-item.selected {
  background: rgba(231, 76, 60, 0.08);
}
.merge-conflict-item strong {
  color: #e74c3c;
  font-size: 12px;
}
.merge-conflict-item span {
  color: var(--text-secondary);
  font-size: 11px;
}
.merge-preview {
  position: relative;
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  overflow: hidden;
}
.merge-timeline {
  display: block;
  width: 100%;
  cursor: default;
}
.merge-track-bg,
.merge-file-track-bg {
  fill: rgba(0, 0, 0, 0.04);
  stroke: var(--border);
  stroke-width: 1;
}
.merge-file-track-bg {
  fill: rgba(255, 255, 255, 0.22);
}
.merge-gap-block {
  fill: url(#merge-gap-stripes);
}
.merge-gap-stripe {
  stroke: rgba(120, 120, 120, 0.55);
  stroke-width: 1;
}
.merge-file-block,
.merge-file-track-block,
.merge-conflict-block,
.merge-hit-area {
  cursor: pointer;
}
.merge-file-block,
.merge-file-track-block {
  transition: opacity 0.15s, filter 0.15s;
}
.merge-file-block:hover,
.merge-file-track-block:hover,
.merge-file-block.active,
.merge-file-track-block.active {
  filter: brightness(1.1) saturate(1.1);
}
.merge-file-block.active,
.merge-file-track-block.active {
  stroke: #1e88e5;
  stroke-width: 2;
}
.merge-conflict-block {
  fill: rgba(231, 76, 60, 0.58);
  stroke: rgba(180, 30, 30, 0.85);
  stroke-width: 1;
}
.merge-conflict-block.active {
  fill: rgba(231, 76, 60, 0.75);
}
.merge-viewport-frame {
  fill: rgba(30, 136, 229, 0.11);
  stroke: #1e88e5;
  stroke-width: 2;
  pointer-events: none;
}
.merge-hit-area {
  fill: transparent;
  pointer-events: all;
}
.merge-axis-line {
  stroke: var(--border);
  stroke-width: 1;
}
.merge-axis-tick {
  stroke: var(--text-muted);
  stroke-width: 1;
}
.merge-track-title {
  position: absolute;
  left: 8px;
  max-width: min(280px, 45%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  border-left: 3px solid var(--border);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  line-height: 16px;
}
.merge-track-title-overview {
  top: 23px;
}
.merge-track-title-file {
  color: var(--text-secondary);
}
.merge-tick-label {
  position: absolute;
  color: var(--text-muted);
  font-size: 10px;
  pointer-events: none;
  white-space: nowrap;
}
.merge-tooltip {
  position: absolute;
  background: rgba(0,0,0,0.85);
  color: #eee;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.merge-tooltip.is-conflict {
  border-left: 3px solid #e74c3c;
}
.merge-warnings {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.merge-warning-item {
  font-size: 11px;
  color: #e74c3c;
  background: rgba(231,76,60,0.08);
  padding: 3px 8px;
  border-radius: 4px;
  border-left: 3px solid #e74c3c;
}
.merge-file-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-height: 260px;
  overflow-y: auto;
  background: var(--bg-card);
}
.merge-file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 1;
}
.merge-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  transition: background 0.15s, box-shadow 0.15s;
  cursor: pointer;
}
.merge-file-row:last-child {
  border-bottom: none;
}
.merge-file-row:hover {
  background: var(--bg-hover);
}
.merge-file-row.selected {
  background: rgba(30, 136, 229, 0.12);
  box-shadow: inset 0 0 0 1px rgba(30, 136, 229, 0.35);
}
.merge-file-row.merge-dragging {
  opacity: 0.4;
}
.merge-file-row.merge-flash {
  animation: merge-row-pulse 0.7s ease-in-out 2;
}
.merge-filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.merge-drag-handle {
  flex-shrink: 0;
}
.merge-addr-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 3px;
  text-align: right;
  padding: 1px 4px;
  color: var(--text-primary);
}
.merge-addr-input:focus {
  border-color: var(--accent);
  outline: none;
}
.merge-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  font-size: 11px;
  color: var(--text-secondary);
}

@keyframes merge-row-pulse {
  0% {
    background: rgba(30, 136, 229, 0.08);
    box-shadow: inset 0 0 0 1px rgba(30, 136, 229, 0.25);
  }
  50% {
    background: rgba(30, 136, 229, 0.34);
    box-shadow: inset 0 0 0 2px rgba(30, 136, 229, 0.7);
  }
  100% {
    background: rgba(30, 136, 229, 0.08);
    box-shadow: inset 0 0 0 1px rgba(30, 136, 229, 0.25);
  }
}
</style>
