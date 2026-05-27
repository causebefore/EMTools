import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const timestampTab = readFileSync(new URL('../src/views/DataConverter/tabs/TimestampTab.vue', import.meta.url), 'utf8')
const mergeTab = readFileSync(new URL('../src/views/HexTool/tabs/MergeTab.vue', import.meta.url), 'utf8')

test('timestamp converter passes the selected UI unit into conversion', () => {
  assert.match(timestampTab, /timestampToDate\(input,\s*undefined,\s*tsUnit\.value\)/)
})

test('merge action re-reads selected files instead of using stale cached data', () => {
  assert.match(mergeTab, /readFirmwareForConvert\(f\.path\)/)
  assert.doesNotMatch(mergeTab, /data:\s*parsed\.data,\s*\n\s*}\)/)
})

test('merge view cancels pending tooltip animation frames on unmount', () => {
  assert.match(mergeTab, /onUnmounted\(/)
  assert.match(mergeTab, /cancelAnimationFrame\(mergeTooltipFrame\)/)
})
