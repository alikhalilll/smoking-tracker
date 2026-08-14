import { ref, type Ref } from 'vue'
import { metaPut, META } from '../db'

/**
 * Tiny haptics wrapper. Uses `navigator.vibrate` where available
 * (Android Chrome / Edge, most desktop browsers no-op). iOS Safari
 * does not expose any web haptics API — Apple has not shipped one for
 * the web — so on iPhone/iPad the call silently no-ops regardless of
 * the user setting. The toggle still applies on platforms that do
 * support vibration.
 */

export type HapticPattern = 'tap' | 'success' | 'celebrate' | 'warn'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [12, 30, 12],
  celebrate: [12, 30, 12, 30, 24],
  warn: [40, 20, 40],
}

// Module-level singleton so every consumer reads the same toggle.
// Default true; hydrateFromDexie overrides after boot.
const enabled: Ref<boolean> = ref(true)

/** Called by hydrate.ts after Dexie is open. */
export function hydrateHapticsFromDexie(value: boolean | undefined): void {
  if (typeof value !== 'boolean') return
  enabled.value = value
}

function persist(v: boolean): void {
  void metaPut(META.settingsHapticsEnabled, v)
}

export interface UseHaptics {
  enabled: Ref<boolean>
  /** Native support — true on Android Chrome and a few others, false
   *  on iOS Safari and most desktop browsers. UI uses this to show
   *  a "not supported on this device" hint when needed. */
  supported: boolean
  fire: (pattern?: HapticPattern) => void
  setEnabled: (v: boolean) => void
  /** Apply a value pulled from the cloud without echoing back to push. */
  applyRemote: (v: boolean) => void
}

const supported =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function'

export function useHaptics(): UseHaptics {
  function fire(pattern: HapticPattern = 'tap'): void {
    if (!enabled.value) return
    if (!supported) return
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      // ignore — some platforms throw
    }
  }
  function setEnabled(v: boolean): void {
    enabled.value = v
    persist(v)
  }
  function applyRemote(v: boolean): void {
    enabled.value = v
    persist(v)
  }
  return { enabled, supported, fire, setEnabled, applyRemote }
}
