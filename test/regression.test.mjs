import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFieldMask,
  formatRegisterHex,
  parseRegisterHex,
  toggleRegisterBit,
} from '../src/utils/bitfield.js'
import { describeCharacter } from '../src/utils/charenc.js'
import { formatIpAddress } from '../src/utils/ip.js'
import { checksumXor, checksumSumLow, checksumTwosComplement, checksumFletcher16 } from '../src/utils/checksum.js'

test('checksum XOR across bytes', () => {
  assert.equal(checksumXor(new Uint8Array([0x01, 0x02, 0x03])), 0x00) // 1^2^3=0
  assert.equal(checksumXor(new Uint8Array([0xFF, 0xFF, 0xFF])), 0xFF)
  assert.equal(checksumXor(new Uint8Array([0x00, 0x00])), 0x00)
  assert.equal(checksumXor(new Uint8Array([])), 0x00)
})

test('checksum sum-low truncates to 8 bits', () => {
  assert.equal(checksumSumLow(new Uint8Array([0x01, 0x02, 0x03])), 0x06)
  assert.equal(checksumSumLow(new Uint8Array([0xFF, 0xFF])), 0xFE)
  assert.equal(checksumSumLow(new Uint8Array([0x80, 0x80])), 0x00)
  assert.equal(checksumSumLow(new Uint8Array([])), 0x00)
})

test('checksum twos-complement matches Intel HEX pattern', () => {
  // Intel HEX line data: 03 00 30 00 02 33 7A → sum=0xE2, ~E2+1=0x1E
  assert.equal(checksumTwosComplement(new Uint8Array([0x03, 0x00, 0x30, 0x00, 0x02, 0x33, 0x7A])), 0x1E)
  assert.equal(checksumTwosComplement(new Uint8Array([0x00])), 0x00)
  assert.equal(checksumTwosComplement(new Uint8Array([])), 0x00)
})

test('checksum Fletcher-16 fields', () => {
  const empty = checksumFletcher16(new Uint8Array([]))
  assert.equal(empty.sum1, 0)
  assert.equal(empty.sum2, 0)
  assert.equal(empty.combined, 0)

  const single = checksumFletcher16(new Uint8Array([0x01]))
  assert.equal(single.sum1, 1)
  assert.equal(single.sum2, 1)
  assert.equal(single.combined, 0x0101)

  const two = checksumFletcher16(new Uint8Array([0x01, 0x02]))
  assert.equal(two.sum1, 3)
  assert.equal(two.sum2, 4)
  assert.equal(two.combined, 0x0403)
})

test('formats IPv4 addresses as unsigned 32-bit values', () => {
  assert.deepEqual(formatIpAddress('192.168.1.1'), {
    version: 4,
    int: 3232235777,
    hex: '0xC0A80101',
    bin: '11000000.10101000.00000001.00000001',
  })
})

test('parses IPv6 addresses and expands :: abbreviation', () => {
  const r = formatIpAddress('2001:db8::1')
  assert.equal(r.version, 6)
  assert.equal(r.hex, '0x20010DB8000000000000000000000001')
  assert.ok(r.bin.includes(':'))
})

test('rejects invalid IP strings', () => {
  assert.equal(formatIpAddress('not.an.ip'), null)
  assert.equal(formatIpAddress('999.999.999.999'), null)
  assert.equal(formatIpAddress('192.168.1'), null)
  assert.equal(formatIpAddress(':::'), null)
})

test('builds masks for upper 64-bit fields without signed shift overflow', () => {
  assert.equal(buildFieldMask({ start: 32, end: 63 }, 64), '0xFFFFFFFF00000000')
  assert.equal(buildFieldMask({ start: 0, end: 63 }, 64), '0xFFFFFFFFFFFFFFFF')
})

test('toggles and formats 64-bit register values without Number precision loss', () => {
  const highBit = toggleRegisterBit(0n, 63, 64)

  assert.equal(formatRegisterHex(highBit, 64), '0x8000000000000000')
  assert.equal(parseRegisterHex('0xFFFFFFFFFFFFFFFF'), 0xFFFFFFFFFFFFFFFFn)
})

test('describes unicode code points beyond the BMP', () => {
  assert.deepEqual(describeCharacter('😀'), {
    unicode: 'U+1F600',
    utf8: 'F0 9F 98 80',
    utf16be: 'D8 3D DE 00',
  })
})
