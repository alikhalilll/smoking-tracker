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

function showNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  if (permission.value !== 'granted') return
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.serviceWorker?.controller
    ) {
      navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification(title, {
            body,
            icon: '/smoking-tracker/icon-192.png',
            badge: '/smoking-tracker/icon-192.png',
            tag: 'smoke-reminder',
          })
        )
        .catch(() => {
          new Notification(title, { body, icon: '/smoking-tracker/icon-192.png', tag: 'smoke-reminder' })
        })
    } else {
      new Notification(title, { body, icon: '/smoking-tracker/icon-192.png', tag: 'smoke-reminder' })
    }
  } catch {
    // ignore notification errors
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
      showNotification(payload.title, payload.body)
      // Re-arm so reminders continue while the app is open.
      scheduleNext(payload)
    }, ms)
  }

  function cancel(): void {
    clearTimer()
  }

  return {
    settings,
    permission,
    requestPermission,
    setEnabled,
    setGap,
    scheduleNext,
    cancel,
  }
}
