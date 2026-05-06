<template>
  <DrawerRoot
    :open="open"
    direction="right"
    @update:open="(v) => emit('update:open', v)"
  >
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content user-sheet">
        <header class="user-sheet-head">
          <div class="user-sheet-titles">
            <DrawerTitle class="user-sheet-title">
              {{ activity?.account.email || 'User activity' }}
            </DrawerTitle>
            <DrawerDescription class="user-sheet-sub">
              <span v-if="activity">
                Joined {{ formatDate(activity.account.created_at) }}
                <span v-if="activity.account.last_sign_in_at">
                  · Last seen {{ formatRelative(activity.account.last_sign_in_at) }}
                </span>
              </span>
              <span v-else>Loading…</span>
            </DrawerDescription>
          </div>
          <button
            type="button"
            class="btn btn-icon"
            aria-label="Close"
            @click="emit('update:open', false)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        <div v-if="error" class="chip chip-danger user-sheet-error">
          {{ error }}
        </div>

        <div v-if="loading && !activity" class="user-sheet-loading">
          <span class="spinner" /> Loading activity…
        </div>

        <div v-if="activity" class="user-sheet-body">
          <!-- Account chips -->
          <section class="user-section">
            <div class="user-chip-row">
              <span class="chip">
                ID&nbsp;<code class="user-id">{{ activity.account.id.slice(0, 8) }}…</code>
              </span>
              <span
                v-if="activity.account.email_confirmed_at"
                class="chip chip-mint"
              >
                Verified
              </span>
              <span
                v-else
                class="chip chip-warn"
              >
                Unverified
              </span>
              <span
                v-for="p in providers"
                :key="p"
                class="chip chip-brand"
              >
                {{ p }}
              </span>
            </div>
          </section>

          <!-- Plan -->
          <section class="user-section">
            <h3 class="user-section-title">Quit plan</h3>
            <div v-if="activity.plan" class="user-plan">
              <div class="user-plan-meta">
                <span class="chip chip-brand">{{ activity.plan.intensity }}</span>
                <span v-if="activity.plan.is_complete" class="chip chip-mint">
                  Completed
                </span>
                <span v-else class="chip chip-accent">
                  Day {{ Math.max(1, Math.min(activity.plan.day_of_plan, activity.plan.duration_days)) }}
                  / {{ activity.plan.duration_days }}
                </span>
              </div>
              <div class="user-plan-bar">
                <div
                  class="user-plan-bar-fill"
                  :style="{ width: planProgressPct + '%' }"
                />
              </div>
              <div class="user-kpi-grid">
                <div class="user-kpi">
                  <span class="user-kpi-label">Started</span>
                  <span class="user-kpi-value">
                    {{ formatDate(activity.plan.start_date) }}
                  </span>
                </div>
                <div class="user-kpi">
                  <span class="user-kpi-label">Baseline</span>
                  <span class="user-kpi-value">
                    {{ activity.plan.baseline }}/day
                  </span>
                </div>
                <div class="user-kpi">
                  <span class="user-kpi-label">Today's target</span>
                  <span class="user-kpi-value">
                    {{ activity.plan.target_today != null
                       ? formatNum(activity.plan.target_today) + '/day'
                       : '—' }}
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="user-empty">No active plan.</p>
          </section>

          <!-- Smoking activity -->
          <section class="user-section">
            <h3 class="user-section-title">
              Smoking activity
              <span class="user-section-sub">
                · last {{ activity.window_days }} days
              </span>
            </h3>
            <div class="user-kpi-grid">
              <div class="user-kpi">
                <span class="user-kpi-label">Cigarettes in window</span>
                <span class="user-kpi-value">
                  {{ fmtCount(activity.entries.total) }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Last log</span>
                <span class="user-kpi-value">
                  {{ activity.entries.last_log_at
                     ? formatRelative(activity.entries.last_log_at)
                     : '—' }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Daily avg (window)</span>
                <span class="user-kpi-value">
                  {{ formatNum(dailyAvg) }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Peak hour</span>
                <span class="user-kpi-value">
                  {{ peakHourLabel }}
                </span>
              </div>
            </div>

            <div class="user-chart">
              <p class="user-chart-title">Cigarettes per day</p>
              <div class="user-chart-canvas">
                <Line
                  v-if="entriesPerDayData"
                  :data="entriesPerDayData"
                  :options="lineOptions"
                />
                <p v-else class="user-empty">No entries in window.</p>
              </div>
            </div>

            <div class="user-chart">
              <p class="user-chart-title">By hour of day</p>
              <div class="user-chart-canvas">
                <Bar
                  v-if="hourlyData"
                  :data="hourlyData"
                  :options="barOptions"
                />
                <p v-else class="user-empty">No entries in window.</p>
              </div>
            </div>

            <div class="user-chart">
              <p class="user-chart-title">By weekday</p>
              <div class="user-chart-canvas user-chart-canvas-short">
                <Bar
                  v-if="weekdayData"
                  :data="weekdayData"
                  :options="barOptions"
                />
                <p v-else class="user-empty">No entries in window.</p>
              </div>
            </div>
          </section>

          <!-- Footsteps timeline -->
          <section class="user-section">
            <h3 class="user-section-title">
              Footsteps
              <span class="user-section-sub">
                · {{ activity.entries.recent.length }}
                most recent
              </span>
            </h3>
            <ol
              v-if="activity.entries.recent.length"
              class="user-timeline"
            >
              <li
                v-for="(e, idx) in activity.entries.recent"
                :key="e.id"
                class="user-timeline-item"
              >
                <span class="user-timeline-dot" :class="dotTone(idx)" />
                <div class="user-timeline-row">
                  <span class="user-timeline-when">
                    {{ formatDateTime(e.time) }}
                  </span>
                  <span class="user-timeline-rel muted">
                    {{ formatRelative(e.time) }}
                  </span>
                </div>
              </li>
            </ol>
            <p v-else class="user-empty">No cigarettes logged in window.</p>
          </section>

          <!-- Leaderboard -->
          <section class="user-section">
            <h3 class="user-section-title">Leaderboard</h3>
            <div v-if="activity.leaderboard" class="user-kpi-grid">
              <div class="user-kpi">
                <span class="user-kpi-label">Display name</span>
                <span class="user-kpi-value">
                  {{ activity.leaderboard.display_name }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Smoke-free streak</span>
                <span class="user-kpi-value">
                  {{ activity.leaderboard.smoke_free_days }}d
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Reduction</span>
                <span class="user-kpi-value">
                  {{ formatNum(activity.leaderboard.reduction_pct) }}%
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Daily avg</span>
                <span class="user-kpi-value">
                  {{ formatNum(activity.leaderboard.daily_avg) }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Total logged</span>
                <span class="user-kpi-value">
                  {{ fmtCount(activity.leaderboard.total_logged) }}
                </span>
              </div>
              <div class="user-kpi">
                <span class="user-kpi-label">Updated</span>
                <span class="user-kpi-value">
                  {{ activity.leaderboard.updated_at
                     ? formatRelative(activity.leaderboard.updated_at)
                     : '—' }}
                </span>
              </div>
            </div>
            <p v-else class="user-empty">Not opted in.</p>
          </section>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from 'vaul-vue'
import { useAdminApi } from '../composables/useAdminApi'
import {
  fmtCount,
  formatNum,
  formatDate,
  formatRelative,
  formatDateTime,
} from '../utils/adminFormat'

interface AccountInfo {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  providers: string[]
}
interface PlanInfo {
  start_date: string
  baseline: number
  duration_days: number
  intensity: string
  day_of_plan: number
  target_today: number | null
  is_complete: boolean
  updated_at: string | null
}
interface LeaderboardInfo {
  display_name: string
  smoke_free_days: number
  reduction_pct: number
  total_logged: number
  daily_avg: number
  updated_at: string | null
}
interface EntriesPayload {
  total: number
  last_log_at: string | null
  per_day: Array<{ day: string; count: number }>
  hourly: Array<{ hour: number; count: number }>
  weekday: Array<{ weekday: string; count: number }>
  recent: Array<{ id: string; time: string; date: string }>
}
interface UserActivity {
  account: AccountInfo
  window_days: number
  entries: EntriesPayload
  plan: PlanInfo | null
  leaderboard: LeaderboardInfo | null
}

const props = defineProps<{
  userId: string | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

const api = useAdminApi()
const activity = ref<UserActivity | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load(userId: string): Promise<void> {
  loading.value = true
  error.value = null
  const res = await api.request<UserActivity>('user_activity', {
    user_id: userId,
    days: 30,
  })
  if (!res.ok) {
    error.value = res.error ?? 'Failed to load user activity'
    activity.value = null
  } else {
    activity.value = res.data ?? null
  }
  loading.value = false
}

// Re-fetch when the drawer is opened against a different user. We
// clear `activity` when closed so reopening on a new user doesn't
// briefly show the previous user's data.
watch(
  () => [props.open, props.userId] as const,
  ([open, id], prev) => {
    const prevOpen = prev?.[0] ?? false
    if (open && id) {
      void load(id)
    } else if (!open && prevOpen) {
      activity.value = null
      error.value = null
    }
  },
  { immediate: true }
)

const providers = computed(() => activity.value?.account.providers ?? [])

const dailyAvg = computed(() => {
  const a = activity.value
  if (!a || !a.window_days) return 0
  return a.entries.total / a.window_days
})

const peakHourLabel = computed(() => {
  const a = activity.value
  if (!a) return '—'
  let best = -1
  let bestCount = 0
  for (const h of a.entries.hourly) {
    if (h.count > bestCount) {
      bestCount = h.count
      best = h.hour
    }
  }
  return best >= 0 ? `${String(best).padStart(2, '0')}:00` : '—'
})

const planProgressPct = computed(() => {
  const p = activity.value?.plan
  if (!p) return 0
  const day = Math.max(1, Math.min(p.day_of_plan, p.duration_days))
  return Math.round((day / p.duration_days) * 100)
})

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { autoSkip: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const entriesPerDayData = computed(() => {
  const a = activity.value
  if (!a || a.entries.total === 0) return null
  return {
    labels: a.entries.per_day.map((p) => p.day.slice(5)),
    datasets: [
      {
        data: a.entries.per_day.map((p) => p.count),
        borderColor: '#4338ca',
        backgroundColor: 'rgba(67, 56, 202, 0.18)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }
})

const hourlyData = computed(() => {
  const a = activity.value
  if (!a || a.entries.total === 0) return null
  return {
    labels: a.entries.hourly.map((h) =>
      h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''
    ),
    datasets: [
      {
        data: a.entries.hourly.map((h) => h.count),
        backgroundColor: 'rgba(255, 122, 61, 0.7)',
        borderRadius: 3,
        borderSkipped: false,
      },
    ],
  }
})

const weekdayData = computed(() => {
  const a = activity.value
  if (!a || a.entries.total === 0) return null
  return {
    labels: a.entries.weekday.map((w) => w.weekday),
    datasets: [
      {
        data: a.entries.weekday.map((w) => w.count),
        backgroundColor: 'rgba(67, 56, 202, 0.7)',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }
})

function dotTone(idx: number): string {
  // First few entries are the freshest "footsteps"; tint them brand
  // so the eye lands on the most recent activity first.
  if (idx === 0) return 'tone-brand'
  if (idx < 5) return 'tone-accent'
  return ''
}
</script>

<style scoped>
/* Right-side drawer surface overrides for vaul. The base .sheet-content
   styles (in src/styles/sheet.css) anchor it to the bottom; these rules
   re-anchor it to the right edge for the desktop admin context. */
.user-sheet {
  inset-block: 0;
  inset-inline-end: 0;
  inset-inline-start: auto;
  bottom: auto;
  top: 0;
  height: 100%;
  width: min(560px, 100vw);
  max-height: 100vh;
  border-radius: 18px 0 0 18px;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.user-sheet-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.user-sheet-titles {
  flex: 1;
  min-width: 0;
}
.user-sheet-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-sheet-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.user-sheet-error {
  margin: 12px 22px 0;
}
.user-sheet-loading {
  padding: 28px 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
}
.user-sheet-body {
  overflow-y: auto;
  padding: 14px 22px 32px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.user-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.user-section-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.user-section-sub {
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.user-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.user-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.user-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}
.user-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface-tint);
  border-radius: 10px;
}
.user-kpi-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.user-kpi-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.user-plan-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.user-plan-bar {
  width: 100%;
  height: 6px;
  background: var(--hairline);
  border-radius: 3px;
  overflow: hidden;
}
.user-plan-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  transition: width 0.3s ease;
}

.user-chart {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.user-chart-title {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.user-chart-canvas {
  position: relative;
  height: 160px;
}
.user-chart-canvas-short {
  height: 120px;
}

.user-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 4px 0;
}
.user-timeline-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  font-size: 13px;
  border-bottom: 1px solid var(--hairline);
}
.user-timeline-item:last-child {
  border-bottom: none;
}
.user-timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--subtle);
  flex-shrink: 0;
}
.user-timeline-dot.tone-brand {
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}
.user-timeline-dot.tone-accent {
  background: var(--accent, #4338ca);
}
.user-timeline-row {
  display: flex;
  flex: 1;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
.user-timeline-when {
  font-variant-numeric: tabular-nums;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-timeline-rel {
  font-size: 12px;
  flex-shrink: 0;
}

.user-empty {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

@media (max-width: 640px) {
  .user-sheet {
    width: 100vw;
    border-radius: 0;
  }
}
</style>
