<template>
  <div class="map-analyzer">
    <!-- 标题与操作栏 -->
    <div class="tool-title">MAP 文件分析器</div>
    <div class="form-row" style="margin-bottom: 12px;">
      <input
        type="text"
        :value="filePath"
        readonly
        placeholder="请选择一个 .map 文件"
        style="flex: 1; cursor: default;"
      />
      <button class="btn btn-primary" @click="openFile" :disabled="loading">
        {{ loading ? '解析中...' : '选择文件' }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-indicator">
      <div class="spinner"></div>
      <span>正在解析 MAP 文件...</span>
    </div>

    <!-- 错误信息 -->
    <div v-else-if="error" class="error-card card" style="padding: 20px; border-left: 4px solid #e53935;">
      <div style="font-weight: 600; color: #e53935; margin-bottom: 8px;">解析失败</div>
      <div style="color: var(--text-secondary); font-size: 13px; white-space: pre-wrap;">{{ error }}</div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!data" class="empty-state card" style="padding: 60px 20px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">&#128194;</div>
      <div style="color: var(--text-secondary); font-size: 15px;">点击上方按钮选择一个 .map 文件开始分析</div>
    </div>

    <!-- 数据分析面板 -->
    <template v-if="data && !loading">
      <!-- 顶部概况 -->
      <div class="summary-bar" style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px;">
        <div class="summary-item card" style="padding: 10px 16px; min-width: 100px; flex: 1;">
          <div class="summary-label" style="font-size: 12px; color: var(--text-muted);">格式</div>
          <div class="summary-value" style="font-size: 16px; font-weight: 600;">{{ data.formatType }}</div>
        </div>
        <div class="summary-item card" style="padding: 10px 16px; min-width: 100px; flex: 1;">
          <div class="summary-label" style="font-size: 12px; color: var(--text-muted);">Flash 占用</div>
          <div class="summary-value" style="font-size: 16px; font-weight: 600; color: #4CAF50;">
            {{ formatSize(data.totals.flashUsed) }}
            <span style="font-size: 12px; font-weight: 400; color: var(--text-muted);">
              / {{ formatSize(data.totals.flashTotal) }}
              ({{ formatPercent(data.totals.flashUsed, data.totals.flashTotal) }})
            </span>
          </div>
        </div>
        <div class="summary-item card" style="padding: 10px 16px; min-width: 100px; flex: 1;">
          <div class="summary-label" style="font-size: 12px; color: var(--text-muted);">RAM 占用</div>
          <div class="summary-value" style="font-size: 16px; font-weight: 600; color: #9C27B0;">
            {{ formatSize(data.totals.ramUsed) }}
            <span style="font-size: 12px; font-weight: 400; color: var(--text-muted);">
              / {{ formatSize(data.totals.ramTotal) }}
              ({{ formatPercent(data.totals.ramUsed, data.totals.ramTotal) }})
            </span>
          </div>
        </div>
        <div class="summary-item card" style="padding: 10px 16px; min-width: 80px;">
          <div class="summary-label" style="font-size: 12px; color: var(--text-muted);">符号数</div>
          <div class="summary-value" style="font-size: 16px; font-weight: 600;">{{ data.symbols?.length || 0 }}</div>
        </div>
        <div class="summary-item card" style="padding: 10px 16px; min-width: 80px;">
          <div class="summary-label" style="font-size: 12px; color: var(--text-muted);">模块数</div>
          <div class="summary-value" style="font-size: 16px; font-weight: 600;">{{ data.modules?.length || 0 }}</div>
        </div>
      </div>

      <!-- 选项卡 -->
      <div class="tabs" style="margin-bottom: 16px;">
        <button
          v-for="(tab, idx) in tabs"
          :key="idx"
          class="tab-btn"
          :class="{ active: activeTab === idx }"
          @click="activeTab = idx"
        >
          {{ tab }}
        </button>
      </div>

      <!-- ========== Tab 1: 符号列表 ========== -->
      <div v-show="activeTab === 0" class="tab-content">
        <div class="form-row" style="margin-bottom: 12px;">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索符号名称、段、类型或作用域..."
            style="flex: 1;"
          />
          <span style="font-size: 12px; color: var(--text-muted); line-height: 32px;">
            共 {{ filteredSymbols.length }} 个符号
          </span>
        </div>
        <div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
          <table class="data-table" style="border: none;">
            <thead>
              <tr>
                <th
                  v-for="col in symbolColumns"
                  :key="col.key"
                  :class="{ sortable: true, sorted: sortKey === col.key }"
                  :style="{ cursor: 'pointer', userSelect: 'none', width: col.width }"
                  @click="toggleSort(col.key)"
                >
                  {{ col.label }}
                  <span v-if="sortKey === col.key" style="margin-left: 4px;">
                    {{ sortDir === 'asc' ? '&#9650;' : '&#9660;' }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredSymbols.length === 0">
                <td :colspan="symbolColumns.length" style="text-align: center; color: var(--text-muted); padding: 40px;">
                  无匹配符号
                </td>
              </tr>
              <tr v-for="sym in filteredSymbols" :key="sym.name + '_' + sym.address + '_' + sym.section">
                <td class="mono" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis;" :title="sym.name">{{ sym.name }}</td>
                <td class="mono">{{ formatHex(sym.address) }}</td>
                <td class="mono">{{ sym.size }}</td>
                <td>{{ sym.section || '-' }}</td>
                <td>{{ sym.type || '-' }}</td>
                <td>{{ sym.scope || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========== Tab 2: 模块统计 ========== -->
      <div v-show="activeTab === 1" class="tab-content">
        <!-- 汇总卡片 -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px;">
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">Code 总计</div>
            <div style="font-size: 18px; font-weight: 700; color: #4CAF50; margin-top: 4px;">{{ formatSize(data.totals.code) }}</div>
          </div>
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">RO Data 总计</div>
            <div style="font-size: 18px; font-weight: 700; color: #2196F3; margin-top: 4px;">{{ formatSize(data.totals.roData) }}</div>
          </div>
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">RW Data 总计</div>
            <div style="font-size: 18px; font-weight: 700; color: #FF9800; margin-top: 4px;">{{ formatSize(data.totals.rwData) }}</div>
          </div>
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">ZI Data 总计</div>
            <div style="font-size: 18px; font-weight: 700; color: #9C27B0; margin-top: 4px;">{{ formatSize(data.totals.ziData) }}</div>
          </div>
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">Flash 总占用</div>
            <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">{{ formatSize(data.totals.flashUsed) }}</div>
          </div>
          <div class="card" style="padding: 12px 16px; text-align: center;">
            <div style="font-size: 12px; color: var(--text-muted);">RAM 总占用</div>
            <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">{{ formatSize(data.totals.ramUsed) }}</div>
          </div>
        </div>
        <!-- 模块表格 -->
        <div style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
          <table class="data-table" style="border: none;">
            <thead>
              <tr>
                <th style="text-align: left; min-width: 180px;">模块名称</th>
                <th style="text-align: right;">Code</th>
                <th style="text-align: right;">RO Data</th>
                <th style="text-align: right;">RW Data</th>
                <th style="text-align: right;">ZI Data</th>
                <th style="text-align: right;">Flash 占用</th>
                <th style="text-align: right;">总计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!data.modules || data.modules.length === 0">
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">无模块数据</td>
              </tr>
              <tr v-for="(mod, idx) in data.modules" :key="mod.name + '_' + idx">
                <td class="mono">{{ mod.name }}</td>
                <td class="mono" style="text-align: right;">{{ formatSize(mod.code) }}</td>
                <td class="mono" style="text-align: right;">{{ formatSize(mod.ro_data) }}</td>
                <td class="mono" style="text-align: right;">{{ formatSize(mod.rw_data) }}</td>
                <td class="mono" style="text-align: right;">{{ formatSize(mod.zi_data) }}</td>
                <td class="mono" style="text-align: right; font-weight: 600; color: #4CAF50;">
                  {{ formatSize(mod.code + mod.ro_data + mod.rw_data) }}
                </td>
                <td class="mono" style="text-align: right; font-weight: 600;">
                  {{ formatSize(mod.code + mod.ro_data + mod.rw_data + mod.zi_data) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========== Tab 3: 内存布局图 ========== -->
      <div v-show="activeTab === 2" class="tab-content">
        <div class="card" style="padding: 16px;">
          <div ref="canvasContainer" class="canvas-container" style="width: 100%;">
            <canvas ref="canvasRef" style="display: block; width: 100%;"></canvas>
          </div>
          <!-- Canvas 图例 -->
          <div class="canvas-legend" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-top: 12px;">
            <div v-for="item in legendItems" :key="item.label" class="legend-item" style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
              <span style="display: inline-block; width: 14px; height: 14px; border-radius: 3px; background: var(--color);" :style="{ background: item.color }"></span>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== Tab 4: 模块柱状图 ========== -->
      <div v-show="activeTab === 3" class="tab-content">
        <div class="card" style="padding: 16px;">
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
            Flash 占用 Top {{ topModules.length }} (Code + RO Data + RW Data)
          </div>
          <div class="bar-chart" style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="(mod, idx) in topModules" :key="mod.name" class="bar-row" style="display: flex; align-items: center; gap: 10px;">
              <span
                class="bar-rank"
                style="width: 24px; text-align: right; font-size: 12px; color: var(--text-muted); flex-shrink: 0;"
              >{{ idx + 1 }}</span>
              <span
                class="bar-label"
                style="width: 180px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0;"
                :title="mod.name"
              >{{ mod.name }}</span>
              <div
                class="bar-track"
                style="flex: 1; height: 22px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; position: relative;"
              >
                <div
                  class="bar-fill"
                  :style="{
                    width: barPercent(mod) + '%',
                    height: '100%',
                    borderRadius: '4px',
                    background: barGradient(idx),
                    transition: 'width 0.4s ease',
                    position: 'relative'
                  }"
                >
                  <span
                    v-if="barPercent(mod) > 15"
                    style="position: absolute; right: 6px; line-height: 22px; font-size: 11px; color: #fff; font-weight: 600;"
                  >{{ formatSize(mod.flashSize) }}</span>
                </div>
              </div>
              <span
                v-if="barPercent(mod) <= 15"
                class="bar-value-outside"
                style="width: 72px; text-align: right; font-size: 11px; color: var(--text-secondary); flex-shrink: 0;"
              >{{ formatSize(mod.flashSize) }}</span>
            </div>
            <div v-if="!data.modules || data.modules.length === 0" style="text-align: center; color: var(--text-muted); padding: 40px;">
              无模块数据
            </div>
          </div>
        </div>
      </div>

      <!-- ========== Tab 5: 地址反查 ========== -->
      <div v-show="activeTab === 4" class="tab-content">
        <div class="card" style="padding: 16px;">
          <div class="form-row" style="margin-bottom: 16px;">
            <input
              v-model="addressQuery"
              type="text"
              placeholder="输入十六进制地址 (如 0x08001234)"
              style="flex: 1;"
              @keyup.enter="queryAddress"
            />
            <button class="btn btn-primary" @click="queryAddress">查询</button>
          </div>

          <!-- 错误信息 -->
          <div v-if="addressError" class="error-card" style="padding: 12px; color: #e53935;">
            {{ addressError }}
          </div>

          <!-- 查询结果 -->
          <div v-if="addressResult" class="result-card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>符号名称</th>
                  <th>起始地址</th>
                  <th>大小</th>
                  <th>偏移量</th>
                  <th>段</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="mono">{{ addressResult.name }}</td>
                  <td class="mono">{{ formatHex(addressResult.address) }}</td>
                  <td class="mono">{{ addressResult.size }}</td>
                  <td class="mono">{{ formatHex(addressResult.offset) }}</td>
                  <td>{{ addressResult.section || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="addressResult.isApproximate" style="margin-top: 8px; color: #FF9800; font-size: 12px;">
              * 降级匹配：地址不在符号范围内，显示最近的符号
            </div>
          </div>
        </div>
      </div>

      <!-- ========== Tab 6: 大符号 ========== -->
      <div v-show="activeTab === 5" class="tab-content">
        <div class="card" style="padding: 16px;">
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
            Flash 占用 Top {{ topSymbols.length }} (按符号大小排序)
          </div>
          <div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
            <table class="data-table" style="border: none;">
              <thead>
                <tr>
                  <th style="width: 50px;">排名</th>
                  <th>符号名称</th>
                  <th style="width: 130px;">地址</th>
                  <th style="width: 90px;">大小</th>
                  <th style="width: 110px;">段</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="topSymbols.length === 0">
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    无符号数据
                  </td>
                </tr>
                <tr v-for="sym in topSymbols" :key="sym.name + '_' + sym.address">
                  <td style="text-align: center; color: var(--text-muted);">{{ sym.rank }}</td>
                  <td class="mono" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis;" :title="sym.name">
                    {{ sym.name }}
                  </td>
                  <td class="mono">{{ formatHex(sym.address) }}</td>
                  <td class="mono">{{ sym.size }}</td>
                  <td>{{ sym.section || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========== Tab 7: 死代码 ========== -->
      <div v-show="activeTab === 6" class="tab-content">
        <div class="card" style="padding: 16px;">
          <!-- 统计卡片 -->
          <div style="display: flex; gap: 20px; margin-bottom: 16px;">
            <div class="card" style="padding: 12px 16px; flex: 1; text-align: center;">
              <div style="font-size: 12px; color: var(--text-muted);">删除段数量</div>
              <div style="font-size: 18px; font-weight: 700; color: #4CAF50; margin-top: 4px;">
                {{ data.removedSections?.length || 0 }}
              </div>
            </div>
            <div class="card" style="padding: 12px 16px; flex: 1; text-align: center;">
              <div style="font-size: 12px; color: var(--text-muted);">总字节数</div>
              <div style="font-size: 18px; font-weight: 700; color: #FF9800; margin-top: 4px;">
                {{ formatSize(data.removedSummary?.totalSize || 0) }}
              </div>
            </div>
          </div>

          <!-- 表格 -->
          <div v-if="groupedRemovedSections.length > 0" style="max-height: 440px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
            <table class="data-table" style="border: none;">
              <thead>
                <tr>
                  <th style="text-align: left; min-width: 180px;">对象文件</th>
                  <th style="text-align: left; min-width: 150px;">段名</th>
                  <th style="text-align: right;">大小</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in groupedRemovedSections" :key="group.object">
                  <tr v-for="(sec, idx) in group.sections" :key="sec.name + '_' + idx">
                    <td v-if="idx === 0" :rowspan="group.sections.length" class="mono">
                      {{ group.object }}
                      <div style="font-size: 11px; color: var(--text-muted);">
                        合计: {{ formatSize(group.totalSize) }}
                      </div>
                    </td>
                    <td class="mono">{{ sec.name }}</td>
                    <td class="mono" style="text-align: right;">{{ formatSize(sec.size) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div v-else style="text-align: center; color: var(--text-muted); padding: 40px;">
            无删除段数据（仅支持 Keil 格式）
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

// ============================
// 状态定义
// ============================
const filePath = ref('')
const loading = ref(false)
const error = ref('')
const data = ref(null)
const activeTab = ref(0)
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref('asc')

// 地址反查状态
const addressQuery = ref('')
const addressResult = ref(null)
const addressError = ref('')

const canvasRef = ref(null)
const canvasContainer = ref(null)

let resizeObserver = null

const tabs = ['符号列表', '模块统计', '内存布局图', '模块柱状图', '地址反查', '大符号', '死代码']

const symbolColumns = [
  { key: 'name', label: '名称', width: 'auto' },
  { key: 'address', label: '地址', width: '130px' },
  { key: 'size', label: '大小', width: '90px' },
  { key: 'section', label: '段', width: '110px' },
  { key: 'type', label: '类型', width: '80px' },
  { key: 'scope', label: '作用域', width: '80px' }
]

const legendItems = [
  { label: 'Code (.text)', color: '#4CAF50' },
  { label: 'RO Data (.rodata)', color: '#2196F3' },
  { label: 'RW Data (.data)', color: '#FF9800' },
  { label: 'ZI Data (.bss)', color: '#9C27B0' },
  { label: '空闲 (Free)', color: '#E0E0E0' }
]

// ============================
// 计算属性
// ============================
const symbols = computed(() => {
  return data.value?.symbols || []
})

const filteredSymbols = computed(() => {
  let list = [...symbols.value]

  // 搜索过滤
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(sym =>
      (sym.name && sym.name.toLowerCase().includes(q)) ||
      (sym.section && sym.section.toLowerCase().includes(q)) ||
      (sym.type && sym.type.toLowerCase().includes(q)) ||
      (sym.scope && sym.scope.toLowerCase().includes(q))
    )
  }

  // 排序
  if (sortKey.value) {
    list.sort((a, b) => {
      let va = a[sortKey.value]
      let vb = b[sortKey.value]

      // 地址按数值排序
      if (sortKey.value === 'address') {
        va = typeof va === 'number' ? va : parseInt(va, 16) || 0
        vb = typeof vb === 'number' ? vb : parseInt(vb, 16) || 0
      }
      // 大小按数值排序
      if (sortKey.value === 'size') {
        va = Number(va) || 0
        vb = Number(vb) || 0
      }

      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb || '')
        return sortDir.value === 'asc' ? cmp : -cmp
      }
      return sortDir.value === 'asc' ? va - vb : vb - va
    })
  }

  return list
})

const topModules = computed(() => {
  const mods = data.value?.modules || []
  return mods
    .map(m => ({
      ...m,
      flashSize: (m.code || 0) + (m.ro_data || 0) + (m.rw_data || 0)
    }))
    .sort((a, b) => b.flashSize - a.flashSize)
    .slice(0, 20)
})

const maxFlashSize = computed(() => {
  return topModules.value.length > 0 ? topModules.value[0].flashSize : 1
})

const topSymbols = computed(() => {
  if (!data.value?.symbols) return []
  return window.services.getTopSymbols(data.value.symbols, 20)
})

const groupedRemovedSections = computed(() => {
  if (!data.value?.removedSections) return []

  const groups = new Map()
  for (const sec of data.value.removedSections) {
    if (!groups.has(sec.object)) {
      groups.set(sec.object, [])
    }
    groups.get(sec.object).push(sec)
  }

  return Array.from(groups.entries()).map(([object, sections]) => ({
    object,
    sections,
    totalSize: sections.reduce((sum, s) => sum + s.size, 0)
  }))
})

// ============================
// 方法
// ============================
function formatSize(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return (i === 0 ? size : size.toFixed(1)) + ' ' + units[i]
}

function formatHex(addr) {
  const num = typeof addr === 'number' ? addr : parseInt(addr, 16) || 0
  return '0x' + num.toString(16).toUpperCase().padStart(8, '0')
}

function formatPercent(used, total) {
  if (!total || total <= 0) return '-'
  return ((used / total) * 100).toFixed(1) + '%'
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function barPercent(mod) {
  return maxFlashSize.value > 0 ? (mod.flashSize / maxFlashSize.value) * 100 : 0
}

function barGradient(idx) {
  const opacity = Math.max(0.35, 1 - idx * 0.035)
  const style = getComputedStyle(document.documentElement)
  const accent = style.getPropertyValue('--accent').trim() || '#4A90D9'
  return `linear-gradient(135deg, ${accent}, ${accent}${Math.round(opacity * 255).toString(16).padStart(2, '0')})`
}

function queryAddress() {
  addressError.value = ''
  addressResult.value = null

  if (!addressQuery.value.trim()) {
    addressError.value = '请输入地址'
    return
  }

  // 解析地址
  let addrStr = addressQuery.value.trim()
  if (addrStr.startsWith('0x') || addrStr.startsWith('0X')) {
    addrStr = addrStr.substring(2)
  }

  const targetAddr = parseInt(addrStr, 16)
  if (isNaN(targetAddr)) {
    addressError.value = '无效的地址格式'
    return
  }

  // 调用查找算法
  const result = window.services.findSymbolByAddress(data.value.symbols, targetAddr)
  if (result) {
    addressResult.value = result
  } else {
    addressError.value = '未找到包含该地址的符号'
  }
}

async function openFile() {
  try {
    const r = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (!r || !r[0]) return
    filePath.value = r[0]
    loading.value = true
    error.value = ''
    data.value = null
    const raw = await window.services.parseMapFile(r[0])
    data.value = JSON.parse(raw)
  } catch (e) {
    error.value = e.message || String(e)
    data.value = null
  } finally {
    loading.value = false
  }
}

// ============================
// Canvas 绘图
// ============================
function drawMemoryLayout() {
  const canvas = canvasRef.value
  const container = canvasContainer.value
  if (!canvas || !container || !data.value) return

  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  const width = rect.width - 4
  const totalHeight = 260

  canvas.width = width * dpr
  canvas.height = totalHeight * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = totalHeight + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'middle'

  const t = data.value.totals
  const margin = { left: 60, right: 20, top: 10, bottom: 10 }
  const barArea = width - margin.left - margin.right
  const barH = 36
  const gap = 60

  // --- FLASH 条 ---
  const flashY = margin.top + 24
  drawBar(ctx, 'FLASH', margin.left, flashY, barArea, barH, t.flashTotal, [
    { label: 'Code', size: t.code, color: '#4CAF50' },
    { label: 'RO', size: t.roData, color: '#2196F3' },
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: '空闲', size: Math.max(0, t.flashTotal - t.flashUsed), color: '#E0E0E0' }
  ])

  // --- RAM 条 ---
  const ramY = flashY + barH + gap
  drawBar(ctx, 'RAM', margin.left, ramY, barArea, barH, t.ramTotal, [
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: 'ZI', size: t.ziData, color: '#9C27B0' },
    { label: '空闲', size: Math.max(0, t.ramTotal - t.ramUsed), color: '#E0E0E0' }
  ])
}

function drawBar(ctx, title, x, y, totalWidth, barH, totalSize, segments) {
  const effective = segments.filter(s => s.size > 0)
  if (effective.length === 0 || totalSize <= 0) return

  // 标题
  ctx.fillStyle = '#333'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, x - 50, y + barH / 2)

  // 百分比文本辅助
  ctx.font = '11px sans-serif'
  ctx.textBaseline = 'middle'

  let drawX = x
  for (const seg of effective) {
    const segW = Math.max((seg.size / totalSize) * totalWidth, seg.size > 0 ? 1 : 0)
    const actualW = Math.max(segW, 1)

    // 填充
    ctx.fillStyle = seg.color
    ctx.fillRect(drawX, y, actualW, barH)

    // 边框
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(drawX, y, actualW, barH)

    // 标签 (空间足够才画)
    if (actualW > 50) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      const label = seg.label + ' ' + formatSize(seg.size)
      ctx.fillText(label, drawX + actualW / 2, y + barH / 2)
    } else if (actualW > 20) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(seg.label, drawX + actualW / 2, y + barH / 2)
    }

    drawX += actualW
  }

  // 总大小标签在右侧
  ctx.fillStyle = 'var(--text-secondary, #666)'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('总计: ' + formatSize(totalSize), drawX + 6, y + barH / 2)

  // 空白区域填充（浮点误差补齐）
  if (drawX < x + totalWidth) {
    ctx.fillStyle = '#E0E0E0'
    ctx.fillRect(drawX, y, x + totalWidth - drawX, barH)
  }
}

// ============================
// 生命周期 & 监听
// ============================
watch(activeTab, (val) => {
  if (val === 2) {
    nextTick(drawMemoryLayout)
  }
})

watch(data, () => {
  nextTick(() => {
    if (activeTab.value === 2) {
      drawMemoryLayout()
    }
  })
})

onMounted(() => {
  // 监听容器尺寸变化，重绘 canvas
  if (canvasContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (activeTab.value === 2) {
        drawMemoryLayout()
      }
    })
    resizeObserver.observe(canvasContainer.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.map-analyzer {
  padding: 0;
}

/* 加载动画 */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 表格容器 - 确保表头吸顶 */
.tab-content {
  position: relative;
}

.data-table th.sortable:hover {
  background: var(--bg-secondary);
}

.data-table th.sorted {
  color: var(--accent);
}

/* 模块统计汇总卡片 */
.summary-item .summary-value {
  letter-spacing: -0.3px;
}

/* 柱状图悬停效果 */
.bar-row:hover .bar-fill {
  filter: brightness(1.1);
}

.bar-row:hover .bar-label {
  color: var(--accent);
}

/* 空状态 */
.empty-state {
  opacity: 0.8;
}
</style>
