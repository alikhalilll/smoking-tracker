import type { AppData, EntryType, QuitPlan, SmokeEntry } from '../types'
import type { EconomySettings } from './useEconomy'
import type { ReminderSettings } from './useReminders'
import type { ThemeMode } from './useTheme'
import type { LeaderboardPrefs } from './useLeaderboard'
import type { Locale } from '../i18n'
import { db, ensureDbOpen, META, metaGet, metaPut } from '../db'
import { hydrateStorageFromDexie } from './useStorage'
import { hydrateThemeFromDexie } from './useTheme'
import { hydrateLocaleFromDexie } from '../i18n'
import { hydrateActiveModeFromDexie } from './useActiveMode'
import { hydrateRemindersFromDexie } from './useReminders'
import { hydrateEconomyFromDexie } from './useEconomy'
import { hydrateLeaderboardPrefsFromDexie } from './useLeaderboard'
import { hydrateHapticsFromDexie } from './useHaptics'
import { hydrateOnboardingFromDexie } from './useOnboarding'
import { hydrateSettingsUpdatedAtFromDexie } from './useSettingsSync'

// ── Legacy localStorage keys owned by v1 (blob per key). Migrated
//    into Dexie once, then deleted so the storage stays clean.
const LEGACY_APP_DATA = 'smoking-tracker-data'
const LEGACY_KEYS = {
  theme: 'smoking-tracker-theme',
  locale: 'smoking-tracker-locale',
  activeMode: 'smoking-tracker-active-mode',
  reminders: 'smoking-tracker-reminders',
  economy: 'smoking-tracker-economy',
  leaderboardPrefs: 'smoking-tracker-leaderboard-prefs',
  hapticsEnabled: 'smoking-tracker-haptics-enabled',
  onboardingCompleted: 'st-onboarding-v1',
  settingsUpdatedAt: 'smoking-tracker-settings-updated-at',
} as const

interface LegacyAppData {
  entries?: Array<Partial<SmokeEntry> & { id?: string; time: string; date: string }>
  startDate?: string
  quitPlan?: QuitPlan
  quitPlanClearedAt?: number
  deletedIds?: string[]
}

