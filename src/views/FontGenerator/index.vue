<script setup>
import { ref, watch, nextTick, computed, inject, onMounted } from 'vue'
import { generateBitmap, generateHeader, generateBinary, CHARSETS, SCAN_MODES, FONT_SIZES, FONT_FAMILIES } from '../../utils/font_generator.js'

const copyText = inject('copyText', () => {})

// 设置
const isNegative = ref(true)
const scanMode = ref('逐列')
const fontSize = ref(16)
const lsbFirst = ref(true)
const fontFamily = ref('SimSun')
const isBold = ref(false)
const xOffset = ref(0)
const yOffset = ref(0)
const threshold = ref(128)

// 输入
const inputText = ref('你好世界')
const charsetSelect = ref('默认常用')
const charCount = computed(() => {
  const unique = new Set([...inputText.value].filter(c => c.trim()))
  return unique.size
})

// 预览
const previewChar = ref('你')
const previewCanvas = ref(null)
const previewInfo = ref('')

// 输出
const outputDir = ref('')
const baseFilename = ref('font_chinese')
const logText = ref('')

function log(msg) { logText.value += msg + '\n' }

function loadCharset(replace) {
  const chars = CHARSETS[charsetSelect.value] || ''
  inputText.value = replace ? chars : [...new Set([...inputText.value, ...chars])].join('')
  log(`已${replace ? '加载' : '追加'}: ${charsetSelect.value}`)
}

async function loadFromFile() {
  try {
    const r = await window.services.showOpenDialog({ properties: ['openFile'] })
    if (!r?.[0]) return
    const content = await window.services.readFile(r[0])
    inputText.value = content.replace(/[\r\n\s]/g, '')
    log(`已加载文件: ${r[0]}`)
  } catch (e) {
    log(`错误: 加载文件失败 - ${e.message}`)
  }
}

function clearInput() { inputText.value = '' }

async function pickOutputDir() {
  const r = await window.services.showOpenDialog({ properties: ['openDirectory'] })
  if (r?.[0]) outputDir.value = r[0]
}

// 预览
function drawPreview() {
  const c = previewCanvas.value
  if (!c) return
  const char = previewChar.value[0] || ' '
  const size = fontSize.value
  const opts = getOpts()
  const bitmap = generateBitmap(char, size, opts)

  const scale = Math.max(2, Math.floor(200 / size))
  const imgSize = size * scale

  c.width = imgSize
  c.height = imgSize
  c.style.width = imgSize + 'px'
  c.style.height = imgSize + 'px'
  const ctx = c.getContext('2d')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, imgSize, imgSize)

  const bytesPerUnit = Math.ceil(size / 8)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let byteIdx, bitIdx
      if (scanMode.value === '逐列' || scanMode.value === '列行') {
        byteIdx = x * bytesPerUnit + Math.floor(y / 8)
        bitIdx = y % 8
      } else {
        byteIdx = y * bytesPerUnit + Math.floor(x / 8)
        bitIdx = x % 8
      }
      let pixelOn = false
      if (byteIdx < bitmap.length) {
        const bv = bitmap[byteIdx]
        pixelOn = lsbFirst.value ? !!(bv & (1 << bitIdx)) : !!(bv & (0x80 >> bitIdx))
      }
      ctx.fillStyle = pixelOn ? '#000' : '#fff'
      ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1)
      ctx.strokeStyle = '#ddd'
      ctx.strokeRect(x * scale, y * scale, scale - 1, scale - 1)
    }
  }

  const bytesPerChar = size * bytesPerUnit
  const hexData = bitmap.slice(0, 16).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
  previewInfo.value = `字符: ${char} (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})\n大小: ${size}×${size}, ${bytesPerChar} 字节\n数据: ${hexData}${bitmap.length > 16 ? ' ...' : ''}`
}

watch([previewChar, fontSize, isNegative, scanMode, lsbFirst, fontFamily, isBold, xOffset, yOffset, threshold], () => nextTick(drawPreview))
onMounted(() => nextTick(drawPreview))

// 生成
function getOpts() {
  return {
    negative: isNegative.value,
    scanMode: scanMode.value,
    lsbFirst: lsbFirst.value,
    fontFamily: fontFamily.value,
    bold: isBold.value,
    xOffset: xOffset.value,
    yOffset: yOffset.value,
    threshold: threshold.value,
  }
}

