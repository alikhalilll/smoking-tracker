<template>
  <div class="fade-in lb-view">
    <div class="head" data-onboard="leaderboard-head">
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
        <!-- Top 3 podium -->
        <div v-if="podium.first" class="podium" :class="podiumLayoutClass">
          <!-- 2nd place (start side) — ice particles -->
          <div v-if="podium.second" class="podium-spot rank-2">
            <div class="podium-avatar-wrap medium">
              <span class="fx fx-ice" aria-hidden="true">
                <span class="snow s1"></span>
                <span class="snow s2"></span>
                <span class="snow s3"></span>
                <span class="snow s4"></span>
                <span class="snow s5"></span>
                <span class="snow s6"></span>
              </span>
              <span class="halo halo-ice" aria-hidden="true"></span>
              <Avatar
                :name="podium.second.display_name"
                :seed="podium.second.user_id"
                size="lg"
              />
              <span class="podium-medal silver">{{ formatNumber(2) }}</span>
            </div>
            <div class="podium-name">{{ podium.second.display_name }}</div>
            <div class="podium-score">
              <ScoreIcon />
              <span class="tabular">{{ formatRawValue(podium.second) }}</span>
            </div>
          </div>

          <!-- 1st place (center, biggest) — fire embers + crown -->
          <div class="podium-spot rank-1">
            <span class="crown" aria-hidden="true">👑</span>
            <div class="podium-avatar-wrap big">
              <span class="fx fx-fire" aria-hidden="true">
                <span class="ember e1"></span>
                <span class="ember e2"></span>
                <span class="ember e3"></span>
                <span class="ember e4"></span>
                <span class="ember e5"></span>
                <span class="ember e6"></span>
                <span class="ember e7"></span>
                <span class="ember e8"></span>
              </span>
              <span class="halo halo-fire" aria-hidden="true"></span>
              <Avatar
                :name="podium.first.display_name"
                :seed="podium.first.user_id"
                size="lg"
              />
              <span class="podium-medal gold">{{ formatNumber(1) }}</span>
            </div>
            <div class="podium-name top">{{ podium.first.display_name }}</div>
            <div class="podium-score top">
              <ScoreIcon />
              <span class="tabular">{{ formatRawValue(podium.first) }}</span>
            </div>
          </div>

          <!-- 3rd place (end side) — lightning sparks -->
          <div v-if="podium.third" class="podium-spot rank-3">
            <div class="podium-avatar-wrap medium">
              <span class="fx fx-bolt" aria-hidden="true">
                <span class="spark sp1"></span>
                <span class="spark sp2"></span>
                <span class="spark sp3"></span>
                <span class="spark sp4"></span>
              </span>
              <span class="halo halo-bolt" aria-hidden="true"></span>
              <Avatar
                :name="podium.third.display_name"
                :seed="podium.third.user_id"
                size="lg"
              />
              <span class="podium-medal bronze">{{ formatNumber(3) }}</span>
            </div>
            <div class="podium-name">{{ podium.third.display_name }}</div>
            <div class="podium-score">
              <ScoreIcon />
              <span class="tabular">{{ formatRawValue(podium.third) }}</span>
            </div>
          </div>
        </div>

        <!-- User list (ranks 4+) -->
        <div v-if="restRows.length > 0" class="user-list">
          <div
            v-for="(row, i) in restRows"
            :key="row.user_id"
            class="user-row"
            :class="{
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
            <div class="user-rank" :class="`rc-${(i + 4) % 6}`">{{ formatNumber(i + 4) }}</div>
          </div>
        </div>

        <p class="metric-help">{{ t(`leaderboard.metric_help_${metric}`) }}</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useI18n, formatNumber } from '../i18n'
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
  second: rows.value[1] ?? null,
  third: rows.value[2] ?? null,
}))

const restRows = computed(() => rows.value.slice(3))

// Layout adapts when there aren't 3 users yet — solo centers the
// single user, duo balances 1st + 2nd without an empty 3rd column.
const podiumLayoutClass = computed(() => {
  if (!podium.value.second) return 'podium-solo'
  if (!podium.value.third) return 'podium-duo'
  return ''
})

function isOwn(row: LeaderboardEntry): boolean {
  return user.value?.id === row.user_id
}

