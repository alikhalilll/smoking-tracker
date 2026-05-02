import { ref, type Ref } from 'vue'

export interface ReminderSettings {
  enabled: boolean
  /** Minutes to wait between reminders / since last log. */
  gapMinutes: number
}

const STORAGE_KEY = 'smoking-tracker-reminders'

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  gapMinutes: 30,
}

function load(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>
    return {
      enabled: !!parsed.enabled,
      gapMinutes:
        typeof parsed.gapMinutes === 'number' && parsed.gapMinutes > 0
          ? parsed.gapMinutes
          : DEFAULT_SETTINGS.gapMinutes,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function save(s: ReminderSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

const settings: Ref<ReminderSettings> = ref(load())

const permission: Ref<NotificationPermission> = ref(
  typeof Notification !== 'undefined' ? Notification.permission : 'denied'
)

let timerId: ReturnType<typeof setTimeout> | null = null

export const REMINDER_GAP_OPTIONS: ReadonlyArray<{
  minutes: number
  label: string
}> = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 240, label: '4h' },
]

function clearTimer(): void {
  if (timerId !== null) {
    clearTimeout(timerId)
    timerId = null
  }
}

const ICON_URL = `${import.meta.env.BASE_URL}icon-192.png`

// Soft two-note chime (C5 → E5, sine wave with a gentle envelope).
// Synthesised on the fly so there's no audio file to ship or cache.
function playChime(): void {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx = (window.AudioContext ||
    (window as any).webkitAudioContext) as typeof AudioContext | undefined
  if (!Ctx) return
  let ctx: AudioContext
  try {
    ctx = new Ctx()
  } catch {
    return
  }
  const now = ctx.currentTime
  const playNote = (freq: number, start: number, duration: number): void => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.12, start + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration)
  }
  // C5, then E5 a beat later — gentle major-third chime.
  playNote(523.25, now, 0.7)
  playNote(659.25, now + 0.18, 0.85)
  // Best-effort cleanup once the sound is done.
  setTimeout(() => {
    void ctx.close().catch(() => undefined)
  }, 1500)
}

/** Tab the app should switch to when the user clicks a reminder notification. */
const REMINDER_ROUTE = 'quit'

function emitNotificationClick(): void {
  if (typeof window === 'undefined') return
  try {
    window.focus()
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent('reminder-clicked', { detail: REMINDER_ROUTE })
  )
}

function attachClickHandler(n: Notification): void {
  n.onclick = (e) => {
    e.preventDefault()
    emitNotificationClick()
    n.close()
  }
}

async function showNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    console.warn('[reminders] Notification API not available')
    return false
  }
  if (permission.value !== 'granted') {
    console.warn('[reminders] permission not granted:', permission.value)
    return false
  }

  // Always chime — independent of OS notification settings, so the user
  // hears something even if macOS suppresses the visual banner.
  playChime()

  // Prefer the service worker path. iOS Safari (16.4+ in PWA mode) ONLY
  // supports notifications via ServiceWorkerRegistration.showNotification —
  // calling `new Notification()` directly throws there.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        icon: ICON_URL,
        badge: ICON_URL,
        tag: 'smoke-reminder',
        renotify: true,
        data: { route: REMINDER_ROUTE },
      } as NotificationOptions)
      return true
    } catch (err) {
      console.warn('[reminders] SW notification failed, falling back:', err)
    }
  }

  try {
    const n = new Notification(title, {
      body,
      icon: ICON_URL,
      tag: 'smoke-reminder',
    })
    attachClickHandler(n)
    return true
  } catch (err) {
    console.warn('[reminders] Notification constructor failed:', err)
    return false
  }
}

export interface UseReminders {
  settings: Ref<ReminderSettings>
  permission: Ref<NotificationPermission>
  requestPermission: () => Promise<void>
  setEnabled: (b: boolean) => void
  setGap: (minutes: number) => void
  /** Schedule the next reminder. Call after each log, or to (re)start the cycle. */
  scheduleNext: (titleAndBody: { title: string; body: string }) => void
  /** Fire one notification immediately. Returns a diagnostic object so the UI can show a meaningful error. */
  sendTest: (titleAndBody: { title: string; body: string }) => Promise<{
    ok: boolean
    reason?: string
    via?: string
  }>
  cancel: () => void
}

export function useReminders(): UseReminders {
  async function requestPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return
    try {
      const result = await Notification.requestPermission()
      permission.value = result
    } catch {
      // ignore
    }
  }

  function setEnabled(b: boolean): void {
    settings.value = { ...settings.value, enabled: b }
    save(settings.value)
    if (!b) clearTimer()
  }

  function setGap(minutes: number): void {
    settings.value = { ...settings.value, gapMinutes: minutes }
    save(settings.value)
    // Caller is expected to scheduleNext to restart the cycle with the new gap.
  }

  function scheduleNext(payload: { title: string; body: string }): void {
    clearTimer()
    if (!settings.value.enabled) return
    if (permission.value !== 'granted') return
    const ms = settings.value.gapMinutes * 60_000
    timerId = setTimeout(() => {
      void showNotification(payload.title, payload.body)
      // Re-arm so reminders continue while the app is open.
      scheduleNext(payload)
    }, ms)
  }

  function cancel(): void {
    clearTimer()
  }

  async function sendTest(payload: {
    title: string
    body: string
  }): Promise<{ ok: boolean; reason?: string; via?: string }> {
    if (typeof Notification === 'undefined') {
      return { ok: false, reason: 'API_UNAVAILABLE' }
    }
    // Always re-read live permission in case it changed in browser settings.
    permission.value = Notification.permission

    if (permission.value !== 'granted') {
      try {
        const result = await Notification.requestPermission()
        permission.value = result
      } catch (err) {
        console.error('[reminders] requestPermission threw:', err)
        return { ok: false, reason: 'REQUEST_THREW' }
      }
    }
    if (permission.value !== 'granted') {
      return { ok: false, reason: `PERMISSION_${permission.value.toUpperCase()}` }
    }

    // Chime first so the user can verify audio works even before the
    // notification banner is checked.
    playChime()

    // Try plain Notification first — works on macOS Safari/Chrome/Firefox tabs.
    try {
      const n = new Notification(payload.title, {
        body: payload.body,
        icon: ICON_URL,
        tag: 'smoke-reminder-test',
        // Keep the test on-screen until the user dismisses it, so the
        // "I clicked but saw nothing" debugging path is conclusive.
        requireInteraction: true,
      } as NotificationOptions)
      attachClickHandler(n)
      return { ok: true, via: 'CONSTRUCTOR' }
    } catch (err) {
      console.warn('[reminders] Notification ctor failed, trying SW:', err)
    }

    // Fall back to service worker — required on iOS Safari PWA.
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: ICON_URL,
          badge: ICON_URL,
          tag: 'smoke-reminder-test',
          renotify: true,
          requireInteraction: true,
          data: { route: REMINDER_ROUTE },
        } as NotificationOptions)
        return { ok: true, via: 'SW' }
      } catch (err) {
        console.error('[reminders] SW showNotification failed:', err)
        return { ok: false, reason: 'SW_FAILED', via: String(err) }
      }
    }
    return { ok: false, reason: 'NO_PATH' }
  }

  return {
    settings,
    permission,
    requestPermission,
    setEnabled,
    setGap,
    scheduleNext,
    sendTest,
    cancel,
  }
}
