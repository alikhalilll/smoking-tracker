<template>
  <div class="fade-in lb-view">
    <div class="head">
      <h1 class="lb-headline">{{ t('leaderboard.title') }}</h1>
      <p class="lb-subhead">{{ t(`leaderboard.metric_help_${metric}`) }}</p>
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
        <div v-for="i in 4" :key="i" class="lb-row skeleton-row">
          <span class="skeleton" style="width: 28px; height: 28px; border-radius: 50%"></span>
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
        <!-- Podium card -->
        <div v-if="podium.first" class="podium-card">
          <span class="podium-decor podium-decor-a"></span>
          <span class="podium-decor podium-decor-b"></span>

          <div class="podium-grid">
            <!-- 2nd -->
            <div v-if="podium.second" class="podium-spot rank-2">
              <div class="podium-avatar-wrap">
                <Avatar
                  :name="podium.second.display_name"
                  :seed="podium.second.user_id"
                  size="md"
                />
                <span class="rank-badge silver">2</span>
              </div>
              <div class="podium-name">{{ podium.second.display_name }}</div>
              <div class="podium-value tabular">{{ formatValue(podium.second) }}</div>
              <div class="podium-pillar pillar-2"></div>
            </div>

            <!-- 1st (centered, taller) -->
            <div class="podium-spot rank-1">
              <div class="crown" aria-hidden="true">👑</div>
              <div class="podium-avatar-wrap top">
                <span class="avatar-glow"></span>
                <Avatar
                  :name="podium.first.display_name"
                  :seed="podium.first.user_id"
                  size="lg"
                />
                <span class="rank-badge gold">1</span>
              </div>
              <div class="podium-name top-name">{{ podium.first.display_name }}</div>
              <div class="podium-value top-value tabular">{{ formatValue(podium.first) }}</div>
              <div class="podium-pillar pillar-1"></div>
            </div>

            <!-- 3rd -->
            <div v-if="podium.third" class="podium-spot rank-3">
              <div class="podium-avatar-wrap">
                <Avatar
                  :name="podium.third.display_name"
                  :seed="podium.third.user_id"
                  size="md"
                />
                <span class="rank-badge bronze">3</span>
              </div>
              <div class="podium-name">{{ podium.third.display_name }}</div>
              <div class="podium-value tabular">{{ formatValue(podium.third) }}</div>
              <div class="podium-pillar pillar-3"></div>
            </div>
          </div>
        </div>

        <!-- Your-rank hero (when out of the podium) -->
        <div v-if="yourRank" class="your-card">
          <div class="your-rank tabular">#{{ yourRank.position }}</div>
          <Avatar
            :name="yourRank.row.display_name"
            :seed="yourRank.row.user_id"
            size="md"
          />
          <div class="your-name">
            <div class="your-label">{{ t('leaderboard.you_rank_label') }}</div>
            <div class="your-display">{{ yourRank.row.display_name }}</div>
          </div>
          <div class="your-value tabular">{{ formatValue(yourRank.row) }}</div>
        </div>

        <!-- Rest of the list (4+) -->
        <div v-if="restRows.length > 0" class="lb-list">
          <div
            v-for="(row, i) in restRows"
            :key="row.user_id"
            class="lb-row"
            :class="{ 'lb-self': isOwn(row) }"
            :style="{ animationDelay: i * 0.04 + 's' }"
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
.lb-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.head {
  margin-bottom: 4px;
}
.lb-headline {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}
.lb-subhead {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

/* Opt-in / gated state */
.opt-in {
  text-align: center;
  padding: 32px 22px;
}
.opt-hero {
  font-size: 56px;
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
.block { width: 100%; }
.empty {
  text-align: center;
  padding: 44px 20px;
}

/* Animated pill toggle */
.tab-pills {
  position: relative;
  display: flex;
  background: var(--btn-ghost-bg);
  border-radius: var(--radius-pill);
  padding: 4px;
  margin-bottom: 4px;
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
  padding: 11px 12px;
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
.podium-card {
  position: relative;
  background: linear-gradient(
    160deg,
    var(--brand-grad-from),
    var(--accent) 90%
  );
  border-radius: 28px;
  padding: 24px 18px 16px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(255, 122, 61, 0.22),
              0 4px 12px rgba(124, 92, 255, 0.15);
}
.podium-decor {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  filter: blur(20px);
  pointer-events: none;
}
.podium-decor-a {
  width: 200px;
  height: 200px;
  top: -80px;
  inset-inline-start: -60px;
}
.podium-decor-b {
  width: 160px;
  height: 160px;
  bottom: -60px;
  inset-inline-end: -50px;
}

.podium-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 8px;
}
.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  position: relative;
}
.podium-spot.rank-1 {
  transform: translateY(-4px);
}
.podium-avatar-wrap {
  position: relative;
  display: inline-block;
}
.podium-avatar-wrap.top :deep(.avatar) {
  border: 3px solid #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}
.avatar-glow {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 116, 0.45), transparent 70%);
  z-index: -1;
  animation: pulse-glow 2.4s ease-in-out infinite;
}
.crown {
  font-size: 24px;
  margin-bottom: -4px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  animation: pop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s both;
}
.rank-badge {
  position: absolute;
  bottom: -4px;
  inset-inline-end: -4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #5b3a00;
  border: 2px solid #fff;
}
.rank-badge.gold {
  background: linear-gradient(180deg, #ffd874, #f59e0b);
  width: 26px;
  height: 26px;
  font-size: 12px;
}
.rank-badge.silver {
  background: linear-gradient(180deg, #e8eaed, #b0b6c0);
  color: #2c2f33;
}
.rank-badge.bronze {
  background: linear-gradient(180deg, #d99764, #a05a2a);
  color: #2c1a0a;
}
.podium-name {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}
.top-name {
  font-size: 13px;
  font-weight: 700;
}
.podium-value {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}
.top-value {
  font-size: 12px;
  color: #fff;
}

/* Pillars under each podium spot */
.podium-pillar {
  width: 100%;
  border-radius: 12px 12px 0 0;
  background: rgba(255, 255, 255, 0.18);
  margin-top: 6px;
}
.pillar-1 {
  height: 56px;
  background: rgba(255, 255, 255, 0.28);
}
.pillar-2 {
  height: 38px;
}
.pillar-3 {
  height: 26px;
}

/* Your-rank hero card */
.your-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--card);
  border: 1.5px solid color-mix(in srgb, var(--brand) 35%, transparent);
  box-shadow: 0 4px 16px rgba(255, 122, 61, 0.12);
}
.your-rank {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand);
  min-width: 40px;
}
.your-name {
  flex: 1;
  min-width: 0;
}
.your-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 700;
}
.your-display {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.your-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--brand);
}

/* List rows */
.lb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lb-row {
  display: grid;
  grid-template-columns: 28px 28px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  animation: slideUp 0.32s ease-out both;
}
.lb-row.lb-self {
  background: var(--brand-soft);
  border: 1.5px solid color-mix(in srgb, var(--brand) 35%, transparent);
  box-shadow: 0 4px 12px rgba(255, 122, 61, 0.12);
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
  filter: drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3));
}

.skeleton-row {
  background: var(--card);
  box-shadow: none;
  animation: none;
}

.bottom-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 4px;
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
