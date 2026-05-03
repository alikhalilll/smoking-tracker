import { ref, type Ref } from 'vue'
import { currentLocale, type Locale } from '../i18n'

export type NotificationLocale = 'auto' | Locale

export interface ReminderSettings {
  enabled: boolean
  /** Minutes to wait between reminders / since last log. */
  gapMinutes: number
  /** Language for notification text. 'auto' follows the app locale. */
  notificationLocale: NotificationLocale
  /** When true, suppress notifications between bedtimeStart and bedtimeEnd. */
  bedtimeEnabled: boolean
  /** "HH:MM" 24-hour, local time. */
  bedtimeStart: string
  /** "HH:MM" 24-hour, local time. May be < bedtimeStart (wraps midnight). */
  bedtimeEnd: string
}

const STORAGE_KEY = 'smoking-tracker-reminders'

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  gapMinutes: 30,
  notificationLocale: 'auto',
  bedtimeEnabled: false,
  bedtimeStart: '22:00',
  bedtimeEnd: '07:00',
}

/** "HH:MM" → minutes since midnight. */
function timeToMins(t: string): number {
  const [h, m] = t.split(':').map((v) => parseInt(v, 10) || 0)
  return h * 60 + m
}

/** Is the given Date inside the [start, end) bedtime window? */
function isInBedtime(d: Date, startHM: string, endHM: string): boolean {
  const cur = d.getHours() * 60 + d.getMinutes()
  const s = timeToMins(startHM)
  const e = timeToMins(endHM)
  if (s === e) return false
  if (s < e) return cur >= s && cur < e
  // Window wraps past midnight.
  return cur >= s || cur < e
}

/** Returns the next future Date at HH:MM (today if still ahead, else tomorrow). */
function nextOccurrenceAt(hm: string): Date {
  const [h, m] = hm.split(':').map((v) => parseInt(v, 10) || 0)
  const d = new Date()
  d.setSeconds(0, 0)
  d.setHours(h, m, 0, 0)
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

const HM_RE = /^\d{2}:\d{2}$/

function load(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>
    const loc = parsed.notificationLocale
    const validLoc: NotificationLocale =
      loc === 'auto' || loc === 'en' || loc === 'ar' ? loc : 'auto'
    const startHM =
      typeof parsed.bedtimeStart === 'string' && HM_RE.test(parsed.bedtimeStart)
        ? parsed.bedtimeStart
        : DEFAULT_SETTINGS.bedtimeStart
    const endHM =
      typeof parsed.bedtimeEnd === 'string' && HM_RE.test(parsed.bedtimeEnd)
        ? parsed.bedtimeEnd
        : DEFAULT_SETTINGS.bedtimeEnd
    return {
      enabled: !!parsed.enabled,
      gapMinutes:
        typeof parsed.gapMinutes === 'number' && parsed.gapMinutes > 0
          ? parsed.gapMinutes
          : DEFAULT_SETTINGS.gapMinutes,
      notificationLocale: validLoc,
      bedtimeEnabled: !!parsed.bedtimeEnabled,
      bedtimeStart: startHM,
      bedtimeEnd: endHM,
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

// Single shared AudioContext so iOS doesn't have to re-acquire audio focus
// every time. Lazy-created on first call inside a user gesture.
let chimeCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx = (window.AudioContext ||
    (window as any).webkitAudioContext) as typeof AudioContext | undefined
  if (!Ctx) return null
  if (!chimeCtx) {
    try {
      chimeCtx = new Ctx()
    } catch {
      return null
    }
  }
  return chimeCtx
}

// Soft two-note chime (C5 → E5, sine wave with a gentle envelope).
// Synthesised on the fly so there's no audio file to ship or cache.
async function playChime(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return

  // iOS Safari starts the AudioContext suspended until a user gesture
  // resumes it. Calling resume() inside a click handler thaws the
  // context for the rest of the session.
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (err) {
      console.warn('[reminders] AudioContext resume failed:', err)
      return
    }
  }

  const now = ctx.currentTime
  const playNote = (freq: number, start: number, duration: number): void => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration)
  }
  // C5, then E5 a beat later — gentle major-third chime.
  playNote(523.25, now, 0.7)
  playNote(659.25, now + 0.18, 0.85)
}

/** Tab the app should switch to when the user clicks a reminder notification. */
const REMINDER_ROUTE = 'quit'

/** Resolve the user's notification locale preference to a concrete locale. */
export function resolvedNotificationLocale(): Locale {
  const pref = settings.value.notificationLocale
  if (pref === 'en' || pref === 'ar') return pref
  return currentLocale.value
}

function localeDir(): 'rtl' | 'ltr' {
  return resolvedNotificationLocale() === 'ar' ? 'rtl' : 'ltr'
}

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
  void playChime()

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
        dir: localeDir(),
        lang: currentLocale.value,
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
      dir: localeDir(),
      lang: currentLocale.value,
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
  setNotificationLocale: (loc: NotificationLocale) => void
  setBedtime: (opts: { enabled?: boolean; start?: string; end?: string }) => void
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

  function setNotificationLocale(loc: NotificationLocale): void {
    settings.value = { ...settings.value, notificationLocale: loc }
    save(settings.value)
  }

  function setBedtime(opts: {
    enabled?: boolean
    start?: string
    end?: string
  }): void {
    settings.value = {
      ...settings.value,
      bedtimeEnabled:
        opts.enabled !== undefined
          ? opts.enabled
          : settings.value.bedtimeEnabled,
      bedtimeStart:
        opts.start && HM_RE.test(opts.start)
          ? opts.start
          : settings.value.bedtimeStart,
      bedtimeEnd:
        opts.end && HM_RE.test(opts.end)
          ? opts.end
          : settings.value.bedtimeEnd,
    }
    save(settings.value)
  }

  function scheduleNext(payload: { title: string; body: string }): void {
    clearTimer()
    if (!settings.value.enabled) return
    if (permission.value !== 'granted') return

    const baseMs = settings.value.gapMinutes * 60_000
    const fireAt = new Date(Date.now() + baseMs)

    let ms = baseMs
    if (
      settings.value.bedtimeEnabled &&
      isInBedtime(
        fireAt,
        settings.value.bedtimeStart,
        settings.value.bedtimeEnd
      )
    ) {
      // Reschedule for the moment bedtime ends instead of firing now.
      ms = nextOccurrenceAt(settings.value.bedtimeEnd).getTime() - Date.now()
    }

    timerId = setTimeout(() => {
      // One last guard in case the user crosses into bedtime between
      // scheduling and firing.
      if (
        !settings.value.bedtimeEnabled ||
        !isInBedtime(
          new Date(),
          settings.value.bedtimeStart,
          settings.value.bedtimeEnd
        )
      ) {
        void showNotification(payload.title, payload.body)
      }
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
        dir: localeDir(),
        lang: currentLocale.value,
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
          dir: localeDir(),
          lang: currentLocale.value,
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
    setNotificationLocale,
    setBedtime,
    scheduleNext,
    sendTest,
    cancel,
  }
}
