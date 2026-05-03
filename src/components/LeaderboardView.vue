<template>
  <div class="fade-in lb-view">
    <!-- Floating decorative dots — pure CSS animated background -->
    <div class="dots" aria-hidden="true">
      <span class="dot dot-1"></span>
      <span class="dot dot-2"></span>
      <span class="dot dot-3"></span>
      <span class="dot dot-4"></span>
      <span class="dot dot-5"></span>
      <span class="dot dot-6"></span>
    </div>

    <div class="head">
      <h1 class="lb-headline">
        {{ t('leaderboard.title') }}
        <span class="trophy" aria-hidden="true">🏆</span>
      </h1>
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

    <!-- Signed in but not yet opted in — inline join form -->
    <div
      v-else-if="!leaderboard.prefs.value.optedIn"
      class="card opt-in"
    >
      <div class="opt-hero">🌱</div>
      <h2 class="opt-headline">{{ t('leaderboard.opt_in_headline') }}</h2>
      <p class="opt-body">{{ t('leaderboard.opt_in_body') }}</p>

      <div class="join-form">
        <input
          v-model="joinName"
          type="text"
          maxlength="30"
          class="field-input"
          :placeholder="t('leaderboard_settings.display_name_placeholder')"
          :disabled="joining"
          @keydown.enter="onJoin"
        />
        <button
          class="btn btn-primary block"
          :disabled="!joinName.trim() || joining"
          @click="onJoin"
        >
          <span v-if="joining" class="spinner"></span>
          {{ joining ? t('cloud.sending') : t('leaderboard.join_btn') }}
        </button>
      </div>
    </div>

    <template v-else>
      <!-- Metric pills -->
      <div class="filter-pills">
        <button
          v-for="m in metrics"
          :key="m"
          class="filter-pill"
          :class="{ active: metric === m }"
          @click="metric = m"
        >
          {{ t(`leaderboard.metric_${m}`) }}
        </button>
      </div>

      <!-- Loading skeletons -->
      <div v-if="leaderboard.loading.value && rows.length === 0" class="user-list">
        <div v-for="i in 4" :key="i" class="user-row skeleton-row">
          <span class="skeleton" style="width: 44px; height: 44px; border-radius: 50%"></span>
          <span class="skeleton" style="height: 16px; flex: 1"></span>
          <span class="skeleton" style="width: 32px; height: 32px; border-radius: 50%"></span>
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
        <!-- Featured #1 -->
        <div v-if="podium.first" class="featured">
          <div class="crown-area">
            <span class="crown" aria-hidden="true">👑</span>
            <div class="featured-avatar-wrap">
              <Avatar
                :name="podium.first.display_name"
                :seed="podium.first.user_id"
                size="lg"
              />
              <span class="featured-medal">1</span>
            </div>
          </div>
          <h2 class="featured-name">{{ podium.first.display_name }}</h2>
          <div class="featured-pill">
            <ScoreIcon />
            <span class="tabular">{{ formatRawValue(podium.first) }}</span>
          </div>
        </div>

        <!-- User list (ranks 2+) -->
        <div class="user-list">
          <div
            v-for="(row, i) in restAfterFirst"
            :key="row.user_id"
            class="user-row"
            :class="{
              'user-row-highlight': i === 0 && !isOwn(row),
              'user-row-self': isOwn(row),
            }"
            :style="{ animationDelay: `${0.06 * i}s` }"
          >
            <Avatar :name="row.display_name" :seed="row.user_id" size="md" />
            <div class="user-info">
              <div class="user-name">
                {{ row.display_name }}
                <span v-if="isOwn(row)" class="chip chip-brand list-you">
                  {{ t('leaderboard.you') }}
                </span>
              </div>
              <div class="user-sub tabular">
                {{ formattedSub(row) }}
              </div>
            </div>
            <div class="user-rank" :class="`rc-${(i + 2) % 6}`">{{ i + 2 }}</div>
          </div>
        </div>

        <p class="metric-help">{{ t(`leaderboard.metric_help_${metric}`) }}</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
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

