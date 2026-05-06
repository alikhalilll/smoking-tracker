<template>
  <div class="admin-shell" :class="{ 'sidebar-open': mobileNavOpen }">
    <!-- Sidebar (desktop persistent, mobile drawer) -->
    <aside class="admin-sidebar" :class="{ open: mobileNavOpen }">
      <header class="sidebar-brand">
        <span class="brand-glyph" aria-hidden="true">📊</span>
        <span class="brand-text">
          <span class="brand-name">Smoking Tracker</span>
          <span class="brand-sub">Admin</span>
        </span>
      </header>

      <nav class="sidebar-nav" aria-label="Dashboard sections">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="nav-item"
          :class="{ active: activeTab === t.id }"
          :aria-current="activeTab === t.id ? 'page' : undefined"
          @click="onPickTab(t.id)"
        >
          <span class="nav-icon" v-html="navIcons[t.id]" />
          <span class="nav-label">{{ t.label }}</span>
          <span v-if="t.badge != null" class="chip chip-brand nav-badge">
            {{ t.badge }}
          </span>
        </button>
      </nav>

      <footer class="sidebar-footer">
        <button class="nav-item nav-item-ghost" @click="onSignOut">
          <span class="nav-icon" v-html="iconSignOut" />
          <span class="nav-label">Sign out</span>
        </button>
        <button class="nav-item nav-item-ghost" @click="emit('exit')">
          <span class="nav-icon" v-html="iconBack" />
          <span class="nav-label">Back to app</span>
        </button>
      </footer>
    </aside>

    <!-- Mobile sidebar scrim -->
    <div
      v-if="mobileNavOpen"
      class="sidebar-scrim"
      role="presentation"
      @click="mobileNavOpen = false"
    />

    <!-- Main content area -->
    <main class="admin-main">
      <header class="admin-toolbar glass">
        <button
          class="btn btn-icon admin-burger"
          :aria-label="'Toggle navigation'"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <div class="toolbar-titles">
          <h1 class="h-section toolbar-title">{{ activeTabLabel }}</h1>
          <p class="h-section-sub toolbar-sub">
            <span>Last refreshed {{ lastRefreshLabel }}</span>
            <span v-if="loading" class="muted">· loading…</span>
          </p>
        </div>

        <div class="toolbar-actions">
          <div class="admin-select">
            <Select
              v-model="windowKey"
              :options="windowOptions"
              title="Date range"
            />
          </div>
          <button class="btn btn-ghost btn-pill toolbar-refresh" :disabled="loading" @click="loadAll">
            <span v-if="loading" class="spinner" />
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span class="refresh-label">{{ loading ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
        </div>
      </header>

      <div v-if="error" class="chip chip-danger admin-error">{{ error }}</div>

    <!-- ============================== OVERVIEW ============================== -->
    <template v-if="activeTab === 'overview'">
      <section class="tile-grid">
        <div
          v-for="t in tiles"
          :key="t.label"
          class="tinted-card"
          :class="t.tone"
        >
          <span class="tile-label">{{ t.label }}</span>
          <span class="tile-value">{{ t.value }}</span>
          <span v-if="t.help" class="tile-help">{{ t.help }}</span>
        </div>
      </section>

      <section class="card admin-section">
        <header class="admin-section-head">
          <h2 class="h-section">Engagement funnel</h2>
          <span class="h-section-sub">Drop-off from sign-up through to plan completion</span>
        </header>
        <div class="funnel">
          <div v-for="(s, i) in funnelRows" :key="s.step" class="funnel-row">
            <span class="funnel-step">{{ funnelLabels[s.step] ?? s.step }}</span>
            <div class="funnel-bar-wrap">
              <div
                class="funnel-bar"
                :style="{
                  width: funnelMax > 0 ? `${(s.count / funnelMax) * 100}%` : '0%',
                  background: funnelColors[i % funnelColors.length],
                }"
              />
              <span class="funnel-count">{{ s.count.toLocaleString() }}</span>
            </div>
            <span class="funnel-pct">
              {{ funnelMax > 0 ? Math.round((s.count / funnelMax) * 100) + '%' : '—' }}
            </span>
          </div>
        </div>
      </section>
    </template>

    <!-- ============================== ACTIVITY ============================== -->
    <template v-if="activeTab === 'activity'">
      <section class="chart-grid chart-grid-3">
        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Sign-ups</h3>
            <span class="chip chip-brand">{{ sumOf(signups).toLocaleString() }} new</span>
          </header>
          <div class="chart-wrap">
            <Line v-if="signupsData" :data="signupsData" :options="lineOptions" />
          </div>
        </div>

        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Cigarettes logged</h3>
            <span class="chip chip-accent">{{ sumOf(entriesSeries).toLocaleString() }} logged</span>
          </header>
          <div class="chart-wrap">
            <Line v-if="entriesData" :data="entriesData" :options="lineOptions" />
          </div>
        </div>

        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Daily active users</h3>
            <span class="chip chip-mint">peak {{ peakOf(dau).toLocaleString() }}</span>
          </header>
          <div class="chart-wrap">
            <Line v-if="dauData" :data="dauData" :options="lineOptions" />
          </div>
        </div>
      </section>

      <section class="chart-grid chart-grid-1">
        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Cumulative cigarettes (last 30 days)</h3>
            <span class="chip">+{{ sumOf(entriesSeries).toLocaleString() }} this period</span>
          </header>
          <div class="chart-wrap chart-wrap-tall">
            <Line v-if="cumulativeData" :data="cumulativeData" :options="areaOptions" />
          </div>
        </div>
      </section>
    </template>

    <!-- ============================== BEHAVIOR ============================== -->
    <template v-if="activeTab === 'behavior'">
      <section class="chart-grid chart-grid-3">
        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Hour of day</h3>
            <span v-if="peakHour !== null" class="chip chip-brand">peak {{ peakHour }}:00</span>
          </header>
          <div class="chart-wrap">
            <Bar v-if="hourlyData" :data="hourlyData" :options="barOptionsCompact" />
          </div>
        </div>

        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Weekday</h3>
            <span v-if="peakWeekday" class="chip chip-accent">peak {{ peakWeekday }}</span>
          </header>
          <div class="chart-wrap">
            <Bar v-if="weekdayData" :data="weekdayData" :options="barOptionsCompact" />
          </div>
        </div>

        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Plan intensity</h3>
            <span class="chip">{{ overview?.total_plans ?? 0 }} plans</span>
          </header>
          <div class="chart-wrap">
            <Doughnut v-if="intensityData" :data="intensityData" :options="doughnutOptions" />
          </div>
        </div>
      </section>

      <section class="chart-grid chart-grid-2">
        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">Plan status</h3>
            <span class="chip chip-mint">
              {{ (overview?.plans_active ?? 0) + (overview?.plans_complete ?? 0) }} total
            </span>
          </header>
          <div class="chart-wrap">
            <Doughnut v-if="planStatusData" :data="planStatusData" :options="doughnutOptions" />
          </div>
        </div>

        <div class="card chart-card">
          <header class="chart-head">
            <h3 class="h-section chart-title">At-a-glance</h3>
            <span class="chip">behavior summary</span>
          </header>
          <div class="behavior-summary">
            <div class="behavior-stat">
              <span class="behavior-stat-label">Most active hour</span>
              <span class="behavior-stat-value">
                {{ peakHour !== null ? `${peakHour}:00` : '—' }}
              </span>
            </div>
            <div class="behavior-stat">
              <span class="behavior-stat-label">Most active weekday</span>
              <span class="behavior-stat-value">{{ peakWeekday ?? '—' }}</span>
            </div>
            <div class="behavior-stat">
              <span class="behavior-stat-label">Avg cigs / active user / day</span>
              <span class="behavior-stat-value">
                {{ overview ? formatNum(overview.avg_cigs_per_active_30d) : '—' }}
              </span>
            </div>
            <div class="behavior-stat">
              <span class="behavior-stat-label">Longest smoke-free streak</span>
              <span class="behavior-stat-value">
                {{ overview ? `${overview.longest_streak} days` : '—' }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- =============================== USERS ================================ -->
    <template v-if="activeTab === 'users'">
      <section class="card admin-section">
        <header class="admin-section-head">
          <h2 class="h-section">Users</h2>
          <div class="admin-section-tools">
            <input
              v-model="userFilter"
              type="search"
              placeholder="Filter by email…"
              class="field-input field-input-compact"
            />
            <div class="admin-select">
              <Select v-model="sortKey" :options="sortOptions" title="Sort users" />
            </div>
            <span class="chip">{{ filteredUsers.length }} / {{ users.length }}</span>
          </div>
        </header>
        <div class="table-wrap">
          <table class="user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th class="num">Entries</th>
                <th>Plan</th>
                <th>Last log</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in filteredUsers"
                :key="u.id"
                class="user-row"
                role="button"
                tabindex="0"
                :aria-label="`Open activity for ${u.email || u.id}`"
                @click="openUser(u.id)"
                @keydown.enter.prevent="openUser(u.id)"
                @keydown.space.prevent="openUser(u.id)"
              >
                <td class="email-cell">{{ u.email || '—' }}</td>
                <td>{{ formatDate(u.created_at) }}</td>
                <td class="num">{{ u.total_entries.toLocaleString() }}</td>
                <td>
                  <span v-if="u.has_plan" class="chip chip-mint">active</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>{{ u.last_log_at ? formatRelative(u.last_log_at) : '—' }}</td>
              </tr>
              <tr v-if="!users.length && !loading">
                <td colspan="5" class="empty">No users yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    </main>

    <AdminUserDrawer
      :user-id="selectedUserId"
      :open="userDrawerOpen"
      @update:open="onUserDrawerOpenChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useAdminApi } from '../composables/useAdminApi'
import Select from './Select.vue'
import AdminUserDrawer from './AdminUserDrawer.vue'
import {
  fmtCount as fmt,
  formatNum,
  formatDate,
  formatRelative,
} from '../utils/adminFormat'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const emit = defineEmits<{
  exit: []
  'signed-out': []
}>()

interface Overview {
  total_users: number
  active_1d: number
  active_7d: number
  active_30d: number
  stickiness_pct: number
  total_entries: number
  entries_30d: number
  avg_cigs_per_active_30d: number
  total_plans: number
  plans_active: number
  plans_complete: number
  longest_streak: number
  smoke_free_7d_plus: number
  avg_reduction_pct: number
  leaderboard_size: number
}
interface TimeseriesPoint {
  day: string
  count: number
}
interface IntensityRow {
  intensity: string
  count: number
}
interface HourlyRow {
  hour: number
  count: number
}
interface WeekdayRow {
  weekday: string
  count: number
}
interface PlanStatusRow {
  status: string
  count: number
}
interface FunnelRow {
  step: string
  count: number
}
interface UserRow {
  id: string
  email: string | null
  created_at: string
  total_entries: number
  has_plan: boolean
  last_log_at: string | null
}

type TabId = 'overview' | 'activity' | 'behavior' | 'users'

const api = useAdminApi()
const loading = ref(false)
const error = ref<string | null>(null)
const lastRefresh = ref<number | null>(null)

const activeTab = ref<TabId>(readTabFromHash())

function readTabFromHash(): TabId {
  if (typeof window === 'undefined') return 'overview'
  const seg = window.location.hash.replace(/^#\/?/, '').split('/')[1]
  if (seg === 'activity' || seg === 'behavior' || seg === 'users') return seg
  return 'overview'
}

watch(activeTab, (id) => {
  if (typeof window === 'undefined') return
  const next = `#/admin/${id}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
  }
})

// Select.vue is string-typed; we mirror to a numeric `windowDays`.
const windowKey = ref<string>('30')
const windowOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]
const windowDays = computed(() => Number(windowKey.value) || 30)

const sortOptions = [
  { value: 'created_at', label: 'Newest first' },
  { value: 'total_entries', label: 'Most logs' },
  { value: 'last_log_at', label: 'Most recent log' },
]
const overview = ref<Overview | null>(null)
const signups = ref<TimeseriesPoint[]>([])
const entriesSeries = ref<TimeseriesPoint[]>([])
const dau = ref<TimeseriesPoint[]>([])
const hourly = ref<HourlyRow[]>([])
const weekday = ref<WeekdayRow[]>([])
const intensities = ref<IntensityRow[]>([])
const planStatus = ref<PlanStatusRow[]>([])
const funnelRows = ref<FunnelRow[]>([])
const users = ref<UserRow[]>([])
const userFilter = ref('')
const sortKey = ref<string>('created_at')

const selectedUserId = ref<string | null>(null)
const userDrawerOpen = ref(false)

function openUser(id: string): void {
  selectedUserId.value = id
  userDrawerOpen.value = true
}
function onUserDrawerOpenChange(v: boolean): void {
  userDrawerOpen.value = v
  if (!v) selectedUserId.value = null
}

const tabs = computed<Array<{ id: TabId; label: string; badge?: number | null }>>(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'users', label: 'Users', badge: users.value.length || null },
])

const activeTabLabel = computed(
  () => tabs.value.find((t) => t.id === activeTab.value)?.label ?? 'Overview'
)

const mobileNavOpen = ref(false)
function onPickTab(id: TabId): void {
  activeTab.value = id
  mobileNavOpen.value = false
}

const navIcons: Record<TabId, string> = {
  overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`,
  activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  behavior: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
}

const iconSignOut = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`
const iconBack = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`

const tiles = computed(() => {
  const o = overview.value
  return [
    { label: 'Total users',           value: fmt(o?.total_users),                  tone: 'tinted-peach' },
    { label: 'Active today',          value: fmt(o?.active_1d),                    tone: 'tinted-mint' },
    { label: 'Active 7d',             value: fmt(o?.active_7d),                    tone: 'tinted-mint' },
    { label: 'Active 30d',            value: fmt(o?.active_30d),                   tone: 'tinted-mint' },
    { label: 'Stickiness',            value: o ? `${o.stickiness_pct}%` : '—',     tone: 'tinted-lavender', help: 'DAU ÷ MAU' },
    { label: 'Total cigarettes',      value: fmt(o?.total_entries),                tone: 'tinted-peach' },
    { label: 'Avg / user / day',      value: o ? formatNum(o.avg_cigs_per_active_30d) : '—', tone: 'tinted-peach', help: 'last 30 days' },
    { label: 'Quit plans',            value: fmt(o?.total_plans),                  tone: 'tinted-lavender' },
    { label: 'Active plans',          value: fmt(o?.plans_active),                 tone: 'tinted-lavender' },
    { label: 'Plans completed',       value: fmt(o?.plans_complete),               tone: 'tinted-lavender' },
    { label: 'Longest smoke-free',    value: o ? `${o.longest_streak}d` : '—',     tone: 'tinted-sun' },
    { label: 'Smoke-free ≥ 7d',       value: fmt(o?.smoke_free_7d_plus),           tone: 'tinted-sun' },
    { label: 'Avg reduction',         value: o ? `${o.avg_reduction_pct}%` : '—',  tone: 'tinted-sun', help: 'opted-in users' },
    { label: 'On leaderboard',        value: fmt(o?.leaderboard_size),             tone: 'tinted-mint' },
  ]
})

const lastRefreshLabel = computed(() => {
  if (!lastRefresh.value) return '—'
  return new Date(lastRefresh.value).toLocaleTimeString()
})

function sumOf(series: { count: number }[]): number {
  return series.reduce((acc, p) => acc + Number(p.count ?? 0), 0)
}
function peakOf(series: { count: number }[]): number {
  return series.reduce((acc, p) => Math.max(acc, Number(p.count ?? 0)), 0)
}

const peakHour = computed(() => {
  if (!hourly.value.length) return null
  let best = 0
  let bestCount = -1
  for (const h of hourly.value) {
    if (h.count > bestCount) {
      bestCount = h.count
      best = h.hour
    }
  }
  return bestCount > 0 ? best : null
})

const peakWeekday = computed(() => {
  if (!weekday.value.length) return null
  let best: WeekdayRow | null = null
  for (const w of weekday.value) {
    if (!best || w.count > best.count) best = w
  }
  return best && best.count > 0 ? best.weekday : null
})

const funnelLabels: Record<string, string> = {
  signed_up: 'Signed up',
  logged_once: 'Logged ≥ 1 cigarette',
  seven_days: 'Logged ≥ 7 days',
  started_plan: 'Started a quit plan',
  completed_plan: 'Completed a plan',
}

const funnelColors = ['#ff7a3d', '#ff9258', '#ffb070', '#10b981', '#4338ca']

const funnelMax = computed(() =>
  funnelRows.value.length ? Math.max(...funnelRows.value.map((s) => s.count)) : 0
)

// --- Chart options --------------------------------------------------

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const areaOptions = lineOptions

const barOptionsCompact = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { autoSkip: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 10, padding: 12 } },
  },
} as const

// --- Chart datasets -------------------------------------------------

const signupsData = computed(() => {
  if (!signups.value.length) return null
  return {
    labels: signups.value.map((p) => p.day.slice(5)),
    datasets: [{
      data: signups.value.map((p) => p.count),
      borderColor: '#ff7a3d',
      backgroundColor: 'rgba(255, 122, 61, 0.18)',
      fill: true, tension: 0.3, pointRadius: 0,
    }],
  }
})

const entriesData = computed(() => {
  if (!entriesSeries.value.length) return null
  return {
    labels: entriesSeries.value.map((p) => p.day.slice(5)),
    datasets: [{
      data: entriesSeries.value.map((p) => p.count),
      borderColor: '#4338ca',
      backgroundColor: 'rgba(67, 56, 202, 0.18)',
      fill: true, tension: 0.3, pointRadius: 0,
    }],
  }
})

const dauData = computed(() => {
  if (!dau.value.length) return null
  return {
    labels: dau.value.map((p) => p.day.slice(5)),
    datasets: [{
      data: dau.value.map((p) => p.count),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.18)',
      fill: true, tension: 0.3, pointRadius: 0,
    }],
  }
})

