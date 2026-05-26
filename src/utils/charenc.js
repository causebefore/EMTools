function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

export function describeCharacter(input) {
  const chars = Array.from(String(input ?? ''))
  if (!chars.length) return null

  const char = chars[0]
  const codePoint = char.codePointAt(0)
  const utf16 = []
  for (let i = 0; i < char.length; i++) {
    const unit = char.charCodeAt(i)
    utf16.push((unit >> 8) & 0xFF, unit & 0xFF)
  }

  return {
    unicode: `U+${codePoint.toString(16).toUpperCase().padStart(codePoint > 0xFFFF ? 5 : 4, '0')}`,
    utf8: bytesToHex(new TextEncoder().encode(char)),
    utf16be: bytesToHex(utf16),
  }
}
