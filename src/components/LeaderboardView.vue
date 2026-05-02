<template>
  <div class="fade-in">
    <div class="head">
      <h1 class="h-section">{{ t('leaderboard.title') }}</h1>
    </div>

    <!-- Gated: not signed in -->
    <div v-if="!isAuthed || !leaderboard" class="card opt-in">
      <div class="opt-hero">🏆</div>
      <h2 class="opt-headline">{{ t('cloud.needs_signin_headline') }}</h2>
      <p class="opt-body">{{ t('cloud.needs_signin_body') }}</p>
      <button class="btn btn-primary block" @click="emit('open-auth')">
        {{ t('cloud.needs_signin_cta') }}
      </button>
    </div>

    <!-- Signed in but not yet opted in -->
    <div
      v-else-if="!leaderboard.prefs.value.optedIn"
      class="card opt-in"
    >
      <div class="opt-hero">🌱</div>
      <h2 class="opt-headline">{{ t('leaderboard.opt_in_headline') }}</h2>
      <p class="opt-body">{{ t('leaderboard.opt_in_body') }}</p>
      <button class="btn btn-primary block" @click="emit('open-settings')">
        {{ t('leaderboard.opt_in_cta') }}
      </button>
    </div>

    <template v-else>
      <!-- Animated metric pills -->
      <div class="tab-pills" role="tablist">
        <div
          class="tab-pill-indicator"
          :style="{
            width: `${100 / metrics.length}%`,
            transform: `translateX(${metrics.indexOf(metric) * 100}%)`,
          }"
        />
        <button
          v-for="m in metrics"
          :key="m"
          class="tab-pill"
          :class="{ active: metric === m }"
          role="tab"
          @click="metric = m"
        >
          {{ t(`leaderboard.metric_${m}`) }}
        </button>
      </div>

      <!-- Loading skeletons -->
      <div v-if="leaderboard.loading.value && rows.length === 0" class="lb-list">
        <div v-for="i in 3" :key="i" class="lb-row">
          <span class="skeleton" style="width: 36px; height: 36px; border-radius: 50%"></span>
          <span class="skeleton" style="height: 14px; flex: 1"></span>
          <span class="skeleton" style="height: 14px; width: 56px"></span>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="leaderboard.error.value" class="error-line">
        {{ leaderboard.error.value }}
      </div>

      <!-- Empty -->
      <div v-else-if="rows.length === 0" class="card empty">
        <div class="opt-hero">🌱</div>
        <p class="opt-body" style="margin-bottom: 0">
          {{ t('leaderboard.empty') }}
        </p>
      </div>

      <template v-else>
        <!-- Top-3 podium -->
        <div v-if="podium.first" class="podium">
          <div class="podium-spot rank-2" v-if="podium.second">
            <Avatar :name="podium.second.display_name" :seed="podium.second.user_id" size="md" />
            <div class="podium-medal">🥈</div>
            <div class="podium-name">{{ podium.second.display_name }}</div>
            <div class="podium-value tabular">{{ formatValue(podium.second) }}</div>
          </div>
          <div class="podium-spot rank-1">
            <div class="crown">👑</div>
            <Avatar :name="podium.first.display_name" :seed="podium.first.user_id" size="lg" />
            <div class="podium-medal">🥇</div>
            <div class="podium-name">{{ podium.first.display_name }}</div>
            <div class="podium-value tabular">{{ formatValue(podium.first) }}</div>
          </div>
          <div class="podium-spot rank-3" v-if="podium.third">
            <Avatar :name="podium.third.display_name" :seed="podium.third.user_id" size="md" />
            <div class="podium-medal">🥉</div>
            <div class="podium-name">{{ podium.third.display_name }}</div>
            <div class="podium-value tabular">{{ formatValue(podium.third) }}</div>
          </div>
        </div>

        <!-- Your-rank banner -->
        <div v-if="yourRank" class="your-rank card">
          <div class="your-rank-num tabular">#{{ yourRank.position }}</div>
          <Avatar
            :name="yourRank.row.display_name"
            :seed="yourRank.row.user_id"
            size="md"
          />
          <div class="your-rank-name">
            <div class="your-rank-label">{{ t('leaderboard.you_rank_label') }}</div>
            <div class="your-rank-display">{{ yourRank.row.display_name }}</div>
          </div>
          <div class="your-rank-value tabular">{{ formatValue(yourRank.row) }}</div>
        </div>

        <!-- Rest of the list (4+) -->
        <div v-if="restRows.length > 0" class="lb-list">
          <div
            v-for="(row, i) in restRows"
            :key="row.user_id"
            class="lb-row"
            :class="{ 'lb-self': isOwn(row) }"
          >
            <div class="lb-rank tabular">{{ i + 4 }}</div>
            <Avatar :name="row.display_name" :seed="row.user_id" size="sm" />
            <div class="lb-name">
              {{ row.display_name }}
              <span v-if="isOwn(row)" class="chip chip-brand lb-you">
                {{ t('leaderboard.you') }}
              </span>
            </div>
            <div class="lb-value tabular">
              <span
                v-if="metric === 'smoke_free' && row.smoke_free_days >= 7"
                class="flame"
                aria-hidden="true"
              >🔥</span>
              {{ formatValue(row) }}
            </div>
          </div>
        </div>

        <div class="bottom-row">
          <span class="muted-line">
            {{ t('leaderboard.metric_help_' + metric) }}
          </span>
          <button class="btn btn-icon" @click="leaderboard.refresh" :aria-label="t('leaderboard.refresh')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>
            </svg>
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import Avatar from './Avatar.vue'
import type { LeaderboardEntry, LeaderboardMetric } from '../types'
import type { UseLeaderboard } from '../composables/useLeaderboard'