const cumulativeData = computed(() => {
  if (!entriesSeries.value.length) return null
  let running = 0
  const cum = entriesSeries.value.map((p) => (running += p.count))
  return {
    labels: entriesSeries.value.map((p) => p.day.slice(5)),
    datasets: [{
      data: cum,
      borderColor: '#be185d',
      backgroundColor: 'rgba(190, 24, 93, 0.18)',
      fill: true, tension: 0.3, pointRadius: 0,
    }],
  }
})

const hourlyData = computed(() => {
  if (!hourly.value.length) return null
  return {
    labels: hourly.value.map((h) => (h.hour % 3 === 0 ? `${String(h.hour).padStart(2, '0')}` : '')),
    datasets: [{
      data: hourly.value.map((h) => h.count),
      backgroundColor: 'rgba(255, 122, 61, 0.7)',
      borderRadius: 3,
      borderSkipped: false,
    }],
  }
})

const weekdayData = computed(() => {
  if (!weekday.value.length) return null
  return {
    labels: weekday.value.map((w) => w.weekday),
    datasets: [{
      data: weekday.value.map((w) => w.count),
      backgroundColor: 'rgba(67, 56, 202, 0.7)',
      borderRadius: 4,
      borderSkipped: false,
    }],
  }
})

const intensityData = computed(() => {
  if (!intensities.value.length) return null
  return {
    labels: intensities.value.map((r) => r.intensity),
    datasets: [{
      data: intensities.value.map((r) => r.count),
      backgroundColor: ['#ff7a3d', '#4338ca', '#10b981', '#be185d'],
      borderWidth: 0,
    }],
  }
})

