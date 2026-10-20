const PH_LOCALE = "en-PH"
const PH_TIMEZONE = "Asia/Manila"

export function formatCurrency(cents: number, currency = "PHP") {
  return new Intl.NumberFormat(PH_LOCALE, {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString(PH_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: PH_TIMEZONE,
  })
}

export function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString(PH_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PH_TIMEZONE,
  })
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "No limit"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Format a timestamp for `<input type="datetime-local">`.
 *
 * The control reports and expects *local* wall-clock time, so the value has
 * to be rendered with the local getters. Formatting it with `toISOString()`
 * would show UTC and shift the date by the offset.
 */
export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * Parse a `<input type="datetime-local">` value into a UTC ISO timestamp.
 *
 * The control can only report a naive local string, and the API stores
 * timestamps in UTC, so the local wall-clock time is converted here instead
 * of being sent as-is and read as UTC.
 */
export function fromDateTimeLocal(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