function formatRawValue(row: LeaderboardEntry): string {
  if (metric.value === 'smoke_free') return formatNumber(row.smoke_free_days)
  return `${formatNumber(Math.round(row.reduction_pct))}%`
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
  // Pass the rounded percent as a number so interpolate() runs it
  // through the locale's number formatter (Latin → Arabic-Indic).
  return t('leaderboard.reduction_value', {
    pct: Math.round(row.reduction_pct),
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

/* (Floating dots are now global — see App.vue's .ambient-dots) */

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

/* === Top 3 podium === */
.podium {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: end;
  gap: 12px;
  /* Generous bottom padding so the rank-3 spot's translateY(28px)
     doesn't collide with the list below. */
  padding: 28px 4px 64px;
  position: relative;
  z-index: 1;
}
/* Single user — center it horizontally, no empty side columns */
.podium.podium-solo {
  display: flex;
  justify-content: center;
}
.podium.podium-solo .rank-1 {
  transform: none;
  animation-delay: 0s;
}
/* Two users — center them as a balanced pair */
.podium.podium-duo {
  display: flex;
  justify-content: center;
  gap: 28px;
}
.podium-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  position: relative;
  animation: spot-rise 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.podium-spot.rank-2 {
  transform: translateY(16px);
  animation-delay: 0.05s;
}
.podium-spot.rank-1 {
  transform: translateY(-8px);
  animation-delay: 0.18s;
}
.podium-spot.rank-3 {
  transform: translateY(28px);
  animation-delay: 0.28s;
}
@keyframes spot-rise {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.85);
  }
}

/* Crown floats above the 1st-place avatar */
.crown {
  font-size: 36px;
  line-height: 1;
  z-index: 3;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  animation: crown-wiggle 2.6s ease-in-out infinite;
  transform-origin: bottom center;
  margin-bottom: -8px;
}
@keyframes crown-wiggle {
  0%, 100% { transform: rotate(-6deg) translateY(0); }
  25% { transform: rotate(6deg) translateY(-2px); }
  50% { transform: rotate(-3deg) translateY(0); }
  75% { transform: rotate(3deg) translateY(-2px); }
}

.podium-avatar-wrap {
  position: relative;
  display: inline-block;
  border-radius: 50%;
  background: var(--bg);
  padding: 3px;
  z-index: 1;
}
.podium-avatar-wrap.medium :deep(.avatar) {
  width: 64px;
  height: 64px;
  font-size: 20px;
}
.podium-avatar-wrap.big :deep(.avatar) {
  width: 92px;
  height: 92px;
  font-size: 30px;
  border: 3px solid var(--card);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
}
.podium-avatar-wrap.big {
  animation: avatar-bob 3.2s ease-in-out infinite;
}
@keyframes avatar-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.podium-medal {
  position: absolute;
  bottom: -4px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  font-weight: 800;
  font-size: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--bg);
  z-index: 2;
}
.podium-avatar-wrap.big .podium-medal {
  width: 30px;
  height: 30px;
  font-size: 14px;
}
.podium-medal.gold {
  background: linear-gradient(180deg, #ffd874, #d99738);
  color: #4a2c00;
  box-shadow: 0 4px 10px rgba(217, 151, 56, 0.45);
}
.podium-medal.silver {
  background: linear-gradient(180deg, #e8eaed, #9aa0aa);
  color: #2a2c33;
}
.podium-medal.bronze {
  background: linear-gradient(180deg, #d99764, #a05a2a);
  color: #2a1808;
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
.podium-name.top {
  font-size: 14px;
  font-weight: 700;
}

.podium-score {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 5px;
  border-radius: var(--radius-pill);
  background: var(--surface-tint);
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
}
.podium-score.top {
  background: linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to));
  color: #fff;
  box-shadow: var(--brand-shadow);
  font-size: 13px;
  padding: 5px 12px 5px 6px;
  animation: pill-pulse 2.4s ease-in-out infinite;
}
@keyframes pill-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.score-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.22);
  color: currentColor;
  border-radius: 5px;
}
.podium-score:not(.top) .score-icon {
  background: var(--brand);
  color: #fff;
}

/* === Real particle effects per rank ===
   Each rank's avatar is wrapped in an .fx layer that holds many
   absolutely-positioned spans. Pure CSS, GPU-only transforms. */
.fx {
  position: absolute;
  inset: -24px;
  pointer-events: none;
  z-index: 4;
  overflow: visible;
}

/* --- 1st place: rising fire embers + flicker glow --- */
.fx-fire .ember {
  position: absolute;
  bottom: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 30%,
    #ffe7a8 0%,
    #ff9b3d 35%,
    #ff4d22 70%,
    transparent 100%
  );
  filter: blur(0.5px);
  opacity: 0;
  animation: ember-rise 1.6s ease-out infinite;
  mix-blend-mode: screen;
}
.fx-fire .e1 { left: 18%; --x: -8px;  animation-delay: 0s;     width: 9px;  height: 9px; }
.fx-fire .e2 { left: 32%; --x: 6px;   animation-delay: 0.18s;  width: 7px;  height: 7px; }
.fx-fire .e3 { left: 46%; --x: -4px;  animation-delay: 0.42s;  width: 10px; height: 10px; }
.fx-fire .e4 { left: 60%; --x: 8px;   animation-delay: 0.62s;  width: 6px;  height: 6px; }
.fx-fire .e5 { left: 74%; --x: -10px; animation-delay: 0.85s;  width: 8px;  height: 8px; }
.fx-fire .e6 { left: 24%; --x: 12px;  animation-delay: 1.05s;  width: 7px;  height: 7px; }
.fx-fire .e7 { left: 52%; --x: -6px;  animation-delay: 1.25s;  width: 9px;  height: 9px; }
.fx-fire .e8 { left: 68%; --x: 4px;   animation-delay: 1.45s;  width: 6px;  height: 6px; }
@keyframes ember-rise {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.6);
  }
  15% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(var(--x, 0), -110px) scale(0.3);
  }
}

