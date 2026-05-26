/**
 * 时间戳转换
 */

export function timestampToDate(ts, format, unit = 'auto') {
  let ms
  if (unit === 'sec') {
    ms = Number(ts) * 1000
  } else if (unit === 'ms') {
    ms = Number(ts)
  } else {
    // auto-detect
    if (String(ts).length <= 10) {
      ms = Number(ts) * 1000
    } else {
      ms = Number(ts)
    }
  }
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null

  const pad = n => String(n).padStart(2, '0')
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  const ms3 = String(d.getMilliseconds()).padStart(3, '0')

  switch (format) {
    case 'iso': return `${Y}-${M}-${D}T${h}:${m}:${s}.${ms3}Z`
    case 'date': return `${Y}-${M}-${D}`
    case 'time': return `${h}:${m}:${s}`
    default: return `${Y}-${M}-${D} ${h}:${m}:${s}`
  }
}

export function dateToTimestamp(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return { seconds: Math.floor(d.getTime() / 1000), milliseconds: d.getTime() }
}

export function currentTimestamp() {
  const now = Date.now()
  return { seconds: Math.floor(now / 1000), milliseconds: now, date: timestampToDate(now) }
}
