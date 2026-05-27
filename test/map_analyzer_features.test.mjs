import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const mapParser = require('../public/preload/map_parser.js')

// ============================================================
// 地址反查逻辑测试
// ============================================================

// 从 Vue 组件提取的核心查找算法（纯函数版本）
function lookupAddress(symbols, query) {
  if (!query || !symbols) return null

  let target = 0
  if (query.startsWith('0x') || query.startsWith('0X')) {
    target = parseInt(query, 16)
  } else {
    target = parseInt(query, 16)
  }
  if (isNaN(target) || target < 0) return { error: '地址格式无效' }

  // 精确匹配
  for (const sym of symbols) {
    const addr = typeof sym.address === 'number' ? sym.address : parseInt(sym.address, 16) || 0
    const size = Number(sym.size) || 0
    if (size > 0 && addr <= target && target < addr + size) {
      return { found: true, symbol: sym, offset: target - addr, target }
    }
  }

  // 降级匹配
  const candidates = symbols
    .map(sym => ({ sym, addr: typeof sym.address === 'number' ? sym.address : parseInt(sym.address, 16) || 0 }))
    .filter(item => item.addr <= target)
    .sort((a, b) => b.addr - a.addr)

  if (candidates.length > 0) {
    return { found: true, symbol: candidates[0].sym, offset: target - candidates[0].addr, target, degraded: true }
  }

  return { found: false, target }
}

// 提取 topSymbols 逻辑
function getTopSymbols(symbols, limit = 20) {
  if (!symbols) return []
  return symbols
    .filter(sym => (Number(sym.size) || 0) > 0)
    .map(sym => ({ ...sym, sizeNum: Number(sym.size) || 0 }))
    .sort((a, b) => b.sizeNum - a.sizeNum)
    .slice(0, limit)
}

// ============================================================
// 使用 Template.map 测试
// ============================================================

let parsed
try {
  const content = readFileSync('C:/Users/lbqdl/Desktop/Template.map', 'utf-8')
  parsed = mapParser.parse(content)
} catch {
  // Template.map 不存在时跳过
  parsed = null
}

// --- 地址反查测试 ---

test('地址反查：精确匹配 main 函数', { skip: !parsed }, () => {
  // main 在 0x080017e9，size=74
  const result = lookupAddress(parsed.symbols, '080017EC')
  assert.equal(result.found, true)
  assert.equal(result.symbol.name, 'main')
  assert.equal(result.offset, 3)
  assert.equal(result.degraded, undefined)
})

test('地址反查：带 0x 前缀', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, '0x0800027B')
  assert.equal(result.found, true)
  assert.equal(result.symbol.name, 'BASIC_TIM_Init')
  assert.equal(result.offset, 0)
})

test('地址反查：符号起始地址', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, '080017E9')
  assert.equal(result.found, true)
  assert.equal(result.symbol.name, 'main')
  assert.equal(result.offset, 0)
})

test('地址反查：符号末尾地址（边界外触发降级）', { skip: !parsed }, () => {
  // main: 0x080017e9, size=74, 范围 [0x080017e9, 0x08001833)
  const result = lookupAddress(parsed.symbols, '08001833')
  // 0x08001833 不在任何 size>0 符号范围内，触发降级匹配
  assert.equal(result.found, true)
  assert.equal(result.degraded, true)
})

test('地址反查：无效地址', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, 'ZZZZ')
  assert.equal(result.error, '地址格式无效')
})

test('地址反查：低于所有符号地址', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, '00000001')
  assert.equal(result.found, true)
  assert.equal(result.degraded, true)
})

test('地址反查：高于所有符号地址', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, 'FFFFFFFF')
  // 降级匹配应找到地址最大的符号
  assert.equal(result.found, true)
  assert.equal(result.degraded, true)
})

test('地址反查：空查询返回 null', { skip: !parsed }, () => {
  const result = lookupAddress(parsed.symbols, '')
  assert.equal(result, null)
})

// --- 大符号 Top-N 测试 ---

test('大符号：返回 size > 0 的符号', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols)
  for (const sym of top) {
    assert.ok(sym.sizeNum > 0, `${sym.name} 应有 size > 0`)
  }
})

test('大符号：按 size 降序排列', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols)
  for (let i = 1; i < top.length; i++) {
    assert.ok(top[i - 1].sizeNum >= top[i].sizeNum, `排序错误: ${top[i-1].name}(${top[i-1].sizeNum}) < ${top[i].name}(${top[i].sizeNum})`)
  }
})

test('大符号：最多返回 20 个', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols)
  assert.ok(top.length <= 20)
})

test('大符号：自定义 limit', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols, 5)
  assert.ok(top.length <= 5)
})

test('大符号：包含 sizeNum 字段', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols)
  for (const sym of top) {
    assert.equal(typeof sym.sizeNum, 'number')
    assert.ok(sym.sizeNum > 0)
  }
})

test('大符号：最大的符号是 rx_buffer_data', { skip: !parsed }, () => {
  const top = getTopSymbols(parsed.symbols, 1)
  assert.equal(top[0].name, 'rx_buffer_data')
  assert.equal(top[0].sizeNum, 1024)
})

test('大符号：空符号列表', () => {
  const top = getTopSymbols([])
  assert.deepEqual(top, [])
})

test('大符号：null 输入', () => {
  const top = getTopSymbols(null)
  assert.deepEqual(top, [])
})

// --- 使用构造数据的边界测试 ---

test('地址反查：size=0 符号触发降级', () => {
  const symbols = [
    { name: 'func_a', address: 0x1000, size: 0, section: '.text', type: '函数' },
    { name: 'func_b', address: 0x2000, size: 100, section: '.text', type: '函数' },
  ]
  // 地址 0x1500 应降级匹配 func_a（最近的 address <= target）
  const result = lookupAddress(symbols, '1500')
  assert.equal(result.found, true)
  assert.equal(result.symbol.name, 'func_a')
  assert.equal(result.degraded, true)
  assert.equal(result.offset, 0x500)
})

test('地址反查：精确匹配优先于降级', () => {
  const symbols = [
    { name: 'small', address: 0x1000, size: 0, section: '.text', type: '函数' },
    { name: 'big', address: 0x1000, size: 0x2000, section: '.text', type: '函数' },
  ]
  // 地址 0x1500 在 big 的范围内（0x1000 <= 0x1500 < 0x3000），应精确匹配 big
  const result = lookupAddress(symbols, '1500')
  assert.equal(result.found, true)
  assert.equal(result.symbol.name, 'big')
  assert.equal(result.degraded, undefined)
  assert.equal(result.offset, 0x500)
})

test('大符号：过滤掉 size=0 的符号', () => {
  const symbols = [
    { name: 'a', address: 0x1000, size: 100 },
    { name: 'b', address: 0x2000, size: 0 },
    { name: 'c', address: 0x3000, size: 50 },
  ]
  const top = getTopSymbols(symbols)
  assert.equal(top.length, 2)
  assert.equal(top[0].name, 'a')
  assert.equal(top[1].name, 'c')
})

test('大符号：sizeNum 字段正确', () => {
  const symbols = [
    { name: 'x', address: 0x1000, size: '256' },
    { name: 'y', address: 0x2000, size: 128 },
  ]
  const top = getTopSymbols(symbols)
  assert.equal(top[0].sizeNum, 256)
  assert.equal(top[1].sizeNum, 128)
})
