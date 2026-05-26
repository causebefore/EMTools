/**
 * Parse IPv4 dotted-decimal string.
 * Returns { int, hex, bin } or null.
 */
function parseIPv4(input) {
  const parts = String(input).trim().split('.')
  if (parts.length !== 4) return null

  const nums = parts.map((part) => {
    if (!/^\d+$/.test(part)) return NaN
    return Number(part)
  })
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null

  const int = (
    nums[0] * 0x1000000 +
    nums[1] * 0x10000 +
    nums[2] * 0x100 +
    nums[3]
  ) >>> 0

  return {
    int,
    hex: '0x' + int.toString(16).toUpperCase().padStart(8, '0'),
    bin: nums.map((n) => n.toString(2).padStart(8, '0')).join('.'),
  }
}

/**
 * Expand abbreviated IPv6 address to full 8-group colon-hex form.
 */
function expandIPv6(input) {
  let s = String(input).trim()
  if (!s) return null

  // Reject obviously invalid patterns
  if (s.includes(':::') || (s.match(/::/g) || []).length > 1) return null
  // Reject leading colon unless it's ::
  if (s[0] === ':' && s[1] !== ':') return null
  // Reject trailing colon unless it's ::
  if (s[s.length - 1] === ':' && s[s.length - 2] !== ':') return null

  // Handle IPv4-mapped IPv6: ::ffff:192.168.1.1
  const v4Mapped = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (v4Mapped) {
    const v4 = parseIPv4(v4Mapped[2])
    if (!v4) return null
    const hex32 = v4.int
    const hi = ((hex32 >>> 16) & 0xffff).toString(16).padStart(4, '0')
    const lo = (hex32 & 0xffff).toString(16).padStart(4, '0')
    s = v4Mapped[1] + hi + ':' + lo
  }

  // Handle :: abbreviation
  if (s.includes('::')) {
    const parts = s.split('::')
    if (parts.length > 2) return null
    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []

    // Validate no empty groups from leading/trailing/double colons
    if (left.some(g => !g) || right.some(g => !g)) return null

    const missing = 8 - left.length - right.length
    if (missing < 1) return null
    const groups = [...left, ...Array(missing).fill('0'), ...right]
    s = groups.map((g) => g.padStart(4, '0')).join(':')
  } else {
    const groups = s.split(':')
    if (groups.length !== 8) return null
    if (groups.some(g => !g)) return null
    s = groups.map((g) => g.padStart(4, '0')).join(':')
  }

  if (!/^([0-9A-Fa-f]{4}:){7}[0-9A-Fa-f]{4}$/.test(s)) return null
  return s.toUpperCase()
}

/**
 * Parse an IPv4 or IPv6 address string.
 * Returns { version, int, hex, bin } or null.
 */
export function formatIpAddress(input) {
  const v4 = parseIPv4(input)
  if (v4) return { version: 4, ...v4 }

  const expanded = expandIPv6(input)
  if (!expanded) return null

  const groups = expanded.split(':')
  const hexCompact = groups.join('').toUpperCase()
  const int = BigInt('0x' + hexCompact)

  return {
    version: 6,
    int: int.toString(),
    hex: '0x' + hexCompact,
    bin: groups.map((g) => parseInt(g, 16).toString(2).padStart(16, '0')).join(':'),
  }
}
