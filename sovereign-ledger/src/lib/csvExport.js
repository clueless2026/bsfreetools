/**
 * Format integer cents as a fixed two-decimal dollar string for human-facing CSV exports.
 * JSON backups must keep raw cents — only use this for CSV.
 * @param {number|null|undefined|string} cents
 * @param {{ blankWhenEmpty?: boolean }} [options] - when true, null/undefined/'' yields '' (optional fields)
 */
export function centsToDollarCsvString(cents, options = {}) {
  const { blankWhenEmpty = false } = options
  if (cents === null || cents === undefined || cents === '') {
    return blankWhenEmpty ? '' : '0.00'
  }
  const n = Number(cents)
  if (!Number.isFinite(n)) {
    return blankWhenEmpty ? '' : '0.00'
  }
  return (n / 100).toFixed(2)
}

export function escapeCsvCell(value) {
  const s = String(value ?? '')
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
