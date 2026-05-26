import test from 'node:test'
import assert from 'node:assert/strict'

import {
  detectAndParse,
  generateIntelHex,
  generateSrec,
  parseIntelHex,
  parseSrec,
  searchHex,
} from '../src/utils/hextools.js'

test('parses Intel HEX only when record length and checksum are valid', () => {
  assert.deepEqual([...parseIntelHex(':01000000AA55\n:00000001FF').data], [0xAA])
  assert.throws(
    () => parseIntelHex(':01000000AA56\n:00000001FF'),
    /checksum/i,
  )
  assert.throws(
    () => parseIntelHex(':02000000AA55\n:00000001FF'),
    /length/i,
  )
})

test('round-trips S-Record data without dropping the last byte', () => {
  const data = new Uint8Array([0x01, 0x02, 0x03, 0xFE])
  const generated = generateSrec(data, 0x1000)
  const parsed = parseSrec(generated)

  assert.equal(parsed.baseAddr, 0x1000)
  assert.deepEqual([...parsed.data], [...data])
})

test('detectAndParse accepts binary buffers before text probing', () => {
  const parsed = detectAndParse(new Uint8Array([0x11, 0x22, 0x33]), 'app.bin')

  assert.equal(parsed.baseAddr, 0)
  assert.deepEqual([...parsed.data], [0x11, 0x22, 0x33])
})

test('generates Intel HEX at the parsed base address', () => {
  const parsed = parseIntelHex(':020000040800F2\n:0400000001020304F2\n:00000001FF')
  const reparsed = parseIntelHex(generateIntelHex(parsed.data, parsed.baseAddr))

  assert.equal(reparsed.baseAddr, 0x08000000)
  assert.deepEqual([...reparsed.data], [0x01, 0x02, 0x03, 0x04])
})

test('rejects malformed hex search patterns', () => {
  assert.throws(() => searchHex(new Uint8Array([0xAA]), 'A'), /hex/i)
  assert.throws(() => searchHex(new Uint8Array([0xAA]), 'ZZ'), /hex/i)
})
