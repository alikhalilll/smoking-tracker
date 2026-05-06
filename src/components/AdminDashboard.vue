<template>
  <div class="admin-dashboard">
    <header class="admin-header">
      <div>
        <h1 class="admin-title">Smoking Tracker · Admin</h1>
        <p class="admin-sub">
          Last refreshed {{ lastRefreshLabel }}
          <span v-if="loading" class="muted">· loading…</span>
        </p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-ghost" :disabled="loading" @click="loadAll">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
        <button class="btn btn-ghost" @click="onSignOut">Sign out</button>
        <button class="btn btn-ghost" @click="emit('exit')">← App</button>
      </div>
    </header>

    <div v-if="error" class="error-banner">
      {{ error }}
    </div>

    <!-- Stat tiles -->
    <section class="tile-grid">
      <div v-for="t in tiles" :key="t.label" class="tile">
        <div class="tile-label">{{ t.label }}</div>
        <div class="tile-value">{{ t.value }}</div>
        <div v-if="t.help" class="tile-help">{{ t.help }}</div>
      </div>
    </section>

    <!-- Time-series charts -->
    <section class="chart-grid">
      <div class="chart-card">
        <h2 class="chart-title">Sign-ups · last 30 days</h2>
        <div class="chart-wrap">
          <Line
            v-if="signupsData"
            :data="signupsData"
            :options="lineOptions"
          />
        </div>
      </div>
      <div class="chart-card">
        <h2 class="chart-title">Cigarettes logged · last 30 days</h2>
        <div class="chart-wrap">
          <Line
            v-if="entriesData"
            :data="entriesData"
            :options="lineOptions"
          />
        </div>
      </div>
      <div class="chart-card">
        <h2 class="chart-title">Quit-plan intensity</h2>
        <div class="chart-wrap">
          <Bar
            v-if="intensityData"
            :data="intensityData"
            :options="barOptions"
          />
        </div>
      </div>
    </section>

    <!-- User list -->
    <section class="user-list-section">
      <header class="section-header">
        <h2>Users</h2>
        <input
          v-model="userFilter"
          type="search"
          placeholder="Filter by email…"
          class="filter-input"
        />
      </header>
      <div class="table-wrap">
        <table class="user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Joined</th>
              <th>Entries</th>
              <th>Plan</th>
              <th>Last log</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.id">
              <td class="email-cell">{{ u.email }}</td>
              <td>{{ formatDate(u.created_at) }}</td>
              <td class="num">{{ u.total_entries }}</td>
              <td>{{ u.has_plan ? '✓' : '—' }}</td>
              <td>{{ u.last_log_at ? formatDate(u.last_log_at) : '—' }}</td>
            </tr>
            <tr v-if="!users.length && !loading">
              <td colspan="5" class="empty">No users yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useAdminApi } from '../composables/useAdminApi'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  active_7d: number
  active_30d: number
  total_entries: number
  total_plans: number
  plans_complete: number
}
interface TimeseriesPoint {
  day: string
  count: number
}
interface IntensityRow {
  intensity: string
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

const api = useAdminApi()
const loading = ref(false)
const error = ref<string | null>(null)
const lastRefresh = ref<number | null>(null)

const overview = ref<Overview | null>(null)
const signups = ref<TimeseriesPoint[]>([])
const entriesSeries = ref<TimeseriesPoint[]>([])
const intensities = ref<IntensityRow[]>([])
const users = ref<UserRow[]>([])
const userFilter = ref('')

const tiles = computed(() => [
  { label: 'Total users', value: fmt(overview.value?.total_users) },
  { label: 'Active (7d)', value: fmt(overview.value?.active_7d), help: 'Logged a cigarette in the last 7 days' },
  { label: 'Active (30d)', value: fmt(overview.value?.active_30d) },
  { label: 'Total cigarettes logged', value: fmt(overview.value?.total_entries) },
  { label: 'Quit plans created', value: fmt(overview.value?.total_plans) },
  { label: 'Plans completed', value: fmt(overview.value?.plans_complete) },
])

function fmt(n: number | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString()
}

const lastRefreshLabel = computed(() => {
  if (!lastRefresh.value) return '—'
  return new Date(lastRefresh.value).toLocaleTimeString()
})

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
} as const

const signupsData = computed(() => {
  if (!signups.value.length) return null
  return {
    labels: signups.value.map((p) => p.day.slice(5)),
    datasets: [
      {
        data: signups.value.map((p) => p.count),
        borderColor: '#ff7a3d',
        backgroundColor: 'rgba(255, 122, 61, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  }
})

const entriesData = computed(() => {
  if (!entriesSeries.value.length) return null
  return {
    labels: entriesSeries.value.map((p) => p.day.slice(5)),
    datasets: [
      {
        data: entriesSeries.value.map((p) => p.count),
        borderColor: '#4338ca',
        backgroundColor: 'rgba(67, 56, 202, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  }
})

const intensityData = computed(() => {
  if (!intensities.value.length) return null
  return {
    labels: intensities.value.map((r) => r.intensity),
    datasets: [
      {
        data: intensities.value.map((r) => r.count),
        backgroundColor: ['#ff7a3d', '#4338ca', '#10b981', '#be185d'],
        borderRadius: 6,
      },
    ],
  }
})

const filteredUsers = computed(() => {
  const q = userFilter.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => (u.email ?? '').toLowerCase().includes(q))
})

async function loadAll(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [ovRes, signupsRes, entriesRes, intensityRes, usersRes] =
      await Promise.all([
        api.request<Overview>('overview'),
        api.request<TimeseriesPoint[]>('signups_timeseries', { days: 30 }),
        api.request<TimeseriesPoint[]>('entries_timeseries', { days: 30 }),
        api.request<IntensityRow[]>('intensity_breakdown'),
        api.request<UserRow[]>('user_list', { limit: 200 }),
      ])

    if (!ovRes.ok) throw new Error(ovRes.error ?? 'overview failed')
    if (!signupsRes.ok) throw new Error(signupsRes.error ?? 'signups failed')
    if (!entriesRes.ok) throw new Error(entriesRes.error ?? 'entries failed')
    if (!intensityRes.ok) throw new Error(intensityRes.error ?? 'intensity failed')
    if (!usersRes.ok) throw new Error(usersRes.error ?? 'users failed')

    overview.value = ovRes.data ?? null
    signups.value = signupsRes.data ?? []
    entriesSeries.value = entriesRes.data ?? []
    intensities.value = intensityRes.data ?? []
    users.value = usersRes.data ?? []
    lastRefresh.value = Date.now()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function onSignOut(): void {
  api.logout()
  emit('signed-out')
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.admin-dashboard {
  padding: 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text);
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.admin-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
}
.admin-sub {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.muted {
  color: var(--muted);
}
.admin-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.error-banner {
  background: var(--danger-soft);
  color: var(--danger);
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  margin-bottom: 18px;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.tile {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
}
.tile-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}
.tile-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.tile-help {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.chart-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
}
.chart-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text);
}
.chart-wrap {
  height: 200px;
  position: relative;
}

.user-list-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}
.section-header h2 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.filter-input {
  flex: 1;
  max-width: 240px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}

.table-wrap {
  overflow-x: auto;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.user-table th,
.user-table td {
  text-align: start;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.user-table th {
  font-weight: 600;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.email-cell {
  word-break: break-all;
}
.num {
  font-variant-numeric: tabular-nums;
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 18px;
}
</style>
