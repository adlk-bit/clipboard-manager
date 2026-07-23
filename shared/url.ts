const SCHEME_LESS_URL = /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i

/**
 * Returns an HTTP(S) URL safe to hand to Electron's shell.openExternal.
 * Clipboard entries must contain exactly one URL; URLs embedded in prose are
 * deliberately not recognized.
 */
export function normalizeHttpUrl(input: string): string | null {
  const trimmed = input.trim()

  if (!trimmed || /\s/.test(trimmed)) return null

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : SCHEME_LESS_URL.test(trimmed)
      ? `https://${trimmed}`
      : null

  if (!candidate) return null

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
