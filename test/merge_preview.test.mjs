import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createMergePreviewModel,
} from '../src/utils/merge_preview.js'

const colors = ['#3498db', '#e67e22', '#2ecc71']

test('builds addressed file, gap, conflict, and tick segments', () => {
  const model = createMergePreviewModel([
    { name: 'boot.hex', baseAddr: 0x1000, size: 0x100 },
    { name: 'app.hex', baseAddr: 0x1200, size: 0x200 },
  ], { mode: 'address', colors })

  assert.equal(model.minAddr, 0x1000)
  assert.equal(model.maxAddr, 0x1400)
  assert.equal(model.totalRange, 0x400)
  assert.deepEqual(model.gaps.map(g => [g.start, g.end, g.size]), [
    [0x1100, 0x1200, 0x100],
  ])
  assert.deepEqual(model.files.map(f => [f.idx, f.start, f.end, f.color]), [
    [0, 0x1000, 0x1100, '#3498db'],
    [1, 0x1200, 0x1400, '#e67e22'],
  ])
  assert.equal(model.conflicts.length, 0)
  assert.equal(model.ticks[0].addr, 0x1000)
  assert.equal(model.ticks.at(-1).addr, 0x1400)
})

test('builds concatenation preview as continuous output offsets', () => {
  const model = createMergePreviewModel([
    { name: 'a.bin', baseAddr: 0x8000000, size: 4 },
    { name: 'b.bin', baseAddr: 0, size: 6 },
  ], { mode: 'concat', colors })

  assert.equal(model.minAddr, 0)
  assert.equal(model.maxAddr, 10)
  assert.deepEqual(model.files.map(f => [f.name, f.start, f.end]), [
    ['a.bin', 0, 4],
    ['b.bin', 4, 10],
  ])
  assert.deepEqual(model.gaps, [])
  assert.deepEqual(model.conflicts, [])
})

test('compresses huge addressed gaps by default for readable timeline layout', () => {
  const model = createMergePreviewModel([
    { name: 'merged.hex', baseAddr: 0, size: 0x9940 },
    { name: 'Template.hex', baseAddr: 0x08000000, size: 0x4C9C },
  ], {
    mode: 'address',
    colors,
    widthUnits: 1000,
    minHitUnits: 10,
  })

  assert.equal(model.totalRange, 0x08004C9C)
  assert.equal(model.gaps[0].size, 0x08000000 - 0x9940)
  assert.ok(model.files[0].width > 250)
  assert.ok(model.files[1].width > 120)
  assert.ok(model.gaps[0].width > 250)
  assert.ok(model.gaps[0].width < 500)
  assert.deepEqual(model.ticks.map(tick => tick.addr), [
    0,
    0x9940,
    0x08000000,
    0x08004C9C,
  ])
})

test('builds a focused detail viewport without losing overview context', () => {
  const model = createMergePreviewModel([
    { name: 'merged.hex', baseAddr: 0, size: 0x9940 },
    { name: 'Template.hex', baseAddr: 0x08000000, size: 0x4C9C },
  ], {
    mode: 'address',
    colors,
    widthUnits: 1000,
    detailWidthUnits: 1000,
    viewportStart: 0x08000000,
    viewportEnd: 0x08004C9C,
  })

  assert.ok(model.files[0].width > 250)
  assert.equal(model.viewport.start, 0x08000000)
  assert.equal(model.viewport.end, 0x08004C9C)
  assert.ok(model.viewport.x > 500)
  assert.ok(model.viewport.width > 100)
  assert.deepEqual(model.detail.files.map(file => [file.name, file.start, file.end, Math.round(file.x), Math.round(file.width)]), [
    ['Template.hex', 0x08000000, 0x08004C9C, 0, 1000],
  ])
  assert.deepEqual(model.detail.gaps, [])
})

test('clips detail conflicts to the active viewport', () => {
  const model = createMergePreviewModel([
    { name: 'a.hex', baseAddr: 0x1000, size: 0x400 },
    { name: 'b.hex', baseAddr: 0x1200, size: 0x400 },
  ], {
    mode: 'address',
    colors,
    widthUnits: 1000,
    detailWidthUnits: 1000,
    viewportStart: 0x1200,
    viewportEnd: 0x1400,
  })

  assert.deepEqual(model.detail.files.map(file => [file.name, file.start, file.end]), [
    ['a.hex', 0x1200, 0x1400],
    ['b.hex', 0x1200, 0x1400],
  ])
  assert.deepEqual(model.detail.conflicts.map(conflict => [conflict.start, conflict.end, conflict.fileIndexes]), [
    [0x1200, 0x1400, [0, 1]],
  ])
})

test('detects contained and multi-file overlapping conflict ranges', () => {
  const model = createMergePreviewModel([
    { name: 'large.hex', baseAddr: 0x1000, size: 0x500 },
    { name: 'mid.hex', baseAddr: 0x1100, size: 0x300 },
    { name: 'tail.hex', baseAddr: 0x1300, size: 0x300 },
  ], { mode: 'address', colors })

  assert.deepEqual(model.conflicts.map(c => ({
    start: c.start,
    end: c.end,
    fileIndexes: c.fileIndexes,
    size: c.size,
  })), [
    { start: 0x1100, end: 0x1300, fileIndexes: [0, 1], size: 0x200 },
    { start: 0x1300, end: 0x1400, fileIndexes: [0, 1, 2], size: 0x100 },
    { start: 0x1400, end: 0x1500, fileIndexes: [0, 2], size: 0x100 },
  ])
})