async function doGenerate(what) {
  try {
    const chars = [...new Set([...inputText.value].filter(c => c.trim()))].sort()
    if (!chars.length) { log('请先输入字符'); return }

    // 清理文件名，防止路径遍历
    const safeName = baseFilename.value.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '')

    const size = fontSize.value
    const opts = getOpts()
    log('='.repeat(40))
    log(`开始生成字库: ${size}×${size}, ${opts.negative ? '阴码' : '阳码'}, ${opts.scanMode}, ${opts.lsbFirst ? 'LSB' : 'MSB'}`)
    log(`字形: ${opts.fontFamily}${opts.bold ? ' 粗体' : ''}, 偏移(${opts.xOffset}, ${opts.yOffset}), 阈值${opts.threshold}`)
    log(`字符数: ${chars.length}`)

    // 生成所有字符点阵
    const fontData = {}
    for (let i = 0; i < chars.length; i++) {
      fontData[chars[i]] = generateBitmap(chars[i], size, opts)
      if ((i + 1) % 50 === 0) log(`进度: ${i + 1}/${chars.length}`)
    }

    if (what === 'header') {
      const header = generateHeader(fontData, size, opts)
      const filename = `${safeName}_${size}x${size}.h`
      const path = `${outputDir.value || window.services.getPath('downloads')}/${filename}`
      await window.services.writeFile(path, header)
      log(`✓ C头文件已生成: ${path}`)
    } else {
      const { buffer, charCount, bytesPerChar } = generateBinary(fontData, size)
      const dir = outputDir.value || window.services.getPath('downloads')
      const base = `${dir}/${safeName}_${size}x${size}`

      // 索引文件
      const idxSize = charCount * 2
      const idxPath = base + '_index.bin'
      await window.services.writeFile(idxPath, buffer.slice(0, idxSize))
      log(`✓ 索引: ${idxPath}`)

      // 数据文件
      const dataPath = base + '_data.bin'
      await window.services.writeFile(dataPath, buffer.slice(idxSize))
      log(`✓ 数据: ${dataPath}`)

      // 信息文件
      const info = `字库信息\n分辨率: ${size}×${size}\n字符数: ${charCount}\n每字符: ${bytesPerChar} 字节\n索引大小: ${idxSize} 字节\n数据大小: ${buffer.length - idxSize} 字节\n\n字符列表:\n${[...new Set([...inputText.value].filter(c => c.trim()))].sort().join('')}\n`
      const infoPath = base + '_info.txt'
      await window.services.writeFile(infoPath, info)
      log(`✓ 信息: ${infoPath}`)
    }
    log('='.repeat(40))
  } catch (e) {
    log(`错误: ${e.message}`)
  }
}
</script>

