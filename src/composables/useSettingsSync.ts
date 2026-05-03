import { ref, watch, type Ref } from 'vue'
import { supabase } from '../supabase'
import { useAuth } from './useAuth'
import { useTheme, type ThemeMode } from './useTheme'
import { useReminders, type ReminderSettings } from './useReminders'
import { useEconomy, type EconomySettings } from './useEconomy'
import { useHaptics } from './useHaptics'
import {
  currentLocale,
  applyRemoteLocale,
  type Locale,
} from '../i18n'

export type SettingsSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline'

interface SyncedSettings {
  theme: ThemeMode
  locale: Locale
  reminders: ReminderSettings
  economy?: EconomySettings
  hapticsEnabled?: boolean
}

interface ServerRow {
  user_id: string
  settings: SyncedSettings
  updated_at: string
}

/** ms-resolution timestamp of the last LOCAL settings edit on this device.
 *  Used to decide whether the server snapshot is newer than ours. */
const LOCAL_UPDATED_KEY = 'smoking-tracker-settings-updated-at'

function readLocalUpdatedAt(): number {
  try {
    const raw = localStorage.getItem(LOCAL_UPDATED_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeLocalUpdatedAt(ms: number): void {
  try {
    localStorage.setItem(LOCAL_UPDATED_KEY, String(ms))
  } catch {
    // ignore
  }
}

export interface UseSettingsSync {
  status: Ref<SettingsSyncStatus>
  lastError: Ref<string | null>
  syncNow: () => Promise<void>
}

export function useSettingsSync(): UseSettingsSync {
  const { isAuthed, user } = useAuth()
  const theme = useTheme()
  const reminders = useReminders()
  const economy = useEconomy()
  const haptics = useHaptics()

  const status: Ref<SettingsSyncStatus> = ref('idle')
  const lastError: Ref<string | null> = ref(null)

  // Suppress the local watcher while we apply server snapshots, so we
  // don't immediately push them right back up.
  let applyingRemote = false
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  function setStatus(s: SettingsSyncStatus, err?: string): void {
    status.value = s
    if (err !== undefined) lastError.value = err
  }

  function snapshot(): SyncedSettings {
    return {
      theme: theme.mode.value,
      locale: currentLocale.value,
      reminders: { ...reminders.settings.value },
      economy: { ...economy.settings.value },
      hapticsEnabled: haptics.enabled.value,
    }
  }

  function applySnapshot(s: SyncedSettings): void {
    applyingRemote = true
    try {
      if (s.theme === 'system' || s.theme === 'light' || s.theme === 'dark') {
        theme.applyRemote(s.theme)
      }
      if (s.locale === 'en' || s.locale === 'ar') {
        applyRemoteLocale(s.locale)
      }
      if (s.reminders && typeof s.reminders === 'object') {
        reminders.applyRemote(s.reminders)
      }
      if (s.economy && typeof s.economy === 'object') {
        economy.applyRemote(s.economy)
      }
      if (typeof s.hapticsEnabled === 'boolean') {
        haptics.applyRemote(s.hapticsEnabled)
      }
    } finally {
      applyingRemote = false
    }
  }

  async function pull(): Promise<void> {
    if (!supabase || !user.value) return
    setStatus('syncing')

    const { data: row, error } = await supabase
      .from('user_settings')
      .select('user_id, settings, updated_at')
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (error) {
      setStatus('error', error.message)
      return
    }

    if (!row) {
      // No server row yet — seed it from the local state. This is the
      // first sign-in on the user's first device.
      await pushNow()
      return
    }

    const server = row as ServerRow
    const serverMs = new Date(server.updated_at).getTime()
    const localMs = readLocalUpdatedAt()

    if (serverMs > localMs) {
      applySnapshot(server.settings)
      // Treat the server timestamp as our new local baseline so we
      // don't immediately push back.
      writeLocalUpdatedAt(serverMs)
    } else if (localMs > serverMs) {
      // Local is newer — push our state up.
      await pushNow()
      return
    }
    // Equal: nothing to do.

    setStatus('synced')
  }

  async function pushNow(): Promise<void> {
    if (!supabase || !user.value) return
    setStatus('syncing')
    const now = Date.now()
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.value.id,
      settings: snapshot(),
      updated_at: new Date(now).toISOString(),
    })
    if (error) {
      setStatus('error', error.message)
      return
    }
    writeLocalUpdatedAt(now)
    setStatus('synced')
  }

  // Initial pull whenever the user becomes authed.
  watch(
    isAuthed,
    async (authed) => {
      if (!authed) {
        setStatus('idle')
        return
      }
      await pull().catch((err) => setStatus('error', String(err)))
    },
    { immediate: true }
  )

  // Debounced push on any local settings change.
  // flush: 'sync' is critical — applySnapshot() mutates these refs and
  // resets `applyingRemote` in the same synchronous block. The default
  // 'pre' flush would run the watcher *after* the guard cleared, causing
  // every pull to ping-pong an immediate push back to the server.
  watch(
    [
      () => theme.mode.value,
      currentLocale,
      () => reminders.settings.value,
      () => economy.settings.value,
      () => haptics.enabled.value,
    ],
    () => {
      if (applyingRemote) return
      // Stamp the local mutation time *now* so a pull racing with our
      // push still sees that we have unsaved local edits.
      writeLocalUpdatedAt(Date.now())
      if (!isAuthed.value) return
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void pushNow().catch((err) => setStatus('error', String(err)))
      }, 800)
    },
    { deep: true, flush: 'sync' }
  )

  // Background triggers — same shape as useSync so settings stay fresh
  // without the user pressing anything.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (isAuthed.value) void pull()
    })
    window.addEventListener('offline', () => {
      if (status.value !== 'idle') setStatus('offline')
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isAuthed.value) {
        void pull()
      }
    })

    // Settings change much less often than entries, so a slower poll is
    // plenty. 5 minutes keeps the second device reasonably fresh
    // without burning request quota.
    const POLL_MS = 5 * 60_000
    setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!isAuthed.value) return
      void pull()
    }, POLL_MS)
  }

  async function syncNow(): Promise<void> {
    await pull()
  }

  return { status, lastError, syncNow }
}
