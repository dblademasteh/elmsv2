/**
 * URL helpers shared by the submission forms and the staff grading view.
 *
 * A submission's `file_url` is controlled by the student but rendered as a
 * link that an instructor clicks, so the scheme is restricted to the ones
 * that are safe to navigate to. This mirrors `app/core/urls.py` on the API
 * side — the client check is a convenience, the server check is the one
 * that matters.
 */

const ALLOWED_SCHEMES = ["http:", "https:"]

/**
 * Whether the value is a root-relative, same-origin path.
 *
 * `//host/x` and `/\host/x` are not relative paths: browsers resolve them
 * against the current scheme and treat them as protocol-relative URLs.
 */
function isRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
}

/**
 * Normalise a user-supplied URL, or return null when it is not safe to
 * render as a link.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null

  const value = url.trim()
  if (!value) return null

  if (isRelativePath(value)) return value

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return null
  return parsed.toString()
}

/**
 * The file name to show for a submission URL.
 */
export function fileNameFromUrl(url: string | null | undefined, fallback = "submission") {
  if (!url) return fallback
  const parts = url.split("?")[0].split("/")
  const last = parts[parts.length - 1]
  return last || fallback
}