const ScoreIcon = () =>
  h(
    'span',
    { class: 'score-icon', 'aria-hidden': 'true' },
    [
      h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
        [
          h('path', {
            d: 'M14 4s2 4 0 8-6 4-6 8a4 4 0 0 0 8 0c0-3-2-5-2-7 0-2 2-4 0-9z',
          }),
        ]
      ),
    ]
  )

const rows = computed<LeaderboardEntry[]>(() => {
  if (!props.leaderboard) return []
  return metric.value === 'smoke_free'
    ? props.leaderboard.topSmokeFree.value
    : props.leaderboard.topReduction.value
})

const podium = computed(() => ({
  first: rows.value[0] ?? null,
}))

const restAfterFirst = computed(() => rows.value.slice(1))

function isOwn(row: LeaderboardEntry): boolean {
  return user.value?.id === row.user_id
}

function formatRawValue(row: LeaderboardEntry): string {
  if (metric.value === 'smoke_free') return String(row.smoke_free_days)
  return `${row.reduction_pct.toFixed(0)}%`
}

function formattedSub(row: LeaderboardEntry): string {
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

const joinName = ref(props.leaderboard?.prefs.value.displayName ?? '')
const joining = ref(false)

async function onJoin(): Promise<void> {
  const name = joinName.value.trim()
  if (!name || !props.leaderboard) return
  joining.value = true
  props.leaderboard.setDisplayName(name)
  await props.leaderboard.setOptIn(true)
  joining.value = false
}
</script>

<style scoped>
.lb-view {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Make sure the dots that drift outside the card stay visible */
  overflow: visible;
}

/* === Floating decorative dots — heavy ambient motion === */
.dots {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.dot {
  position: absolute;
  border-radius: 50%;
  opacity: 0.7;
}
.dot-1 {
  width: 14px;
  height: 14px;
  background: var(--brand);
  top: 8%;
  inset-inline-start: 78%;
  animation: drift-1 9s ease-in-out infinite;
}
.dot-2 {
  width: 10px;
  height: 10px;
  background: var(--accent);
  top: 18%;
  inset-inline-start: 8%;
  animation: drift-2 11s ease-in-out infinite;
}
.dot-3 {
  width: 22px;
  height: 22px;
  background: color-mix(in srgb, var(--success) 80%, transparent);
  top: 36%;
  inset-inline-start: 88%;
  animation: drift-3 13s ease-in-out infinite;
}
.dot-4 {
  width: 16px;
  height: 16px;
  background: color-mix(in srgb, var(--accent-warm) 80%, transparent);
  top: 56%;
  inset-inline-start: 4%;
  animation: drift-1 10s ease-in-out infinite reverse;
}
.dot-5 {
  width: 8px;
  height: 8px;
  background: var(--brand);
  top: 70%;
  inset-inline-start: 70%;
  animation: drift-2 8s ease-in-out infinite;
}
.dot-6 {
  width: 12px;
  height: 12px;
  background: var(--accent);
  top: 88%;
  inset-inline-start: 28%;
  animation: drift-3 12s ease-in-out infinite reverse;
}

@keyframes drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
  50% { transform: translate(-18px, 28px) scale(1.2); opacity: 1; }
}
@keyframes drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  50% { transform: translate(24px, -18px) scale(0.85); opacity: 0.9; }
}
@keyframes drift-3 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
  50% { transform: translate(-12px, -28px) scale(1.15); opacity: 1; }
}

.head,
.featured,
.filter-pills,
.user-list,
.metric-help,
.opt-in,
.empty {
  position: relative;
  z-index: 1;
}

