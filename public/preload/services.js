const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const mapParser = require('./map_parser.js')

let iconv, jschardet
try {
  iconv = require('iconv-lite')
} catch (e) { iconv = null }
try {
  jschardet = require('jschardet')
} catch (e) { jschardet = null }

function getPath(name) {
  if (window.utools?.getPath) {
    return window.utools.getPath(name)
  }
  if (name === 'downloads') return path.join(os.homedir(), 'Downloads')
  if (name === 'home') return os.homedir()
  return os.homedir()
}

function requireUtools(method) {
  if (!window.utools?.[method]) {
    throw new Error(`uTools API not available: ${method}`)
  }
  return window.utools[method].bind(window.utools)
}

window.services = {
  isPluginHost() {
    return !!window.utools
  },

  onPluginEnter(callback) {
    if (window.utools?.onPluginEnter) {
      window.utools.onPluginEnter(callback)
    } else if (typeof callback === 'function') {
      callback()
    }
  },

  onPluginOut(callback) {
    if (window.utools?.onPluginOut) {
      window.utools.onPluginOut(callback)
    }
  },

  getPath,

  readFile(file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },

  readFileBuffer(file) {
    const buf = fs.readFileSync(file)
    return new Uint8Array(buf)
  },

  writeFile(filePath, data) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (typeof data === 'string') {
      fs.writeFileSync(filePath, data, { encoding: 'utf-8' })
    } else {
      fs.writeFileSync(filePath, Buffer.from(data))
    }
    return filePath
  },

  readDir(dirPath, recursive) {
    const entries = []
    function walk(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        const fullPath = path.join(dir, item.name)
        if (item.isDirectory()) {
          if (recursive !== false) walk(fullPath)
        } else {
          entries.push(fullPath)
        }
      }
    }
    walk(dirPath)
    return entries
  },

  decodeText(buffer, encoding) {
    if (!iconv) throw new Error('iconv-lite not installed')
    return iconv.decode(Buffer.from(buffer), encoding)
  },

  encodeText(text, encoding) {
    if (!iconv) throw new Error('iconv-lite not installed')
    return new Uint8Array(iconv.encode(text, encoding))
  },

  detectEncoding(buffer) {
    if (!jschardet) throw new Error('jschardet not installed')
    const buf = Buffer.from(buffer)
    const result = jschardet.detect(buf)
    return result
  },

  getFileHash(filePath, algorithm) {
    const hash = crypto.createHash(algorithm || 'sha256')
    const stream = fs.createReadStream(filePath)
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  },

  showOpenDialog(opts) {
    const showOpenDialog = requireUtools('showOpenDialog')
    const result = showOpenDialog(opts || {})
    if (!result) return null
    return Array.isArray(result) ? result : [result]
  },

  showSaveDialog(opts) {
    const showSaveDialog = requireUtools('showSaveDialog')
    return showSaveDialog(opts || {})
  },

  parseMapFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.stringify(mapParser.parse(content))
  },

  findSymbolByAddress(symbols, targetAddr) {
    return mapParser.findSymbolByAddress(symbols, targetAddr)
  },

  getTopSymbols(symbols, limit) {
    return mapParser.getTopSymbols(symbols, limit)
  }
}
