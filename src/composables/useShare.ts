export interface ShareResult {
  ok: boolean
  via: 'web-share' | 'clipboard' | 'none'
  reason?: string
}

const APP_URL = 'https://alikhalilll.github.io/smoking-tracker/'

/** Share text via the Web Share API; fall back to clipboard. */
export async function share(payload: {
  title: string
  text: string
}): Promise<ShareResult> {
  if (typeof navigator === 'undefined') {
    return { ok: false, via: 'none', reason: 'no_navigator' }
  }
  // Web Share — works on iOS Safari, Android Chrome, macOS Safari, Edge.
  if ('share' in navigator) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: APP_URL,
      })
      return { ok: true, via: 'web-share' }
    } catch (err) {
      // AbortError = user dismissed the sheet — not really a failure.
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, via: 'web-share', reason: 'aborted' }
      }
      // Fall through to clipboard fallback.
      console.warn('[share] navigator.share failed, falling back:', err)
    }
  }
  // Clipboard fallback for desktop browsers without Web Share.
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(`${payload.text}\n\n${APP_URL}`)
      return { ok: true, via: 'clipboard' }
    } catch (err) {
      return { ok: false, via: 'clipboard', reason: String(err) }
    }
  }
  return { ok: false, via: 'none', reason: 'no_share_path' }
}
