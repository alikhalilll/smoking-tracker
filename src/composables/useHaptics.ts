/**
 * Tiny haptics wrapper. Calls `navigator.vibrate` where available
 * (Android Chrome, mostly) and is a no-op on iOS Safari.
 */

export type HapticPattern = 'tap' | 'success' | 'celebrate' | 'warn'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [12, 30, 12],
  celebrate: [12, 30, 12, 30, 24],
  warn: [40, 20, 40],
}

export function useHaptics() {
  function fire(pattern: HapticPattern = 'tap'): void {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      // ignore — some platforms throw
    }
  }
  return { fire }
}
