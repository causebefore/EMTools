import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFillPreview,
  buildSlicePreview,
  convertFirmware,
  fillBuffer,
  mergeFirmwareSegments,
  parseFirmwareBytes,
  replaceByte,
  sliceBuffer,
} from '../src/utils/hex_filetools.js'
import { parseIntelHex } from '../src/utils/hextools.js'

test('parses text firmware and binary firmware through one file-tool path', () => {
  const hex = new TextEncoder().encode(':020000040800F2\n:02000000AABB99\n:00000001FF')
  const bin = new Uint8Array([0x01, 0x02, 0x03])

  const parsedHex = parseFirmwareBytes(hex, 'app.hex')
  const parsedBin = parseFirmwareBytes(bin, 'app.bin')

  assert.equal(parsedHex.baseAddr, 0x08000000)
  assert.deepEqual([...parsedHex.data], [0xAA, 0xBB])
  assert.deepEqual([...parsedBin.data], [0x01, 0x02, 0x03])
})

test('converts firmware without losing the original parsed base address by default', () => {
  const source = parseFirmwareBytes(
    new TextEncoder().encode(':020000040800F2\n:020010000102EB\n:00000001FF'),
    'app.hex',
  )
  const converted = convertFirmware(source, { outputFmt: 'hex', baseAddrText: '' })
  const reparsed = parseIntelHex(converted.data)

  assert.equal(converted.extension, 'hex')
  assert.equal(reparsed.baseAddr, 0x08000010)
  assert.deepEqual([...reparsed.data], [0x01, 0x02])
})

test('slices and fills buffers with hex-style numeric inputs', () => {
  assert.deepEqual([...sliceBuffer(new Uint8Array([0, 1, 2, 3, 4]), {
    startText: '0x1',
    endText: '0x4',
    lengthText: '',
  })], [1, 2, 3])

  assert.deepEqual([...fillBuffer(new Uint8Array([0xAA, 0xBB]), {
    sizeText: '0x4',
    fillValueText: '0xFF',
    position: 'head',
  })], [0xFF, 0xFF, 0xAA, 0xBB])
})

test('builds slice previews with clamped byte ranges and percentages', () => {
  const preview = buildSlicePreview(0x1000, {
    startText: '0x100',
    endText: '0x500',
    lengthText: '',
  })

  assert.equal(preview.start, 0x100)
  assert.equal(preview.end, 0x500)
  assert.equal(preview.outputSize, 0x400)
  assert.equal(preview.beforeSize, 0x100)
  assert.equal(preview.afterSize, 0xB00)
  assert.equal(preview.selectionLeftPct, 6.25)
  assert.equal(preview.selectionWidthPct, 25)
})

test('builds fill previews for tail fill, head fill, and truncation', () => {
  const tail = buildFillPreview(0x100, {
    sizeText: '0x180',
    fillValueText: '0xFF',
    position: 'tail',
  })
  const head = buildFillPreview(0x100, {
    sizeText: '0x180',
    fillValueText: '0x00',
    position: 'head',
  })
  const truncated = buildFillPreview(0x100, {
    sizeText: '0x80',
    fillValueText: '0xAA',
    position: 'tail',
  })

  assert.deepEqual(tail.segments.map(segment => [segment.kind, segment.size]), [['data', 0x100], ['fill', 0x80]])
  assert.deepEqual(head.segments.map(segment => [segment.kind, segment.size]), [['fill', 0x80], ['data', 0x100]])
  assert.equal(tail.fillValue, 0xFF)
  assert.equal(head.fillValue, 0x00)
  assert.equal(truncated.truncated, true)
  assert.deepEqual(truncated.segments.map(segment => [segment.kind, segment.size]), [['data', 0x80]])
  assert.equal(truncated.truncatedSize, 0x80)
})

test('merges binary and addressed firmware segments by address or concatenation', () => {
  const addressed = [
    { baseAddr: 0x08000002, data: new Uint8Array([0x22, 0x33]) },
    { baseAddr: 0x08000000, data: new Uint8Array([0x00, 0x11]) },
  ]
  const byAddress = mergeFirmwareSegments(addressed, {
    mode: 'address',
    outputFmt: 'bin',
    fillValueText: '0xFF',
  })
  const concatenated = mergeFirmwareSegments(addressed, {
    mode: 'concat',
    outputFmt: 'bin',
    fillValueText: '0xFF',
  })

  assert.equal(byAddress.baseAddr, 0x08000000)
  assert.deepEqual([...byAddress.data], [0x00, 0x11, 0x22, 0x33])
  assert.equal(concatenated.baseAddr, 0)
  assert.deepEqual([...concatenated.data], [0x22, 0x33, 0x00, 0x11])
})

test('replaces one edited byte without mutating the original buffer', () => {
  const original = new Uint8Array([0x01, 0x02, 0x03])
  const updated = replaceByte(original, 1, 0xAA)

  assert.deepEqual([...original], [0x01, 0x02, 0x03])
  assert.deepEqual([...updated], [0x01, 0xAA, 0x03])
  assert.throws(() => replaceByte(original, 3, 0x00), /offset/i)
  assert.throws(() => replaceByte(original, 1, 0x100), /byte/i)
})
