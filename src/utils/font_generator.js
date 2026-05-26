/**
 * 点阵字库生成算法
 * 使用 Canvas 渲染字符并提取像素点阵
 */

/**
 * 生成单个字符的点阵数据
 * @param {string} char - 单个字符
 * @param {number} size - 分辨率 (12/16/24/32)
 * @param {object} opts - { negative, scanMode, lsbFirst, fontFamily, bold, xOffset, yOffset, threshold }
 * @returns {number[]} 字节数组
 */
export function generateBitmap(char, size, opts = {}) {
  const {
    negative = true,
    scanMode = '逐列',
    lsbFirst = true,
    fontFamily = '"SimSun", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
    bold = false,
    xOffset = 0,
    yOffset = 0,
    threshold = 128,
  } = opts
  const thresholdValue = Math.max(0, Math.min(255, Number(threshold) || 0))

  // 离屏 Canvas 渲染字符
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 黑底白字（阴码用白色画字，像素=1表示亮点）
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, size / 2 + Number(xOffset || 0), size / 2 + Number(yOffset || 0))

  // 读取像素
  const imageData = ctx.getImageData(0, 0, size, size)
  const pixels = imageData.data

  // 阳码：亮=0，暗=1
  const isNegative = negative
  const pixelOn = (x, y) => {
    const idx = (y * size + x) * 4
    const bright = ((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3) > thresholdValue
    return isNegative ? bright : !bright
  }

  const bytesPerUnit = Math.ceil(size / 8)
  const bitmap = []

  if (scanMode === '逐列' || scanMode === '列行') {
    // 纵向：逐列扫描，每列从上到下分多字节
    for (let col = 0; col < size; col++) {
      for (let bi = 0; bi < bytesPerUnit; bi++) {
        let byteVal = 0
        for (let bit = 0; bit < 8; bit++) {
          const row = bi * 8 + bit
          if (row < size && pixelOn(col, row)) {
            byteVal |= lsbFirst ? (1 << bit) : (0x80 >> bit)
          }
        }
        bitmap.push(byteVal)
      }
    }
  } else {
    // 横向：逐行扫描，每行从左到右分多字节
    for (let row = 0; row < size; row++) {
      for (let bi = 0; bi < bytesPerUnit; bi++) {
        let byteVal = 0
        for (let bit = 0; bit < 8; bit++) {
          const col = bi * 8 + bit
          if (col < size && pixelOn(col, row)) {
            byteVal |= lsbFirst ? (1 << bit) : (0x80 >> bit)
          }
        }
        bitmap.push(byteVal)
      }
    }
  }

  return bitmap
}

/**
 * 生成 C 头文件内容
 */