/* --- 2nd place: drifting snowflakes --- */
.fx-ice .snow {
  position: absolute;
  top: -16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #ffffff 0%,
    #d8eeff 60%,
    transparent 100%
  );
  box-shadow: 0 0 4px rgba(180, 220, 255, 0.7);
  opacity: 0;
  animation: snow-fall 4s linear infinite;
}
.fx-ice .s1 { left: 14%; --rot: -180deg; animation-delay: 0s;     width: 5px; height: 5px; }
.fx-ice .s2 { left: 28%; --rot: 220deg;  animation-delay: 0.6s;   width: 7px; height: 7px; }
.fx-ice .s3 { left: 42%; --rot: -160deg; animation-delay: 1.2s;   width: 4px; height: 4px; }
.fx-ice .s4 { left: 60%; --rot: 200deg;  animation-delay: 1.8s;   width: 6px; height: 6px; }
.fx-ice .s5 { left: 74%; --rot: -240deg; animation-delay: 2.4s;   width: 5px; height: 5px; }
.fx-ice .s6 { left: 86%; --rot: 180deg;  animation-delay: 3.0s;   width: 7px; height: 7px; }
@keyframes snow-fall {
  0% {
    opacity: 0;
    transform: translateY(0) translateX(0) rotate(0);
  }
  10% { opacity: 1; }
  50% {
    transform: translateY(60px) translateX(8px) rotate(calc(var(--rot) / 2));
  }
  90% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translateY(120px) translateX(-8px) rotate(var(--rot));
  }
}

/* --- 3rd place: flashing electric sparks --- */
.fx-bolt .spark {
  position: absolute;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, #fff5c4, #fbbf24);
  box-shadow:
    0 0 6px rgba(251, 191, 36, 0.9),
    0 0 18px rgba(251, 191, 36, 0.55);
  opacity: 0;
}
.fx-bolt .sp1 {
  top: -12px;
  left: 20%;
  height: 28px;
  transform: rotate(-18deg);
  animation: spark-flash 1.8s steps(1, end) infinite;
}
.fx-bolt .sp2 {
  top: 8px;
  left: 78%;
  height: 22px;
  transform: rotate(20deg);
  animation: spark-flash 1.8s steps(1, end) infinite 0.45s;
}
.fx-bolt .sp3 {
  top: 40px;
  left: 30%;
  height: 18px;
  transform: rotate(12deg);
  animation: spark-flash 1.8s steps(1, end) infinite 0.9s;
}
.fx-bolt .sp4 {
  top: 30px;
  left: 65%;
  height: 24px;
  transform: rotate(-25deg);
  animation: spark-flash 1.8s steps(1, end) infinite 1.35s;
}
@keyframes spark-flash {
  0%, 92%, 100% { opacity: 0; }
  3%, 8%        { opacity: 1; }
  4%            { opacity: 0; }
  6%            { opacity: 1; }
}

/* Halos behind avatars */
.halo {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}
.halo-fire {
  background: radial-gradient(circle, rgba(255, 122, 61, 0.55), rgba(255, 200, 100, 0.25) 50%, transparent 70%);
  animation: halo-fire-pulse 1.4s ease-in-out infinite;
}
.halo-ice {
  background: radial-gradient(circle, rgba(120, 200, 255, 0.45), rgba(180, 220, 255, 0.18) 55%, transparent 75%);
  animation: halo-ice-pulse 3s ease-in-out infinite;
}
.halo-bolt {
  background: radial-gradient(circle, rgba(251, 191, 36, 0.45), rgba(255, 220, 130, 0.18) 50%, transparent 72%);
  animation: halo-bolt-pulse 2.8s steps(1, end) infinite;
}
@keyframes halo-fire-pulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.18); opacity: 1; }
}
@keyframes halo-ice-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.10); opacity: 1; }
}
@keyframes halo-bolt-pulse {
  0%, 80%, 100% { transform: scale(1); opacity: 0.6; }
  82%, 92% { transform: scale(1.2); opacity: 1; }
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