const planStatusData = computed(() => {
  if (!planStatus.value.length) return null
  return {
    labels: planStatus.value.map((r) => r.status),
    datasets: [{
      data: planStatus.value.map((r) => r.count),
      backgroundColor: ['#10b981', '#4338ca', '#ff7a3d'],
      borderWidth: 0,
    }],
  }
})

// --- Filtering / sorting --------------------------------------------

const filteredUsers = computed(() => {
  const q = userFilter.value.trim().toLowerCase()
  let rows = users.value
  if (q) rows = rows.filter((u) => (u.email ?? '').toLowerCase().includes(q))
  const key = sortKey.value
  return [...rows].sort((a, b) => {
    if (key === 'total_entries') return b.total_entries - a.total_entries
    if (key === 'last_log_at') {
      const A = a.last_log_at ? Date.parse(a.last_log_at) : 0
      const B = b.last_log_at ? Date.parse(b.last_log_at) : 0
      return B - A
    }
    return Date.parse(b.created_at) - Date.parse(a.created_at)
  })
})

// --- Loading --------------------------------------------------------

async function loadAll(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const days = windowDays.value
    const [
      ovRes, signupsRes, entriesRes, dauRes,
      hourlyRes, weekdayRes, intensityRes, planStatusRes,
      funnelRes, usersRes,
    ] = await Promise.all([
      api.request<Overview>('overview'),
      api.request<TimeseriesPoint[]>('signups_timeseries', { days }),
      api.request<TimeseriesPoint[]>('entries_timeseries', { days }),
      api.request<TimeseriesPoint[]>('dau_timeseries', { days }),
      api.request<HourlyRow[]>('hourly_distribution'),
      api.request<WeekdayRow[]>('weekday_distribution'),
      api.request<IntensityRow[]>('intensity_breakdown'),
      api.request<PlanStatusRow[]>('plan_status'),
      api.request<FunnelRow[]>('engagement_funnel'),
      api.request<UserRow[]>('user_list', { limit: 500 }),
    ])

    if (!ovRes.ok) throw new Error(ovRes.error ?? 'overview failed')
    if (!signupsRes.ok) throw new Error(signupsRes.error ?? 'signups failed')
    if (!entriesRes.ok) throw new Error(entriesRes.error ?? 'entries failed')
    if (!dauRes.ok) throw new Error(dauRes.error ?? 'dau failed')
    if (!hourlyRes.ok) throw new Error(hourlyRes.error ?? 'hourly failed')
    if (!weekdayRes.ok) throw new Error(weekdayRes.error ?? 'weekday failed')
    if (!intensityRes.ok) throw new Error(intensityRes.error ?? 'intensity failed')
    if (!planStatusRes.ok) throw new Error(planStatusRes.error ?? 'plan status failed')
    if (!funnelRes.ok) throw new Error(funnelRes.error ?? 'funnel failed')
    if (!usersRes.ok) throw new Error(usersRes.error ?? 'users failed')

    overview.value = ovRes.data ?? null
    signups.value = signupsRes.data ?? []
    entriesSeries.value = entriesRes.data ?? []
    dau.value = dauRes.data ?? []
    hourly.value = hourlyRes.data ?? []
    weekday.value = weekdayRes.data ?? []
    intensities.value = intensityRes.data ?? []
    planStatus.value = planStatusRes.data ?? []
    funnelRows.value = funnelRes.data ?? []
    users.value = usersRes.data ?? []
    lastRefresh.value = Date.now()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

watch(windowKey, () => {
  void loadAll()
})

function onSignOut(): void {
  api.logout()
  emit('signed-out')
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
/* SaaS-style layout — sidebar + main. Visual primitives come from
   the shared components.css (.card, .chip, .btn, .tinted-card,
   .field-input, .h-section) so the admin matches the rest of the
   app. */

.admin-shell {
  display: grid;
  grid-template-columns: 256px 1fr;
  width: 100%;
  height: 100%;
  color: var(--text);
}

/* --- Sidebar ---------------------------------------------------- */
.admin-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 14px;
  background: var(--card);
  border-inline-end: 1px solid var(--border);
  overflow-y: auto;
  height: 100%;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 16px;
  border-bottom: 1px solid var(--border);
}
.brand-glyph {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: var(--brand-shadow);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.brand-sub {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-item:hover {
  background: var(--btn-ghost-bg);
  color: var(--text);
}
.nav-item.active {
  background: var(--brand-soft);
  color: var(--brand);
}
.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.nav-label {
  flex: 1;
  text-align: start;
}
.nav-badge {
  padding: 2px 8px;
  font-size: 10px;
}
.nav-item-ghost {
  color: var(--muted);
}

.sidebar-scrim {
  display: none;
}

/* --- Main ------------------------------------------------------- */
.admin-main {
  overflow-y: auto;
  height: 100%;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}
.admin-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px clamp(16px, 3vw, 32px);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 80%, transparent);
}
.admin-burger {
  display: none;
}
.toolbar-titles {
  flex: 1;
  min-width: 0;
}
.toolbar-title {
  margin: 0;
  font-size: 18px;
}
.toolbar-sub {
  margin: 0;
  display: flex;
  gap: 4px;
  align-items: baseline;
  flex-wrap: wrap;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.toolbar-refresh .refresh-label {
  display: inline;
}
.muted { color: var(--muted); }
.admin-error {
  align-self: flex-start;
  margin: 14px clamp(16px, 3vw, 32px) 0;
  padding: 8px 14px;
}

/* Inline content padding — every section inside .admin-main */
.tile-grid,
.admin-section,
.chart-grid {
  margin-inline: clamp(16px, 3vw, 32px);
}
.tile-grid { margin-top: 18px; }
.admin-section { margin-top: 14px; }
.chart-grid { margin-top: 14px; }

/* Compact field — used for filter inputs in table tools. */
.field-input-compact {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 10px;
  width: auto;
  min-width: 180px;
}
.admin-select {
  min-width: 170px;
}
.admin-select :deep(.select-trigger) {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 10px;
}

/* KPI tiles — built from .tinted-card primitives */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.tile-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.78;
}
.tile-value {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.tile-help {
  font-size: 11px;
  opacity: 0.7;
}

/* Section card — light overrides on .card for our admin sections */
.admin-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.admin-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.admin-section-tools {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* Funnel --------------------------------------------------------- */
.funnel { display: flex; flex-direction: column; gap: 10px; }
.funnel-row {
  display: grid;
  grid-template-columns: clamp(160px, 22%, 240px) 1fr 56px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.funnel-step { font-weight: 600; }
.funnel-bar-wrap {
  position: relative;
  background: var(--btn-ghost-bg);
  border-radius: 999px;
  height: 26px;
  overflow: hidden;
}
.funnel-bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.funnel-count {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  mix-blend-mode: normal;
}
.funnel-pct {
  text-align: end;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* Chart grid ---------------------------------------------------- */
.chart-grid { display: grid; gap: 14px; }
.chart-grid-1 { grid-template-columns: 1fr; }
.chart-grid-2 { grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); }
.chart-grid-3 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }

@media (min-width: 1280px) {
  .chart-grid-3 { grid-template-columns: repeat(3, 1fr); }
  .chart-grid-2 { grid-template-columns: repeat(2, 1fr); }
}

.chart-card { display: flex; flex-direction: column; gap: 12px; }
.chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.chart-title {
  font-size: 14px;
  margin: 0;
}
.chart-wrap {
  height: 220px;
  position: relative;
}
.chart-wrap-tall { height: 280px; }

@media (min-width: 1280px) {
  .chart-wrap { height: 240px; }
  .chart-wrap-tall { height: 320px; }
}

/* Behavior summary list ------------------------------------------ */
.behavior-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 6px;
}
.behavior-stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
}
.behavior-stat:last-child { border-bottom: none; }
.behavior-stat-label {
  font-size: 13px;
  color: var(--muted);
}
.behavior-stat-value {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* User table ----------------------------------------------------- */
.table-wrap {
  overflow-x: auto;
  margin-inline: -4px;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.user-table th,
.user-table td {
  text-align: start;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.user-table tbody tr.user-row { cursor: pointer; }
.user-table tbody tr.user-row:hover,
.user-table tbody tr.user-row:focus-visible {
  background: var(--btn-ghost-bg);
  outline: none;
}
.user-table tbody tr.user-row:focus-visible {
  box-shadow: inset 0 0 0 2px var(--brand-soft);
}
.user-table th {
  font-weight: 600;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  position: sticky;
  top: 0;
  background: var(--card);
}
.user-table th.num,
.user-table td.num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
.email-cell {
  word-break: break-all;
  max-width: 320px;
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 18px;
}

/* Tablet — narrower sidebar */
@media (max-width: 1100px) {
  .admin-shell { grid-template-columns: 220px 1fr; }
}

/* Mobile — sidebar becomes an off-canvas drawer */
@media (max-width: 860px) {
  .admin-shell { grid-template-columns: 1fr; }
  .admin-sidebar {
    position: fixed;
    inset-inline-start: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    max-width: 86vw;
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  }
  [dir='rtl'] .admin-sidebar {
    inset-inline-start: auto;
    inset-inline-end: 0;
    transform: translateX(100%);
  }
  .admin-sidebar.open { transform: translateX(0); }
  .sidebar-scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 25;
  }
  .admin-burger { display: inline-flex; }
  .toolbar-refresh .refresh-label { display: none; }
}

@media (max-width: 540px) {
  .admin-toolbar { gap: 10px; padding: 12px 16px; }
  .toolbar-title { font-size: 16px; }
  .funnel-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .funnel-pct { text-align: start; }
}
</style>
