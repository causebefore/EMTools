<script lang="ts" setup>
import { onMounted, ref, defineAsyncComponent, provide } from 'vue'
import { version } from '../../package.json'

const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 1500)
}

function copyText(text: string | null | undefined) {
  if (text != null && text !== '') {
    if (window.utools?.copyText) {
      window.utools.copyText(String(text))
      showToast('已复制')
    } else {
      navigator.clipboard.writeText(String(text))
        .then(() => showToast('已复制'))
        .catch(() => showToast('复制失败'))
    }
  }
}

function getDbStorage() {
  return window.utools?.dbStorage ?? localStorage
}

provide('copyText', copyText)

const tools = [
  { id: 'data-converter', name: '数据转换', mark: '0x' },
  { id: 'hash-calculator', name: '哈希计算', mark: 'H#' },
  { id: 'crc-calculator', name: '校验计算', mark: 'C' },
  { id: 'encoding-converter', name: '编码转换', mark: 'En' },
  { id: 'bitfield-calculator', name: '位域计算', mark: 'B' },
  { id: 'hex-tool', name: 'Hex工具', mark: 'Hx' },
  { id: 'font-generator', name: '点阵字库', mark: 'F' },
  { id: 'map-analyzer', name: 'MAP分析', mark: 'M' },
]

const DataConverter = defineAsyncComponent(() => import('./views/DataConverter/index.vue'))
const HashCalculator = defineAsyncComponent(() => import('./views/HashCalculator/index.vue'))
const CrcCalculator = defineAsyncComponent(() => import('./views/CrcCalculator/index.vue'))
const EncodingConverter = defineAsyncComponent(() => import('./views/EncodingConverter/index.vue'))
const BitfieldCalculator = defineAsyncComponent(() => import('./views/BitfieldCalculator/index.vue'))
const HexTool = defineAsyncComponent(() => import('./views/HexTool/index.vue'))
const FontGenerator = defineAsyncComponent(() => import('./views/FontGenerator/index.vue'))
const MapAnalyzer = defineAsyncComponent(() => import('./views/MapAnalyzer/index.vue'))

const componentMap: Record<string, any> = {
  'data-converter': DataConverter,
  'hash-calculator': HashCalculator,
  'crc-calculator': CrcCalculator,
  'encoding-converter': EncodingConverter,
  'bitfield-calculator': BitfieldCalculator,
  'hex-tool': HexTool,
  'font-generator': FontGenerator,
  'map-analyzer': MapAnalyzer,
}

const activeTool = ref('data-converter')
const sidebarCollapsed = ref(false)
const pluginReady = ref(true)
const enterPayload = ref(null)

const featureToTool = {
  'main': 'data-converter',
  'hex-tool': 'hex-tool',
  'data-converter': 'data-converter',
  'hash-calculator': 'hash-calculator',
  'crc-calculator': 'crc-calculator',
  'encoding-converter': 'encoding-converter',
  'bitfield-calculator': 'bitfield-calculator',
  'font-generator': 'font-generator',
  'map-analyzer': 'map-analyzer',
}

onMounted(() => {
  const db = getDbStorage()
  const saved = db.getItem('emtools-active-tool')
  if (saved && tools.find(t => t.id === saved)) {
    activeTool.value = saved
  }
  const savedCollapsed = db.getItem('emtools-sidebar-collapsed')
  if (savedCollapsed === 'true') {
    sidebarCollapsed.value = true
  }

  const services = window.services
  if (services?.isPluginHost?.()) {
    pluginReady.value = false
    services.onPluginEnter((action) => {
      pluginReady.value = true
      if (action) {
        enterPayload.value = action.payload
        const target = featureToTool[action.code] || 'data-converter'
        if (tools.find(t => t.id === target)) {
          activeTool.value = target
          db.setItem('emtools-active-tool', target)
        }
      }
    })
    services.onPluginOut(() => {
      pluginReady.value = false
      enterPayload.value = null
    })
  }
})

provide('enterPayload', enterPayload)

function switchTool(id: string) {
  activeTool.value = id
  getDbStorage().setItem('emtools-active-tool', id)
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  getDbStorage().setItem('emtools-sidebar-collapsed', String(sidebarCollapsed.value))
}

function openGitHub() {
  if (window.utools?.shellOpenExternal) {
    window.utools.shellOpenExternal('https://github.com/causebefore/EMTools')
  } else {
    window.open('https://github.com/causebefore/EMTools', '_blank')
  }
}
</script>

<template>
  <div v-if="pluginReady" class="app-container">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <span v-if="!sidebarCollapsed" class="sidebar-title">工具箱</span>
        <button class="toggle-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '展开' : '收起'">
          {{ sidebarCollapsed ? '▶' : '◀' }}
        </button>
      </div>
      <nav class="nav-list">
        <button v-for="tool in tools" :key="tool.id" class="nav-item" :class="{ active: activeTool === tool.id }"
          @click="switchTool(tool.id)" :title="sidebarCollapsed ? tool.name : ''">
          <span class="nav-icon">{{ tool.mark }}</span>
          <span v-if="!sidebarCollapsed" class="nav-label">{{ tool.name }}</span>
        </button>
      </nav>
      <div v-if="!sidebarCollapsed" class="sidebar-footer">
        <div class="footer-info">
          <span>EMTools v{{ version }}</span>
          <span>Leo Liu &lt;lbq08@foxmail.com&gt;</span>
        </div>
        <button class="footer-link" @click="openGitHub" title="在浏览器中打开">GitHub ↗</button>
      </div>
    </aside>
    <main class="content">
      <component :is="componentMap[activeTool]" />
    </main>
    <Transition name="toast">
      <div v-if="toastVisible" class="toast">{{ toastMessage }}</div>
    </Transition>
  </div>
  <div v-else class="app-placeholder">
    <span>嵌入式开发工具箱</span>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  transition: width 0.2s;
  width: 170px;
  min-width: 170px;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--accent);
  white-space: nowrap;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  line-height: 1;
}

.toggle-btn:hover {
  color: var(--accent);
}

.nav-list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
  overflow-y: auto;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--bg-hover);
}

.nav-item.active {
  background: var(--accent);
  color: #fff;
}

.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 1px solid currentColor;
  border-radius: 4px;
  text-align: center;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.footer-link {
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.footer-link:hover {
  text-decoration: underline;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-primary);
}

.app-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: var(--text-secondary);
  font-size: 18px;
  background: var(--bg-primary);
}

.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #fff;
  padding: 8px 24px;
  border-radius: var(--radius);
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  pointer-events: none;
}

.toast-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

@media (prefers-color-scheme: dark) {
  .sidebar {
    background: var(--bg-sidebar);
  }
}
</style>
