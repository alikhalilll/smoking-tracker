import Dexie, { type Table } from 'dexie'
import type { SmokeEntry } from './types'

export interface TombstoneRow {
  id: string
}

export interface MetaRow<T = unknown> {
  key: string
  value: T
}

/**
 * Single Dexie database that backs every piece of persisted app state
 * except the Supabase auth session (which lives in cookies+localStorage
 * behind supabase-js's sync-ish storage adapter).
 *
 * Tables:
 *   entries    — per-row event log; primary key = id (client UUID).
 *                Indexes support the two hot query shapes: mode-scoped
 *                history queries (`[type+date]`, used by deleteDay) and
 *                the "unsynced only" filter that the sync pusher runs
 *                every push cycle (`synced`).
 *   tombstones — deleted-entry ids awaiting server sync. Replaces the
 *                inline `deletedIds` array that used to live inside the
 *                AppData blob.
 *   meta       — key/value bag for singleton scalars: app-data-meta
 *                (startDate/quitPlan/quitPlanClearedAt), each per-device
 *                setting, and the one-time migration flag.
 */
export class SmokingTrackerDB extends Dexie {
  entries!: Table<SmokeEntry, string>
  tombstones!: Table<TombstoneRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('SmokingTrackerDB')
    this.version(1).stores({
      entries: '&id, [type+date], synced, time',
      tombstones: '&id',
      meta: '&key',
    })
  }
}

export const db = new SmokingTrackerDB()

/** Meta keys used across the app. Centralized so a typo in one module
 *  can't silently disagree with the writer in another. */
export const META = {
  migrationV1: 'migration-v1',
  appDataMeta: 'app-data-meta',
  settingsTheme: 'settings-theme',
  settingsLocale: 'settings-locale',
  settingsActiveMode: 'settings-active-mode',
  settingsReminders: 'settings-reminders',
  settingsEconomy: 'settings-economy',
  settingsLeaderboardPrefs: 'settings-leaderboard-prefs',
  settingsHapticsEnabled: 'settings-haptics-enabled',
  settingsOnboardingCompleted: 'settings-onboarding-completed',
  settingsUpdatedAt: 'settings-updated-at',
} as const

let openPromise: Promise<boolean> | null = null

/**
 * Idempotent open. Safari private mode used to throw on IDB access,
 * and quota-exhausted origins can throw QuotaExceededError. We swallow
 * failures so `hydrateAll` can fall back to in-memory defaults instead
 * of preventing the app from mounting.
 */
export function ensureDbOpen(): Promise<boolean> {
  if (openPromise) return openPromise
  openPromise = db
    .open()
    .then(() => true)
    .catch((err) => {
      console.error('[db] open failed — persistence disabled:', err)
      return false
    })
  return openPromise
}

/**
 * Convenience helpers for the meta KV bag. Callers care about the
 * value shape, not the row envelope.
 */
export async function metaGet<T>(key: string): Promise<T | undefined> {
  try {
    const row = await db.meta.get(key)
    return row?.value as T | undefined
  } catch (err) {
    console.error('[db] meta get failed for', key, err)
    return undefined
  }
}

export async function metaPut<T>(key: string, value: T): Promise<void> {
  try {
    await db.meta.put({ key, value })
  } catch (err) {
    console.error('[db] meta put failed for', key, err)
  }
}

export async function metaDelete(key: string): Promise<void> {
  try {
    await db.meta.delete(key)
  } catch (err) {
    console.error('[db] meta delete failed for', key, err)
  }
}