.head {
  text-align: center;
}
.lb-headline {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
.trophy {
  font-size: 22px;
  animation: trophy-spin 4s ease-in-out infinite;
  display: inline-block;
}
@keyframes trophy-spin {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(12deg); }
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

/* Filter pills */
.filter-pills {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 4px 0;
  flex-wrap: wrap;
}
.filter-pill {
  appearance: none;
  border: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 9px 18px;
  border-radius: var(--radius-pill);
  background: var(--btn-ghost-bg);
  color: var(--muted);
  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.filter-pill.active {
  background: var(--text);
  color: var(--bg);
  box-shadow: var(--shadow-sm);
}
.filter-pill:active { transform: scale(0.97); }

/* === Featured #1 === */
.featured {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 0 18px;
  animation: featured-rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes featured-rise {
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.92);
  }
}
.crown-area {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.crown {
  font-size: 44px;
  line-height: 1;
  margin-bottom: -10px;
  z-index: 2;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  animation: crown-wiggle 2.6s ease-in-out infinite;
  transform-origin: bottom center;
}
@keyframes crown-wiggle {
  0%, 100% { transform: rotate(-6deg) translateY(0); }
  25% { transform: rotate(6deg) translateY(-2px); }
  50% { transform: rotate(-3deg) translateY(0); }
  75% { transform: rotate(3deg) translateY(-2px); }
}
.featured-avatar-wrap {
  position: relative;
  animation: avatar-bob 3.2s ease-in-out infinite;
}
@keyframes avatar-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.featured-avatar-wrap :deep(.avatar) {
  width: 110px;
  height: 110px;
  font-size: 38px;
  border: 4px solid var(--card);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}
.featured-medal {
  position: absolute;
  bottom: -4px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #ffd874, #d99738);
  color: #4a2c00;
  font-weight: 800;
  font-size: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--bg);
  box-shadow: 0 4px 10px rgba(217, 151, 56, 0.4);
}
.featured-name {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-align: center;
}
.featured-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px 8px 8px;
  border-radius: var(--radius-pill);
  background: var(--success-soft);
  color: var(--success);
  font-size: 14px;
  font-weight: 700;
  animation: pill-pulse 2.4s ease-in-out infinite;
}
@keyframes pill-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
.score-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  background: var(--success);
  color: #fff;
  border-radius: 7px;
}

/* === User list rows === */
.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 22px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  animation: row-slide 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transition: transform 0.15s ease;
}
.user-row:active {
  transform: scale(0.98);
}
@keyframes row-slide {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}
.user-row-highlight {
  background: #ffffff;
  color: #15171a;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.user-row-highlight .user-name {
  color: #15171a;
}
.user-row-highlight .user-sub {
  color: rgba(20, 20, 24, 0.55);
}
.user-row-self {
  border: 1.5px solid color-mix(in srgb, var(--brand) 45%, transparent);
}

.user-row :deep(.avatar) {
  width: 44px;
  height: 44px;
  font-size: 14px;
  flex-shrink: 0;
  border: 2px solid var(--card);
}

.user-info {
  flex: 1;
  min-width: 0;
}
.user-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
  font-weight: 500;
}
.list-you {
  font-size: 9px;
  padding: 2px 6px;
}

/* Colored rank circle on the right (cycles through pastel colors) */
.user-rank {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
}
.rc-0 { background: #c5b8ff; color: #2a1f5c; }   /* lavender */
.rc-1 { background: #ffd874; color: #5a3e00; }   /* yellow */
.rc-2 { background: #b8e1ff; color: #0a3a66; }   /* sky */
.rc-3 { background: #c2efd2; color: #14442a; }   /* mint */
.rc-4 { background: #ffc6a8; color: #5c2200; }   /* peach */
.rc-5 { background: #f8b6ff; color: #5c1058; }   /* pink */

.metric-help {
  margin-top: 4px;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
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

.skeleton-row {
  background: var(--card);
  box-shadow: none;
}

/* Join form (kept) */
.join-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: start;
}
.join-form .field-input {
  text-align: center;
  font-weight: 600;
}
</style>
