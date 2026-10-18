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
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}