interface Props {
  leaderboard: UseLeaderboard | null
  isAuthed: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'open-settings': []
  'open-auth': []
}>()

const { t } = useI18n()
const { user } = useAuth()

const metrics: ReadonlyArray<LeaderboardMetric> = ['smoke_free', 'reduction']
const metric = ref<LeaderboardMetric>('smoke_free')

const rows = computed<LeaderboardEntry[]>(() => {
  if (!props.leaderboard) return []
  return metric.value === 'smoke_free'
    ? props.leaderboard.topSmokeFree.value
    : props.leaderboard.topReduction.value
})

const podium = computed(() => ({
  first: rows.value[0] ?? null,
  second: rows.value[1] ?? null,
  third: rows.value[2] ?? null,
}))

const restRows = computed(() => rows.value.slice(3))

const yourRank = computed(() => {
  const me = user.value?.id
  if (!me) return null
  const idx = rows.value.findIndex((r) => r.user_id === me)
  if (idx < 0) return null
  // Already shown on the podium → don't repeat in the banner.
  if (idx < 3) return null
  return { position: idx + 1, row: rows.value[idx] }
})

function isOwn(row: LeaderboardEntry): boolean {
  return user.value?.id === row.user_id
}

function formatValue(row: LeaderboardEntry): string {
  if (metric.value === 'smoke_free') {
    return t(
      row.smoke_free_days === 1
        ? 'leaderboard.smoke_free_one'
        : 'leaderboard.smoke_free_many',
      { n: row.smoke_free_days }
    )
  }
  return t('leaderboard.reduction_value', {
    pct: row.reduction_pct.toFixed(0),
  })
}
</script>

<style scoped>
.head {
  margin-bottom: 18px;
}

/* Opt-in / gated state */
.opt-in {
  text-align: center;
  padding: 28px 22px;
}
.opt-hero {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 12px;
}
.opt-headline {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}
.opt-body {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 18px;
}
.block {
  width: 100%;
}
.empty {
  text-align: center;
  padding: 40px 20px;
}

/* Animated pill toggle */
.tab-pills {
  position: relative;
  display: flex;
  background: var(--btn-ghost-bg);
  border-radius: var(--radius-pill);
  padding: 4px;
  margin-bottom: 18px;
}
.tab-pill-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  inset-inline-start: 4px;
  background: var(--card);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: calc((100% - 8px) / 2);
}
.tab-pill {
  position: relative;
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted);
  border-radius: var(--radius-pill);
  z-index: 1;
}
.tab-pill.active {
  color: var(--text);
}

/* Podium */
.podium {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  align-items: end;
  gap: 12px;
  padding: 18px 8px;
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  border-radius: var(--radius-card);
  margin-bottom: 18px;
}
.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}
.podium-spot.rank-1 {
  transform: translateY(-12px);
}
.podium-medal {
  font-size: 22px;
  line-height: 1;
}
.podium-spot.rank-1 .podium-medal {
  font-size: 28px;
}
.crown {
  font-size: 18px;
  margin-bottom: 2px;
}
.podium-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.podium-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand);
}

/* Your-rank banner */
.your-rank {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  border: 1.5px solid var(--brand-soft);
}
.your-rank-num {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand);
  min-width: 36px;
}
.your-rank-name {
  flex: 1;
  min-width: 0;
}
.your-rank-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}
.your-rank-display {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.your-rank-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--brand);
}

/* List rows */
.lb-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 18px;
}
.lb-row {
  display: grid;
  grid-template-columns: 28px 28px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}
.lb-row.lb-self {
  background: var(--brand-soft);
  border: 1.5px solid color-mix(in srgb, var(--brand) 30%, transparent);
}
.lb-rank {
  font-weight: 700;
  color: var(--muted);
  font-size: 13px;
}
.lb-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lb-you {
  font-size: 9px;
  padding: 2px 6px;
}
.lb-value {
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 4px;
}
.flame {
  font-size: 14px;
}

.bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.muted-line {
  font-size: 11px;
  color: var(--muted);
  flex: 1;
  line-height: 1.5;
}
.error-line {
  padding: 14px;
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: 14px;
  font-size: 13px;
  text-align: center;
}
</style>
