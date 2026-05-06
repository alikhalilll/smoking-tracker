import { ref, type Ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

// Check for a new build every hour. The browser also re-checks the SW
// on focus and on navigation, but a long-lived PWA session (the user
// keeps the app open for days) wouldn't see a deploy without this.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000

let initialized = false
const needRefresh = ref(false)
let updateSW: ((reload?: boolean) => Promise<void>) | null = null

function ensureRegistered(): void {
  if (initialized) return
  initialized = true

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Background poll so users on a long session still get the prompt
      // when a new build ships. We only poll when online — the call
      // would just fail otherwise and burn battery.
      window.setInterval(() => {
        if (!navigator.onLine) return
        void registration.update()
      }, UPDATE_INTERVAL_MS)
    },
  })
}

export function usePwaUpdate(): {
  needRefresh: Ref<boolean>
  applyUpdate: () => void
  dismiss: () => void
} {
  ensureRegistered()
  return {
    needRefresh,
    applyUpdate(): void {
      // updateSW(true) sends `skipWaiting` to the new SW and reloads
      // the page once it takes control.
      void updateSW?.(true)
    },
    dismiss(): void {
      needRefresh.value = false
    },
  }
}