function readLegacy(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function removeLegacy(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/**
 * One-time migration: read every legacy localStorage payload into Dexie
 * inside a single transaction, stamp the completion flag inside the
 * same transaction, then (only after commit) delete the legacy keys.
 *
 * Ordering matters: if the tab dies mid-commit, the flag is unset and
 * the legacy data is still in localStorage → next boot retries safely.
 * The only crash window that leaks legacy keys is between commit and
 * removeItem; those orphaned keys are harmless (the flag guards
 * re-entry). Theme + locale hint keys are NEVER removed — they're the
 * synchronous pre-paint hints and must survive.
 */
async function migrateFromLocalStorage(): Promise<void> {
  const legacyBlob = parseJson<LegacyAppData>(readLegacy(LEGACY_APP_DATA))
  const legacyEntries: SmokeEntry[] = []
  if (legacyBlob?.entries) {
    for (const raw of legacyBlob.entries) {
      if (!raw || typeof raw.time !== 'string' || typeof raw.date !== 'string') {
        continue
      }
      legacyEntries.push({
        id: raw.id && typeof raw.id === 'string' ? raw.id : newId(),
        time: raw.time,
        date: raw.date,
        type: (raw.type as EntryType) ?? 'cigarette',
        // Pre-migration data treated as unsynced so the next sync push
        // reconciles it against the server (matches useStorage v1's
        // legacy-migration behavior).
        synced: raw.synced === true,
        ...(typeof raw.puffCount === 'number'
          ? { puffCount: raw.puffCount }
          : {}),
      })
    }
  }
  const tombstones = (legacyBlob?.deletedIds ?? [])
    .filter((id): id is string => typeof id === 'string')
    .map((id) => ({ id }))

  await db.transaction(
    'rw',
    db.entries,
    db.tombstones,
    db.meta,
    async () => {
      if (legacyEntries.length > 0) await db.entries.bulkPut(legacyEntries)
      if (tombstones.length > 0) await db.tombstones.bulkPut(tombstones)

      const appMeta = {
        startDate: legacyBlob?.startDate ?? '',
        ...(legacyBlob?.quitPlan ? { quitPlan: legacyBlob.quitPlan } : {}),
        ...(legacyBlob?.quitPlanClearedAt != null
          ? { quitPlanClearedAt: legacyBlob.quitPlanClearedAt }
          : {}),
      }
      if (appMeta.startDate) {
        await db.meta.put({ key: META.appDataMeta, value: appMeta })
      }

      const theme = readLegacy(LEGACY_KEYS.theme)
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        await db.meta.put({ key: META.settingsTheme, value: theme as ThemeMode })
      }

      const locale = readLegacy(LEGACY_KEYS.locale)
      if (locale === 'en' || locale === 'ar') {
        await db.meta.put({ key: META.settingsLocale, value: locale as Locale })
      }

      const activeMode = readLegacy(LEGACY_KEYS.activeMode)
      if (activeMode === 'cigarette' || activeMode === 'vape') {
        await db.meta.put({
          key: META.settingsActiveMode,
          value: activeMode as EntryType,
        })
      }

      const reminders = parseJson<ReminderSettings>(
        readLegacy(LEGACY_KEYS.reminders)
      )
      if (reminders) {
        await db.meta.put({ key: META.settingsReminders, value: reminders })
      }

      const economy = parseJson<EconomySettings>(
        readLegacy(LEGACY_KEYS.economy)
      )
      if (economy) {
        await db.meta.put({ key: META.settingsEconomy, value: economy })
      }

      const leaderboardPrefs = parseJson<LeaderboardPrefs>(
        readLegacy(LEGACY_KEYS.leaderboardPrefs)
      )
      if (leaderboardPrefs) {
        await db.meta.put({
          key: META.settingsLeaderboardPrefs,
          value: leaderboardPrefs,
        })
      }

      const hapticsRaw = readLegacy(LEGACY_KEYS.hapticsEnabled)
      if (hapticsRaw === 'true' || hapticsRaw === 'false') {
        await db.meta.put({
          key: META.settingsHapticsEnabled,
          value: hapticsRaw === 'true',
        })
      }

      const onboardingRaw = readLegacy(LEGACY_KEYS.onboardingCompleted)
      if (onboardingRaw === '1') {
        await db.meta.put({
          key: META.settingsOnboardingCompleted,
          value: true,
        })
      }

      const updatedAtRaw = readLegacy(LEGACY_KEYS.settingsUpdatedAt)
      const updatedAt = updatedAtRaw ? parseInt(updatedAtRaw, 10) : NaN
      if (Number.isFinite(updatedAt)) {
        await db.meta.put({
          key: META.settingsUpdatedAt,
          value: updatedAt,
        })
      }

      await db.meta.put({ key: META.migrationV1, value: Date.now() })
    }
  )

  // Only after successful commit — theme + locale keys stay (pre-paint
  // hints), everything else goes.
  removeLegacy(LEGACY_APP_DATA)
  removeLegacy(LEGACY_KEYS.activeMode)
  removeLegacy(LEGACY_KEYS.reminders)
  removeLegacy(LEGACY_KEYS.economy)
  removeLegacy(LEGACY_KEYS.leaderboardPrefs)
  removeLegacy(LEGACY_KEYS.hapticsEnabled)
  removeLegacy(LEGACY_KEYS.onboardingCompleted)
  removeLegacy(LEGACY_KEYS.settingsUpdatedAt)
}

async function readAllSettings(): Promise<void> {
  const [
    theme,
    locale,
    activeMode,
    reminders,
    economy,
    leaderboardPrefs,
    haptics,
    onboarding,
    updatedAt,
  ] = await Promise.all([
    metaGet<ThemeMode>(META.settingsTheme),
    metaGet<Locale>(META.settingsLocale),
    metaGet<EntryType>(META.settingsActiveMode),
    metaGet<ReminderSettings>(META.settingsReminders),
    metaGet<EconomySettings>(META.settingsEconomy),
    metaGet<LeaderboardPrefs>(META.settingsLeaderboardPrefs),
    metaGet<boolean>(META.settingsHapticsEnabled),
    metaGet<boolean>(META.settingsOnboardingCompleted),
    metaGet<number>(META.settingsUpdatedAt),
  ])
  hydrateThemeFromDexie(theme)
  hydrateLocaleFromDexie(locale)
  hydrateActiveModeFromDexie(activeMode)
  hydrateRemindersFromDexie(reminders)
  hydrateEconomyFromDexie(economy)
  hydrateLeaderboardPrefsFromDexie(leaderboardPrefs)
  hydrateHapticsFromDexie(haptics)
  hydrateOnboardingFromDexie(onboarding)
  hydrateSettingsUpdatedAtFromDexie(updatedAt)
}

/**
 * Orchestrates the entire boot-time hydration. Called by main.ts
 * before the Vue app mounts. Never throws — a Dexie failure just
 * leaves module-level defaults (and the pre-paint theme/locale hints)
 * in place, and the app still mounts and functions in-memory.
 */
export async function hydrateAll(): Promise<void> {
  const opened = await ensureDbOpen()
  if (!opened) return

  try {
    const migrationStamp = await metaGet<number>(META.migrationV1)
    if (migrationStamp == null) {
      await migrateFromLocalStorage()
    }
  } catch (err) {
    console.error('[hydrate] migration failed:', err)
    // Best-effort stamp so we don't retry every boot. If the migration
    // failed partway, subsequent normal hydration will just read
    // whatever Dexie already has.
    await metaPut(META.migrationV1, Date.now())
  }

  try {
    await Promise.all([hydrateStorageFromDexie(), readAllSettings()])
  } catch (err) {
    console.error('[hydrate] settings/storage hydration failed:', err)
  }
}

// Re-export the AppData shape for consumers who want the same import
// site for both the hydrator and the state shape.
export type { AppData }