export function generateHeader(fontData, size, opts) {
  const {
    negative = true,
    scanMode = '逐列',
    lsbFirst = true,
    fontFamily = '"SimSun", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
    bold = false,
    xOffset = 0,
    yOffset = 0,
    threshold = 128,
  } = opts
  const bytesPerChar = size * Math.ceil(size / 8)
  const arrayName = `font_cn_${size}`
  const macroPrefix = arrayName.toUpperCase()
  const guardName = `${macroPrefix}_H`
  const attrName = `${macroPrefix}_ATTR`
  const sortedChars = Object.keys(fontData).sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0))

  const formatType = negative ? '阴码' : '阳码'
  const bitOrder = lsbFirst ? '低位在前' : '高位在前'

  const lines = [
    '/*',
    ' * 汉字点阵字库 (适配 OLED/LCD)',
    ` * 字体大小: ${size}x${size} 像素`,
    ` * 每字符: ${bytesPerChar} 字节`,
    ` * 点阵格式: ${formatType}`,
    ` * 取模方式: ${scanMode}`,
    ` * 取模方向: ${bitOrder}`,
    ` * 字体: ${fontFamily}${bold ? ' (粗体)' : ''}`,
    ` * 字形偏移: X=${xOffset}, Y=${yOffset}`,
    ` * 二值阈值: ${threshold}`,
    ' * 自动生成，请勿手动修改',
    ' */',
    '',
    `#ifndef ${guardName}`,
    `#define ${guardName}`,
    '',
    '#include <stdint.h>',
    '',
    `#ifndef ${attrName}`,
    `#define ${attrName}`,
    '#endif',
    '',
    `#define ${macroPrefix}_WIDTH  ${size}`,
    `#define ${macroPrefix}_HEIGHT ${size}`,
    `#define ${macroPrefix}_BYTES  ${bytesPerChar}`,
    `#define ${macroPrefix}_COUNT  ${sortedChars.length}`,
    '',
    '/* Unicode 索引表 (升序，支持二分查找) */',
    `static const uint16_t ${arrayName}_unicode[] ${attrName} = {`,
  ]

  for (let i = 0; i < sortedChars.length; i += 8) {
    const chunk = sortedChars.slice(i, i + 8)
    const vals = chunk.map(c => '0x' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'))
    lines.push(`    ${vals.join(', ')}, /* ${chunk.join('')} */`)
  }

  lines.push('};', '', '/* 点阵数据 */', `static const uint8_t ${arrayName}_data[][${bytesPerChar}] ${attrName} = {`)

  for (const c of sortedChars) {
    const bitmap = fontData[c]
    const hex = bitmap.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ')
    lines.push(`    {${hex}}, /* U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} '${c}' */`)
  }

  lines.push('};', '', '/* 二分查找 */',
    `static inline const uint8_t* ${arrayName}_find(uint16_t unicode) {`,
    `    int16_t l = 0, r = ${macroPrefix}_COUNT - 1;`,
    '    while (l <= r) {',
    '        int16_t m = (l + r) >> 1;',
    `        uint16_t v = ${arrayName}_unicode[m];`,
    `        if (v == unicode) return ${arrayName}_data[m];`,
    '        if (v < unicode) l = m + 1; else r = m - 1;',
    '    }',
    '    return 0;',
    '}',
    '',
    `#endif /* ${guardName} */`,
  )

  return lines.join('\n')
}

/**
 * 生成二进制数据（索引+数据分离）
 */
export function generateBinary(fontData, size) {
  const sortedChars = Object.keys(fontData).sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0))
  const bytesPerChar = size * Math.ceil(size / 8)

  // 索引区：每个字符2字节 Unicode
  const indexSize = sortedChars.length * 2
  // 数据区
  const dataSize = sortedChars.length * bytesPerChar
  const totalSize = indexSize + dataSize
  const buf = new Uint8Array(totalSize)

  let off = 0
  // 写入索引
  for (const c of sortedChars) {
    const code = c.charCodeAt(0)
    buf[off++] = code & 0xFF
    buf[off++] = (code >> 8) & 0xFF
  }
  // 写入数据
  for (const c of sortedChars) {
    const bitmap = fontData[c]
    for (const b of bitmap) {
      buf[off++] = b
    }
  }

  return { buffer: buf, charCount: sortedChars.length, bytesPerChar, chars: sortedChars }
}

export const CHARSETS = {
  '默认常用': '你好世界电机电源数据参数配置设置状态显示模式运行停止启动错误警告正常完成速度位置角度温度电流电压功率频率时间距离方向控制零一二三四五六七八九十百千万毫微秒分钟小时度伏安瓦上下左右前后开关增减升降高低快慢大小正反顺逆菜单返回确认取消退出保存主页选项调节校准测试',
  '数字+字母': '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  '常用符号': '+-*/=<>≤≥≠.,:;!?@#$%^&()[]{}|\\"\'`~_',
  '常用单位': '℃°%‰μnpfmkMGT·ΩΔΣπ±→←↑↓√∞≈',
  '数字中文': '零一二三四五六七八九十百千万亿点负正第',
  '时间日期': '年月日时分秒星期周一二三四五六天今明昨前后上午下晚早',
}

export const SCAN_MODES = ['逐列', '逐行', '行列', '列行']
export const FONT_SIZES = [12, 16, 24, 32]
export const FONT_FAMILIES = [
  { name: '宋体', value: 'SimSun' },
  { name: '微软雅黑', value: '"Microsoft YaHei"' },
  { name: '黑体', value: 'SimHei' },
  { name: '等线', value: 'DengXian' },
  { name: '苹方', value: '"PingFang SC"' },
  { name: 'Noto Sans CJK', value: '"Noto Sans CJK SC"' },
]
