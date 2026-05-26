import assert from 'node:assert/strict'
import test from 'node:test'

import { generateBitmap, generateHeader } from '../src/utils/font_generator.js'

test('generated header uses a non-reserved guard and configurable storage attribute', () => {
  const bytesPerChar = 16 * Math.ceil(16 / 8)
  const fontData = {
    '你': new Array(bytesPerChar).fill(0x00),
  }

  const header = generateHeader(fontData, 16, {
    negative: true,
    scanMode: '逐列',
    lsbFirst: true,
  })

  assert.match(header, /#ifndef FONT_CN_16_H\n#define FONT_CN_16_H/)
  assert.doesNotMatch(header, /__FONT_CN_16_H__/)
  assert.match(header, /#ifndef FONT_CN_16_ATTR\n#define FONT_CN_16_ATTR\n#endif/)
  assert.match(header, /static const uint16_t font_cn_16_unicode\[\] FONT_CN_16_ATTR = \{/)
  assert.match(header, /static const uint8_t font_cn_16_data\[\]\[32\] FONT_CN_16_ATTR = \{/)
  assert.match(header, /#endif \/\* FONT_CN_16_H \*\//)
})

test('bitmap generation applies font, bold, offset, and threshold options', () => {
  const originalDocument = globalThis.document
  const calls = []
  const pixels = new Uint8ClampedArray(8 * 8 * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 100
    pixels[i + 1] = 100
    pixels[i + 2] = 100
    pixels[i + 3] = 255
  }

  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas')
      return {
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, '2d')
          return {
            fillStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
            fillRect() {},
            fillText(char, x, y) {
              calls.push({ char, x, y, font: this.font })
            },
            getImageData() {
              return { data: pixels }
            },
          }
        },
      }
    },
  }

  try {
    const defaultBitmap = generateBitmap('A', 8, { negative: true, scanMode: '逐行', lsbFirst: true })
    const tunedBitmap = generateBitmap('A', 8, {
      negative: true,
      scanMode: '逐行',
      lsbFirst: true,
      fontFamily: 'TestFont',
      bold: true,
      xOffset: 2,
      yOffset: -1,
      threshold: 80,
    })

    assert.deepEqual(defaultBitmap, new Array(8).fill(0x00))
    assert.deepEqual(tunedBitmap, new Array(8).fill(0xFF))
    assert.deepEqual(calls.at(-1), {
      char: 'A',
      x: 6,
      y: 3,
      font: 'bold 8px TestFont',
    })
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = originalDocument
    }
  }
})
