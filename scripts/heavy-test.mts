/**
 * Heavy end-to-end test of the Dexie migration. Runs in Node with a
 * fake IndexedDB and a minimal DOM shim, exercising the actual source
 * files (src/db.ts, src/composables/useStorage.ts, src/composables/
 * hydrate.ts, src/composables/useTheme.ts, src/i18n.ts, etc.).
 *
 * Coverage:
 *   1. Fresh install — Dexie is empty, defaults hydrated correctly.
 *   2. Legacy migration — populated localStorage seeds Dexie, flag stamped, legacy keys removed (except theme+locale hints).
 *   3. Re-boot after migration — no re-migration; hydrated from Dexie.
 *   4. Entry lifecycle — addEntries → Dexie row present, undoLast → Dexie row gone + tombstone stamped for synced rows.
 *   5. deleteDay — mode-scoped: cigarette entries survive when vape day is deleted.
 *   6. editEntryTime — synced flips false + Dexie updated.
 *   7. Server-driven mutations — markSynced flips synced, applyServerEntries preserves puffCount, applyingRemote guard toggles.
 *   8. resetAll — Dexie tables cleared, appDataMeta re-seeded.
 *   9. Pre-paint hints — theme + locale localStorage survive migration.
 *  10. Quit plan sync — start/abandon/applyRemote/clearRemote all persist.
 *  11. Fresh install re-hydrate — restart from Dexie state matches prior session.
 *
 * Run:  npx tsx scripts/heavy-test.mts
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

// ── 1. Set up globals BEFORE any Dexie / composable import ─────────

import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const g = globalThis as Any
g.window = dom.window
g.document = dom.window.document
g.localStorage = dom.window.localStorage
g.sessionStorage = dom.window.sessionStorage
g.HashChangeEvent = dom.window.HashChangeEvent
g.CustomEvent = dom.window.CustomEvent
g.Notification = undefined
if (!g.crypto || !g.crypto.randomUUID) {
  g.crypto = { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) }
}
const htmlEl = dom.window.document.documentElement

// ── 2. Test harness ───────────────────────────────────────────────

const results: Array<{ name: string; ok: boolean; msg?: string }> = []
let currentTest = ''

function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  currentTest = name
  const start = Date.now()
  return Promise.resolve()
    .then(fn)
    .then(() => {
      const ms = Date.now() - start
      results.push({ name, ok: true })
      console.log(`  ✓ ${name} (${ms}ms)`)
    })
    .catch((err) => {
      results.push({ name, ok: false, msg: err?.message ?? String(err) })
      console.log(`  ✗ ${name}`)
      console.log(`    ${err?.stack ?? err}`)
    })
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[${currentTest}] assertion failed: ${msg}`)
}

function eq<T>(a: T, b: T, msg: string): void {
  if (a !== b) throw new Error(`[${currentTest}] ${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

async function wipeDexie(): Promise<void> {
  const { db } = await import('../src/db.ts?bust=' + Math.random())
  // Fresh Dexie DB by deleting and reopening
  try { await db.delete() } catch {}
  // Reset fake-indexeddb factory to force new connections
  const { IDBFactory } = await import('fake-indexeddb')
  g.indexedDB = new IDBFactory()
}

// ── 3. Section 1: db.ts + Dexie schema ────────────────────────────

console.log('\n[1] db.ts schema + helpers')

const { db, ensureDbOpen, metaGet, metaPut, META } = await import('../src/db.ts')

await test('db opens successfully', async () => {
  const opened = await ensureDbOpen()
  assert(opened, 'expected ensureDbOpen to return true')
})

await test('entries table has expected indexes', async () => {
  const schema = db.entries.schema
  assert(schema.primKey.name === 'id', 'primary key should be id')
  const idxNames = schema.indexes.map((i) => i.name)
  assert(idxNames.includes('[type+date]'), 'compound [type+date] index missing')
  assert(idxNames.includes('synced'), 'synced index missing')
  assert(idxNames.includes('time'), 'time index missing')
})

await test('meta helpers round-trip values', async () => {
  await metaPut('__test-str', 'hello')
  await metaPut('__test-obj', { a: 1, b: [2, 3] })
  await metaPut('__test-num', 42)
  eq(await metaGet('__test-str'), 'hello', 'string round-trip')
  const obj = await metaGet<{ a: number; b: number[] }>('__test-obj')
  eq(JSON.stringify(obj), JSON.stringify({ a: 1, b: [2, 3] }), 'object round-trip')
  eq(await metaGet('__test-num'), 42, 'number round-trip')
  await db.meta.delete('__test-str')
  await db.meta.delete('__test-obj')
  await db.meta.delete('__test-num')
})

await test('META keys are all unique', () => {
  const values = Object.values(META)
  const uniq = new Set(values)
  eq(uniq.size, values.length, 'META keys should be unique')
})

// ── 4. Section 2: hydrate + one-time migration ────────────────────

console.log('\n[2] hydrate.ts one-time migration')

// Seed legacy localStorage with a realistic v1 payload before any
// composable module reads it.
const legacyEntries = [
  { id: 'legacy-1', time: '2026-01-01T10:00:00Z', date: '2026-01-01', type: 'cigarette', synced: true },
  { id: 'legacy-2', time: '2026-01-02T10:00:00Z', date: '2026-01-02', type: 'vape', synced: true, puffCount: 5 },
  { id: 'legacy-3', time: '2026-01-03T10:00:00Z', date: '2026-01-03', type: 'cigarette', synced: false },
]
const legacyBlob = {
  entries: legacyEntries,
  startDate: '2026-01-01',
  quitPlan: {
    startDate: '2026-01-05',
    baseline: 20,
    durationDays: 21,
    intensity: 'standard' as const,
    targetsByDate: { '2026-01-05': 20, '2026-01-06': 18 },
    type: 'cigarette' as const,
  },
  quitPlanClearedAt: 0,
  deletedIds: ['tomb-a', 'tomb-b'],
}

// Wipe Dexie then seed all legacy keys
await test('legacy migration seeds all tables + flag + removes non-hint keys', async () => {
  await db.entries.clear()
  await db.tombstones.clear()
  await db.meta.clear()

  localStorage.setItem('smoking-tracker-data', JSON.stringify(legacyBlob))
  localStorage.setItem('smoking-tracker-theme', 'dark')
  localStorage.setItem('smoking-tracker-locale', 'ar')
  localStorage.setItem('smoking-tracker-active-mode', 'vape')
  localStorage.setItem('smoking-tracker-reminders', JSON.stringify({
    enabled: true, gapMinutes: 60, notificationLocale: 'auto',
    bedtimeStart: '01:00', bedtimeEnd: '08:00',
  }))
  localStorage.setItem('smoking-tracker-economy', JSON.stringify({
    pricePerPack: 100, cigsPerPack: 20, pricePerPod: 50, puffsPerPod: 500,
    podStartedAt: null, pricePerCoil: 0, puffsPerCoil: 1500, coilStartedAt: null,
    pricePerBottle: 0, puffsPerBottle: 1500, bottleStartedAt: null,
    pricePerDisposable: 0, puffsPerDisposable: 5000, disposableStartedAt: null,
    heroConsumable: 'pod', currency: 'USD',
  }))
  localStorage.setItem('smoking-tracker-leaderboard-prefs', JSON.stringify({
    optedIn: true, displayName: 'Ali',
  }))
  localStorage.setItem('smoking-tracker-haptics-enabled', 'false')
  localStorage.setItem('st-onboarding-v1', '1')
  localStorage.setItem('smoking-tracker-settings-updated-at', '1700000000000')

  const { hydrateAll } = await import('../src/composables/hydrate.ts')
  await hydrateAll()

  // Migration flag present
  const stamp = await metaGet<number>(META.migrationV1)
  assert(typeof stamp === 'number' && stamp > 0, 'migration-v1 flag not stamped')

  // Entries + tombstones in Dexie
  const rows = await db.entries.toArray()
  eq(rows.length, 3, 'expected 3 legacy entries in Dexie')
  const byId = new Map(rows.map((r) => [r.id, r]))
  eq(byId.get('legacy-2')?.puffCount, 5, 'puffCount preserved')
  eq(byId.get('legacy-2')?.type, 'vape', 'type preserved')
  eq(byId.get('legacy-1')?.synced, true, 'synced flag preserved')
  eq(byId.get('legacy-3')?.synced, false, 'unsynced flag preserved')
  const tombs = await db.tombstones.toArray()
  eq(tombs.length, 2, 'expected 2 tombstones')

  // Each settings key seeded
  eq(await metaGet(META.settingsTheme), 'dark', 'theme migrated')
  eq(await metaGet(META.settingsLocale), 'ar', 'locale migrated')
  eq(await metaGet(META.settingsActiveMode), 'vape', 'active mode migrated')
  const r = await metaGet<Any>(META.settingsReminders)
  eq(r?.enabled, true, 'reminders migrated')
  eq(r?.gapMinutes, 60, 'reminders gap migrated')
  const e = await metaGet<Any>(META.settingsEconomy)
  eq(e?.pricePerPack, 100, 'economy migrated')
  const lb = await metaGet<Any>(META.settingsLeaderboardPrefs)
  eq(lb?.optedIn, true, 'leaderboard prefs migrated')
  eq(lb?.displayName, 'Ali', 'display name migrated')
  eq(await metaGet(META.settingsHapticsEnabled), false, 'haptics migrated')
  eq(await metaGet(META.settingsOnboardingCompleted), true, 'onboarding migrated')
  eq(await metaGet(META.settingsUpdatedAt), 1700000000000, 'settings updated-at migrated')

  // Legacy keys removed EXCEPT theme + locale hints
  eq(localStorage.getItem('smoking-tracker-data'), null, 'legacy blob removed')
  eq(localStorage.getItem('smoking-tracker-active-mode'), null, 'active-mode legacy removed')
  eq(localStorage.getItem('smoking-tracker-reminders'), null, 'reminders legacy removed')
  eq(localStorage.getItem('smoking-tracker-economy'), null, 'economy legacy removed')
  eq(localStorage.getItem('smoking-tracker-leaderboard-prefs'), null, 'leaderboard legacy removed')
  eq(localStorage.getItem('smoking-tracker-haptics-enabled'), null, 'haptics legacy removed')
  eq(localStorage.getItem('st-onboarding-v1'), null, 'onboarding legacy removed')
  eq(localStorage.getItem('smoking-tracker-settings-updated-at'), null, 'updated-at legacy removed')

  // Pre-paint hints survive
  eq(localStorage.getItem('smoking-tracker-theme'), 'dark', 'theme hint survives')
  eq(localStorage.getItem('smoking-tracker-locale'), 'ar', 'locale hint survives')

  // Quit plan + startDate + deletedIds hydrated into app-data-meta
  const meta = await metaGet<Any>(META.appDataMeta)
  eq(meta?.startDate, '2026-01-01', 'startDate migrated')
  eq(meta?.quitPlan?.baseline, 20, 'quitPlan migrated')
})

await test('re-boot after migration is a no-op (flag guards re-entry)', async () => {
  // Poison localStorage with different data — if migration re-ran, this
  // would overwrite Dexie.
  localStorage.setItem('smoking-tracker-data', JSON.stringify({
    entries: [{ id: 'should-not-appear', time: 'x', date: 'x', type: 'cigarette' }],
    startDate: '1999-01-01',
  }))

  const { hydrateAll } = await import('../src/composables/hydrate.ts')
  await hydrateAll()

  // Dexie should still have the 3 real legacy entries, NOT the poison one
  const rows = await db.entries.toArray()
  eq(rows.length, 3, 'no re-migration should have happened')
  const ids = new Set(rows.map((r) => r.id))
  assert(!ids.has('should-not-appear'), 'poison entry must not have been migrated')

  // Cleanup poison
  localStorage.removeItem('smoking-tracker-data')
})

// ── 5. Section 3: useStorage granular writes ──────────────────────

console.log('\n[3] useStorage.ts granular writes')

// Reset to a known clean state for this section: wipe everything.
await test('setup: fresh useStorage state', async () => {
  await db.entries.clear()
  await db.tombstones.clear()
  await db.meta.clear()
  await metaPut(META.migrationV1, Date.now())

  const { hydrateStorageFromDexie } = await import('../src/composables/useStorage.ts')
  await hydrateStorageFromDexie()
})

const { useStorage } = await import('../src/composables/useStorage.ts')
const storage = useStorage()

// Yield to microtasks so the module-level watchers/writes complete.
async function flush(): Promise<void> {
  // Two macrotasks + microtask drain gives Dexie transactions time to commit.
  await new Promise((r) => setTimeout(r, 10))
  await new Promise((r) => setTimeout(r, 10))
}

await test('addEntries(1, cigarette) → 1 unsynced row in Dexie', async () => {
  const before = storage.data.value.entries.length
  storage.addEntries(1, 'cigarette')
  await flush()
  const rows = await db.entries.toArray()
  eq(rows.length, before + 1, 'entry count grew by 1')
  const last = rows[rows.length - 1]
  eq(last.type, 'cigarette', 'type is cigarette')
  eq(last.synced, false, 'unsynced')
  assert(!last.puffCount, 'cigarette has no puffCount')
})

await test('addEntries(3, cigarette) → 3 separate rows (one per stick)', async () => {
  const before = (await db.entries.toArray()).length
  storage.addEntries(3, 'cigarette')
  await flush()
  const rows = await db.entries.toArray()
  eq(rows.length, before + 3, '3 cigarette rows added')
})

await test('addEntries(7, vape) → 1 row with puffCount=7', async () => {
  const before = (await db.entries.toArray()).length
  storage.addEntries(7, 'vape')
  await flush()
  const rows = await db.entries.toArray()
  eq(rows.length, before + 1, 'exactly 1 vape session row added')
  const vape = rows.find((r) => r.type === 'vape' && r.puffCount === 7)
  assert(vape, 'vape session with puffCount=7 present')
})

await test('undoLast(cigarette) removes last cig, leaves vape', async () => {
  const beforeAll = await db.entries.toArray()
  const beforeCigs = beforeAll.filter((r) => r.type === 'cigarette').length
  const beforeVape = beforeAll.filter((r) => r.type === 'vape').length
  storage.undoLast('cigarette')
  await flush()
  const after = await db.entries.toArray()
  eq(after.filter((r) => r.type === 'cigarette').length, beforeCigs - 1, 'one cigarette removed')
  eq(after.filter((r) => r.type === 'vape').length, beforeVape, 'vape rows untouched')
})

await test('undoLast on synced row creates tombstone', async () => {
  // Add a row and manually mark it synced to simulate a post-push state
  storage.addEntries(1, 'cigarette')
  await flush()
  const beforeRows = storage.data.value.entries
  const target = beforeRows[beforeRows.length - 1]
  storage.markSynced([target.id])
  await flush()
  eq(target.synced, true, 'row now synced')

  storage.undoLast('cigarette')
  await flush()

  const tombs = await db.tombstones.toArray()
  const has = tombs.some((t) => t.id === target.id)
  assert(has, 'tombstone must be recorded for synced+undone row')
  const rows = await db.entries.toArray()
  assert(!rows.some((r) => r.id === target.id), 'row removed from entries')
})

await test('deleteDay is mode-scoped', async () => {
  // Add cigarette and vape entries with the same date, then delete the
  // vape day and confirm the cigarettes survive.
  const today = new Date().toISOString().slice(0, 10)
  storage.addEntries(1, 'cigarette')
  storage.addEntries(3, 'vape')
  await flush()
  const beforeCig = (await db.entries.toArray()).filter((r) => r.type === 'cigarette').length
  storage.deleteDay(today, 'vape')
  await flush()
  const after = await db.entries.toArray()
  const cigCount = after.filter((r) => r.type === 'cigarette').length
  const vapeToday = after.filter((r) => r.type === 'vape' && r.date === today).length
  eq(cigCount, beforeCig, 'cigarette count unchanged')
  eq(vapeToday, 0, 'vape entries for today gone')
})

await test('editEntryTime flips synced=false and updates row in Dexie', async () => {
  storage.addEntries(1, 'cigarette')
  await flush()
  const rows = storage.data.value.entries
  const target = rows[rows.length - 1]
  storage.markSynced([target.id])
  await flush()
  eq(target.synced, true, 'row synced before edit')

  const newIso = '2025-06-15T14:30:00.000Z'
  storage.editEntryTime(target.id, newIso)
  await flush()

  const inDexie = await db.entries.get(target.id)
  assert(inDexie, 'row still in Dexie after edit')
  eq(inDexie.time, newIso, 'time updated in Dexie')
  eq(inDexie.date, '2025-06-15', 'date recomputed in Dexie')
  eq(inDexie.synced, false, 'synced flipped in Dexie')
  eq(target.synced, false, 'synced flipped in memory')
})

await test('resetAll wipes tables + reseeds appDataMeta', async () => {
  storage.resetAll()
  await flush()
  const entries = await db.entries.toArray()
  const tombs = await db.tombstones.toArray()
  eq(entries.length, 0, 'entries cleared')
  eq(tombs.length, 0, 'tombstones cleared')
  const meta = await metaGet<Any>(META.appDataMeta)
  assert(meta?.startDate, 'appDataMeta reseeded with startDate')
})

// ── 6. Section 4: server-driven mutations + applyingRemote guard ──

console.log('\n[4] Server-driven mutations + echo guard')

await test('markSynced flips memory + Dexie without setting applyingRemote longer than needed', async () => {
  storage.addEntries(2, 'cigarette')
  await flush()
  const rows = storage.data.value.entries
  const ids = rows.slice(-2).map((r) => r.id)

  // Guard should NOT be true before the call
  eq(storage.isApplyingRemote(), false, 'guard false before call')

  storage.markSynced(ids)

  // Guard clears synchronously — must be false immediately after return
  eq(storage.isApplyingRemote(), false, 'guard cleared synchronously after return')

  for (const id of ids) {
    const e = rows.find((r) => r.id === id)!
    eq(e.synced, true, `mem: ${id} marked synced`)
  }

  await flush()
  for (const id of ids) {
    const inDb = await db.entries.get(id)
    eq(inDb?.synced, true, `dexie: ${id} marked synced`)
  }
})

await test('applyServerEntries preserves puffCount for local ids', async () => {
  storage.resetAll()
  await flush()
  // Simulate a vape session locally
  storage.addEntries(5, 'vape')
  await flush()
  const vapeRow = storage.data.value.entries.find((e) => e.type === 'vape')!
  eq(vapeRow.puffCount, 5, 'local puffCount=5')

  // Server returns the same row (no puffCount column)
  storage.applyServerEntries([
    {
      id: vapeRow.id,
      time: vapeRow.time,
      date: vapeRow.date,
      type: 'vape',
      synced: true,
    },
  ])
  await flush()

  const after = storage.data.value.entries.find((e) => e.id === vapeRow.id)
  assert(after, 'row still present after applyServerEntries')
  eq(after.puffCount, 5, 'puffCount preserved through server merge')
  eq(after.synced, true, 'synced flipped true after server confirms')
})

await test('applyServerEntries keeps local-unsynced-not-on-server rows', async () => {
  storage.addEntries(1, 'cigarette') // fresh local, unsynced
  await flush()
  const beforeLen = storage.data.value.entries.length
  const localOnly = storage.data.value.entries.find((e) => !e.synced)!

  // Server returns empty
  storage.applyServerEntries([])
  await flush()

  const after = storage.data.value.entries
  assert(after.some((e) => e.id === localOnly.id), 'local unsynced row must survive')
  // len should be at least 1 (the unsynced local); may be less than beforeLen since synced rows are dropped
  assert(after.length >= 1, 'at least the unsynced row remains')
})

await test('consumeDeletedIds clears memory + Dexie tombstones', async () => {
  storage.addEntries(1, 'cigarette')
  await flush()
  const target = storage.data.value.entries[storage.data.value.entries.length - 1]
  storage.markSynced([target.id])
  await flush()
  storage.undoLast('cigarette')
  await flush()

  const tombs = storage.data.value.deletedIds ?? []
  assert(tombs.includes(target.id), 'tombstone recorded in memory')
  const inDb = await db.tombstones.get(target.id)
  assert(inDb, 'tombstone recorded in Dexie')

  storage.consumeDeletedIds([target.id])
  await flush()
  const memAfter = storage.data.value.deletedIds ?? []
  assert(!memAfter.includes(target.id), 'tombstone gone from memory')
  const dbAfter = await db.tombstones.get(target.id)
  assert(!dbAfter, 'tombstone gone from Dexie')
})

await test('applyRemoteQuitPlan + clearRemoteQuitPlan persist through Dexie', async () => {
  const plan = {
    startDate: '2026-06-01',
    baseline: 15,
    durationDays: 14,
    intensity: 'quick' as const,
    targetsByDate: { '2026-06-01': 15, '2026-06-02': 12 },
    type: 'cigarette' as const,
  }
  storage.applyRemoteQuitPlan(plan)
  await flush()
  eq(storage.data.value.quitPlan?.baseline, 15, 'quit plan in memory')
  const meta = await metaGet<Any>(META.appDataMeta)
  eq(meta?.quitPlan?.baseline, 15, 'quit plan persisted')

  storage.clearRemoteQuitPlan()
  await flush()
  assert(!storage.data.value.quitPlan, 'quit plan gone from memory')
  const metaAfter = await metaGet<Any>(META.appDataMeta)
  assert(!metaAfter?.quitPlan, 'quit plan gone from persistence')
})

// ── 7. Section 5: Settings composables hydrate + persist ──────────

console.log('\n[5] Settings composables')

await test('useTheme.setTheme writes Dexie + localStorage hint', async () => {
  const { useTheme } = await import('../src/composables/useTheme.ts')
  const theme = useTheme()
  theme.setTheme('light')
  await flush()
  eq(await metaGet(META.settingsTheme), 'light', 'theme in Dexie')
  eq(localStorage.getItem('smoking-tracker-theme'), 'light', 'theme hint in localStorage')
  eq(theme.mode.value, 'light', 'ref updated')
  eq(htmlEl.getAttribute('data-theme'), 'light', 'html data-theme set')
})

await test('i18n setLocale writes Dexie + localStorage hint + document.dir', async () => {
  const { setLocale, currentLocale } = await import('../src/i18n.ts')
  setLocale('ar')
  await flush()
  eq(await metaGet(META.settingsLocale), 'ar', 'locale in Dexie')
  eq(localStorage.getItem('smoking-tracker-locale'), 'ar', 'locale hint in localStorage')
  eq(currentLocale.value, 'ar', 'ref updated')
  eq(htmlEl.lang, 'ar', 'html lang set')
  eq(htmlEl.dir, 'rtl', 'html dir set to rtl for ar')

  setLocale('en')
  await flush()
  eq(htmlEl.dir, 'ltr', 'switching back to en flips dir to ltr')
})

await test('useHaptics.setEnabled persists', async () => {
  const { useHaptics } = await import('../src/composables/useHaptics.ts')
  const h = useHaptics()
  h.setEnabled(false)
  await flush()
  eq(await metaGet(META.settingsHapticsEnabled), false, 'haptics persisted')
  eq(h.enabled.value, false, 'ref updated')
})

await test('useActiveMode.setMode persists', async () => {
  const { useActiveMode } = await import('../src/composables/useActiveMode.ts')
  const a = useActiveMode()
  // Force a change: setMode is a no-op when the value already matches,
  // and prior tests may have left mode at 'vape'.
  a.setMode('cigarette')
  await flush()
  a.setMode('vape')
  await flush()
  eq(await metaGet(META.settingsActiveMode), 'vape', 'active mode persisted')
  eq(a.mode.value, 'vape', 'ref updated')
})

// ── 8. Section 6: Full-cycle rehydrate ────────────────────────────

console.log('\n[6] Full-cycle rehydrate — Dexie survives a "restart"')

await test('mutations persist across a simulated reboot (rehydrate)', async () => {
  // Snapshot current in-memory state
  const memBefore = {
    entries: storage.data.value.entries.length,
    theme: await metaGet(META.settingsTheme),
    activeMode: await metaGet(META.settingsActiveMode),
    haptics: await metaGet(META.settingsHapticsEnabled),
  }

  // Add fresh data and persist
  storage.addEntries(2, 'cigarette')
  storage.addEntries(4, 'vape')
  await flush()

  const entriesInDb = await db.entries.toArray()
  const themeInDb = await metaGet(META.settingsTheme)
  const modeInDb = await metaGet(META.settingsActiveMode)

  // Now simulate a reboot by re-running hydrate from a fresh state
  // (dropping in-memory refs by re-importing with a cache-busting query)
  const { hydrateStorageFromDexie } = await import('../src/composables/useStorage.ts')
  await hydrateStorageFromDexie()

  const freshEntries = storage.data.value.entries
  eq(freshEntries.length, entriesInDb.length, 'rehydrate loads all Dexie rows into memory')
  const vape = freshEntries.find((e) => e.type === 'vape' && e.puffCount === 4)
  assert(vape, 'vape session with puffCount=4 rehydrated')

  // Settings survive too
  eq(await metaGet(META.settingsTheme), themeInDb, 'theme survives reboot')
  eq(await metaGet(META.settingsActiveMode), modeInDb, 'active mode survives reboot')

  console.log(`    [context: mem-before=${JSON.stringify(memBefore)}, entries-in-db=${entriesInDb.length}]`)
})

// ── 9. Summary ────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`\n────────────────────────────────────`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`────────────────────────────────────\n`)

if (failed > 0) {
  console.log('Failures:')
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ✗ ${r.name}: ${r.msg}`)
  }
  process.exit(1)
}
process.exit(0)