<template>
  <div class="font-gen">
    <h2 class="tool-title">点阵字库生成器</h2>

    <div class="font-gen-layout">
      <!-- 左侧：设置 + 预览 -->
      <div class="font-sidebar">
        <div class="card" style="margin-bottom:12px">
          <h4 style="margin:0 0 8px">取模设置</h4>
          <div class="setting-row">
            <label>格式:</label>
            <select v-model.number="isNegative">
              <option :value="true">阴码 (亮=1)</option>
              <option :value="false">阳码 (亮=0)</option>
            </select>
          </div>
          <div class="setting-row">
            <label>取模:</label>
            <select v-model="scanMode">
              <option v-for="m in SCAN_MODES" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="setting-row">
            <label>分辨率:</label>
            <div class="size-buttons">
              <button v-for="s in FONT_SIZES" :key="s" class="btn btn-sm"
                :class="fontSize === s ? 'btn-primary' : 'btn-secondary'"
                @click="fontSize = s">{{ s }}×{{ s }}</button>
            </div>
          </div>
          <div class="setting-row">
            <label>方向:</label>
            <select v-model.number="lsbFirst">
              <option :value="true">低位在前 (LSB)</option>
              <option :value="false">高位在前 (MSB)</option>
            </select>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <h4 style="margin:0 0 8px">字形渲染</h4>
          <div class="setting-row">
            <label>字体:</label>
            <select v-model="fontFamily">
              <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value">{{ f.name }}</option>
            </select>
          </div>
          <label class="checkbox-row">
            <input v-model="isBold" type="checkbox" />
            粗体
          </label>
          <div class="offset-grid">
            <label>
              <span>X偏移:</span>
              <input v-model.number="xOffset" type="number" min="-8" max="8" step="1" />
            </label>
            <label>
              <span>Y偏移:</span>
              <input v-model.number="yOffset" type="number" min="-8" max="8" step="1" />
            </label>
          </div>
          <div class="setting-row threshold-row">
            <label>阈值:</label>
            <div class="threshold-controls">
              <input v-model.number="threshold" type="range" min="0" max="255" step="1" />
              <input v-model.number="threshold" type="number" min="0" max="255" step="1" />
            </div>
          </div>
        </div>

        <div class="card">
          <h4 style="margin:0 0 8px">字符预览</h4>
          <div class="preview-tools">
            <input v-model="previewChar" maxlength="1" />
            <button class="btn btn-secondary btn-sm" @click="drawPreview">刷新</button>
          </div>
          <canvas ref="previewCanvas" class="preview-canvas"></canvas>
          <pre class="preview-info">{{ previewInfo }}</pre>
        </div>
      </div>

      <!-- 右侧：输入 + 输出 -->
      <div class="font-main">
        <div class="card" style="margin-bottom:12px">
          <h4 style="margin:0 0 8px">输入字符</h4>
          <div class="form-row" style="gap:4px;margin-bottom:6px">
            <select v-model="charsetSelect" style="width:110px">
              <option v-for="(_, k) in CHARSETS" :key="k" :value="k">{{ k }}</option>
            </select>
            <button class="btn btn-secondary btn-sm" @click="loadCharset(true)">加载</button>
            <button class="btn btn-secondary btn-sm" @click="loadCharset(false)">追加</button>
            <button class="btn btn-secondary btn-sm" @click="loadFromFile">从文件...</button>
            <button class="btn btn-secondary btn-sm" @click="clearInput">清空</button>
            <span style="color:var(--text-muted);margin-left:auto">字符数: {{ charCount }}</span>
          </div>
          <textarea v-model="inputText" class="mono" rows="6" style="width:100%;font-size:13px" placeholder="输入要生成字库的汉字..."></textarea>
        </div>

        <div class="card" style="margin-bottom:12px">
          <h4 style="margin:0 0 8px">输出设置</h4>
          <div class="form-row" style="margin-bottom:6px">
            <label>目录:</label>
            <input :value="outputDir" readonly placeholder="默认: 下载目录" style="flex:1;background:var(--bg-secondary)" />
            <button class="btn btn-secondary btn-sm" @click="pickOutputDir">选择目录</button>
          </div>
          <div class="form-row">
            <label>文件名:</label>
            <input v-model="baseFilename" style="width:150px" />
            <span style="color:var(--text-muted)">_{分辨率}.h/.bin</span>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-primary" @click="doGenerate('header')">生成 C 头文件 (.h)</button>
          <button class="btn btn-secondary" @click="doGenerate('binary')">生成二进制 (.bin)</button>
        </div>

        <div class="card" style="max-height:200px;overflow:auto">
          <pre style="margin:0;font-size:11px;color:var(--text-secondary);white-space:pre-wrap">{{ logText || '生成日志...' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
pre { font-family: var(--font-mono); }

.font-gen-layout {
  display: grid;
  grid-template-columns: minmax(260px, 280px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.font-sidebar {
  min-width: 0;
}

.font-main {
  min-width: 0;
}

.setting-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.setting-row label,
.offset-grid span {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.setting-row select,
.setting-row input {
  width: 100%;
  min-width: 0;
}

.size-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.size-buttons .btn {
  justify-content: center;
  min-width: 0;
  padding-left: 6px;
  padding-right: 6px;
  white-space: nowrap;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px 68px;
  color: var(--text-secondary);
  font-weight: 500;
}

.offset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.offset-grid label {
  display: grid;
  gap: 4px;
}

.offset-grid input {
  width: 100%;
  min-width: 0;
}

.threshold-row {
  align-items: start;
}

.threshold-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px;
  gap: 8px;
  min-width: 0;
}

.threshold-controls input {
  width: 100%;
  min-width: 0;
}

.preview-tools {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.preview-tools input {
  width: 60px;
  text-align: center;
  font-size: 16px;
}

.preview-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border: 1px solid var(--border);
}

.preview-info {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 10px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
