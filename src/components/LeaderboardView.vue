<template>
  <div class="fade-in lb-view">
    <div class="head">
      <h1 class="lb-headline">{{ t('leaderboard.title') }}</h1>
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
      <!-- Filter / metric pills (Worldwide-style) -->
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
      <div v-if="leaderboard.loading.value && rows.length === 0" class="list-card">
        <div v-for="i in 4" :key="i" class="list-row skeleton-row">
          <span class="skeleton" style="width: 24px; height: 14px"></span>
          <span class="skeleton" style="width: 36px; height: 36px; border-radius: 50%"></span>
          <span class="skeleton" style="height: 14px; flex: 1"></span>
          <span class="skeleton" style="height: 24px; width: 64px; border-radius: 8px"></span>
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
        <!-- Podium scene: floating avatars + 3D blocks -->
        <div v-if="podium.first" class="podium-scene">
          <!-- Avatars float above the blocks; absolute-positioned to span the row -->
          <div class="podium-avatars">
            <div v-if="podium.second" class="ava-spot rank-2">
              <span class="aura aura-ice" aria-hidden="true">❄️</span>
              <div class="avatar-frame">
                <span class="halo halo-ice" aria-hidden="true"></span>
                <Avatar
                  :name="podium.second.display_name"
                  :seed="podium.second.user_id"
                  size="lg"
                />
                <span class="rank-coin silver">2</span>
              </div>
              <div class="ava-name">{{ podium.second.display_name }}</div>
              <div class="score-pill">
                <ScoreIcon />
                <span class="tabular">{{ formatRawValue(podium.second) }}</span>
              </div>
            </div>

            <div class="ava-spot rank-1">
              <span class="aura aura-fire" aria-hidden="true">🔥</span>
              <div class="avatar-frame avatar-frame-top">
                <span class="halo halo-fire" aria-hidden="true"></span>
                <Avatar
                  :name="podium.first.display_name"
                  :seed="podium.first.user_id"
                  size="lg"
                />
                <span class="rank-coin gold">1</span>
              </div>
              <div class="ava-name">{{ podium.first.display_name }}</div>
              <div class="score-pill">
                <ScoreIcon />
                <span class="tabular">{{ formatRawValue(podium.first) }}</span>
              </div>
            </div>

            <div v-if="podium.third" class="ava-spot rank-3">
              <span class="aura aura-bolt" aria-hidden="true">⚡</span>
              <div class="avatar-frame">
                <span class="halo halo-bolt" aria-hidden="true"></span>
                <Avatar
                  :name="podium.third.display_name"
                  :seed="podium.third.user_id"
                  size="lg"
                />
                <span class="rank-coin bronze">3</span>
              </div>
              <div class="ava-name">{{ podium.third.display_name }}</div>
              <div class="score-pill">
                <ScoreIcon />
                <span class="tabular">{{ formatRawValue(podium.third) }}</span>
              </div>
            </div>
          </div>

          <!-- 3D blocks underneath -->
          <div class="podium-blocks">
            <div class="block block-2"><span>2</span></div>
            <div class="block block-1"><span>1</span></div>
            <div class="block block-3"><span>3</span></div>
          </div>
        </div>

        <!-- List card -->
        <div v-if="restRows.length > 0" class="list-card">
          <div
            v-for="(row, i) in restRows"
            :key="row.user_id"
            class="list-row"
            :class="{ 'list-self': isOwn(row) }"
          >
            <div class="list-rank tabular">{{ i + 4 }}</div>
            <Avatar :name="row.display_name" :seed="row.user_id" size="md" />
            <div class="list-name">
              <span>{{ row.display_name }}</span>
              <span
                v-if="metric === 'smoke_free' && row.smoke_free_days >= 7"
                class="flame-tag"
                aria-hidden="true"
              >🔥</span>
            </div>
            <div class="score-pill score-pill-row">
              <ScoreIcon />
              <span class="tabular">{{ formatRawValue(row) }}</span>
            </div>
          </div>
        </div>

        <!-- Your-rank pinned at the bottom (if out of top of the list) -->
        <div v-if="yourRank" class="your-pin">
          <div class="list-rank tabular">{{ yourRank.position }}</div>
          <Avatar
            :name="yourRank.row.display_name"
            :seed="yourRank.row.user_id"
            size="md"
          />
          <div class="list-name">
            <span>{{ yourRank.row.display_name }}</span>
            <span class="chip chip-brand list-you">{{ t('leaderboard.you') }}</span>
          </div>
          <div class="score-pill score-pill-row">
            <ScoreIcon />
            <span class="tabular">{{ formatRawValue(yourRank.row) }}</span>
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

// Score-pill icon (a small flame-ish glyph in a rounded box, similar to
// the "T coin" in the reference shot but tied to the app's theme).
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

const yourRank = computed(() => {
  const me = user.value?.id
  if (!me) return null
  const idx = rows.value.findIndex((r) => r.user_id === me)
  if (idx < 0) return null
  // Already shown in podium or top-N list above
  if (idx < 3) return null
  if (idx < 3 + restRows.value.length) return null
  return { position: idx + 1, row: rows.value[idx] }
})

function isOwn(row: LeaderboardEntry): boolean {
  return user.value?.id === row.user_id
}

function formatRawValue(row: LeaderboardEntry): string {
  if (metric.value === 'smoke_free') return String(row.smoke_free_days)
  return `${row.reduction_pct.toFixed(0)}%`
}

// Inline opt-in form — set display name and join in one tap, no need
// to bounce through Settings.
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.head {
  text-align: center;
  margin-bottom: 4px;
}
.lb-headline {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
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

/* Filter pills (matches the reference: white active, soft-grey inactive) */
.filter-pills {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 0 8px;
  scrollbar-width: none;
}
.filter-pills::-webkit-scrollbar {
  display: none;
}
.filter-pill {
  flex-shrink: 0;
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

/* === Podium scene === */
.podium-scene {
  position: relative;
  padding: 16px 8px 8px;
  margin: 4px 0 0;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--brand) 14%, transparent),
    color-mix(in srgb, var(--accent) 12%, transparent) 70%,
    color-mix(in srgb, var(--success) 10%, transparent)
  );
  border-radius: 28px;
  overflow: hidden;
}
.podium-scene::before,
.podium-scene::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(36px);
  pointer-events: none;
  opacity: 0.55;
}
.podium-scene::before {
  width: 220px;
  height: 220px;
  background: var(--brand);
  top: -100px;
  inset-inline-start: -60px;
}
.podium-scene::after {
  width: 180px;
  height: 180px;
  background: var(--accent);
  bottom: -80px;
  inset-inline-end: -50px;
}

.podium-avatars {
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  align-items: end;
  gap: 8px;
  position: relative;
  z-index: 2;
  /* Pull avatars down so they overlap the top of the blocks */
  margin-bottom: -28px;
}
.ava-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  animation: spot-rise 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.ava-spot.rank-1 {
  /* Lift 1st higher than the rest */
  transform: translateY(-22px);
  animation-delay: 0.18s;
}
.ava-spot.rank-2 {
  transform: translateY(8px);
  animation-delay: 0.05s;
}
.ava-spot.rank-3 {
  transform: translateY(20px);
  animation-delay: 0.28s;
}
@keyframes spot-rise {
  from {
    opacity: 0;
    /* Start a little lower than the resting position */
    transform: translateY(40px) scale(0.85);
  }
}

.avatar-frame {
  position: relative;
  display: inline-block;
  border-radius: 50%;
  background: var(--bg);
  padding: 3px;
  z-index: 1;
}

/* === Elemental aura emojis floating above each podium spot === */
.aura {
  position: absolute;
  top: -22px;
  font-size: 22px;
  line-height: 1;
  pointer-events: none;
  z-index: 3;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}
.aura-fire {
  font-size: 28px;
  top: -32px;
  animation: flame-flicker 1.4s ease-in-out infinite;
  transform-origin: bottom center;
}
.aura-ice {
  animation: ice-float 3s ease-in-out infinite;
}
.aura-bolt {
  animation: bolt-zap 2.8s steps(1, end) infinite;
}

@keyframes flame-flicker {
  0%, 100% { transform: scale(1) rotate(-2deg); opacity: 1; }
  20% { transform: scale(1.08) rotate(2deg); opacity: 0.92; }
  40% { transform: scale(0.95) rotate(-1deg); opacity: 1; }
  60% { transform: scale(1.05) rotate(1deg); opacity: 0.95; }
  80% { transform: scale(0.98) rotate(-2deg); opacity: 1; }
}
@keyframes ice-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-6px) rotate(20deg); }
}
@keyframes bolt-zap {
  0%, 80%, 100% { transform: scale(1); opacity: 0.6; }
  82%, 92% { transform: scale(1.25); opacity: 1; }
  86% { transform: scale(1.4); opacity: 1; filter: brightness(1.4); }
}

/* === Halos behind the avatars (the colored "energy" of each rank) === */
.halo {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}
.halo-fire {
  background: radial-gradient(
    circle,
    rgba(255, 122, 61, 0.55),
    rgba(255, 200, 100, 0.25) 50%,
    transparent 70%
  );
  animation: halo-fire-pulse 1.4s ease-in-out infinite;
}
.halo-ice {
  background: radial-gradient(
    circle,
    rgba(120, 200, 255, 0.45),
    rgba(180, 220, 255, 0.18) 55%,
    transparent 75%
  );
  animation: halo-ice-pulse 3s ease-in-out infinite;
}
.halo-bolt {
  background: radial-gradient(
    circle,
    rgba(251, 191, 36, 0.45),
    rgba(255, 220, 130, 0.18) 50%,
    transparent 72%
  );
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
.avatar-frame-top {
  /* Subtle glow under the 1st-place avatar */
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08),
              0 8px 24px rgba(255, 215, 116, 0.25);
}
.avatar-frame :deep(.avatar) {
  width: 56px;
  height: 56px;
  font-size: 18px;
  border: 2px solid color-mix(in srgb, var(--bg) 70%, transparent);
}
.avatar-frame :deep(.avatar-lg) {
  width: 56px;
  height: 56px;
  font-size: 18px;
}
.ava-spot.rank-1 .avatar-frame :deep(.avatar) {
  width: 72px;
  height: 72px;
  font-size: 22px;
}

.rank-coin {
  position: absolute;
  top: -2px;
  inset-inline-end: -2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #2c1a0a;
  border: 2px solid var(--bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
.rank-coin.gold {
  background: linear-gradient(180deg, #ffd874, #d99738);
  color: #4a2c00;
}
.rank-coin.silver {
  background: linear-gradient(180deg, #e8eaed, #b0b6c0);
  color: #2c2f33;
}
.rank-coin.bronze {
  background: linear-gradient(180deg, #d99764, #a05a2a);
  color: #2c1a0a;
}

.ava-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ava-spot.rank-1 .ava-name {
  font-size: 13px;
  font-weight: 700;
  max-width: 110px;
}

/* Score pill — vivid gradient on the podium, subtle tint inside list rows */
.score-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px 5px 6px;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: var(--brand-shadow);
  white-space: nowrap;
}
.score-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  color: #fff;
}
.score-pill-row {
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: none;
}
.score-pill-row .score-icon {
  background: var(--brand);
  color: #fff;
}

/* === 3D-ish podium blocks — each rank gets its own metallic tint === */
.podium-blocks {
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  align-items: end;
  gap: 8px;
  position: relative;
  z-index: 1;
}
.block {
  position: relative;
  border-radius: 16px 16px 6px 6px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -2px 0 rgba(0, 0, 0, 0.10),
    0 12px 20px rgba(0, 0, 0, 0.10);
  animation: block-grow 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transform-origin: bottom center;
}
.block::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 20px;
  border-radius: 16px 16px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.22), transparent);
  pointer-events: none;
}
.block span {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.block-1 {
  height: 130px;
  background: linear-gradient(180deg, #ffd874, #d99738);
  animation-delay: 0.18s;
}
.block-1 span { color: rgba(74, 44, 0, 0.55); }
.block-2 {
  height: 92px;
  background: linear-gradient(180deg, #e8eaed, #9aa0aa);
  animation-delay: 0.05s;
}
.block-2 span { color: rgba(30, 30, 40, 0.4); }
.block-3 {
  height: 70px;
  background: linear-gradient(180deg, #d99764, #a05a2a);
  animation-delay: 0.28s;
}
.block-3 span { color: rgba(40, 24, 8, 0.45); }
@keyframes block-grow {
  from {
    opacity: 0;
    transform: scaleY(0.4);
  }
}

/* === List card (rows 4+) === */
.list-card {
  margin-top: 6px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 6px 14px;
  box-shadow: var(--shadow-sm);
}
.list-row {
  display: grid;
  grid-template-columns: 22px auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--hairline);
  animation: row-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.list-row:last-child {
  border-bottom: none;
}
.list-row.list-self {
  background: var(--brand-soft);
  border-radius: 12px;
  padding-inline: 10px;
  margin-inline: -10px;
  border-bottom-color: transparent;
}
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
/* Stagger first 8 rows */
.list-row:nth-child(1) { animation-delay: 0.05s; }
.list-row:nth-child(2) { animation-delay: 0.10s; }
.list-row:nth-child(3) { animation-delay: 0.15s; }
.list-row:nth-child(4) { animation-delay: 0.20s; }
.list-row:nth-child(5) { animation-delay: 0.25s; }
.list-row:nth-child(6) { animation-delay: 0.30s; }
.list-row:nth-child(7) { animation-delay: 0.35s; }
.list-row:nth-child(8) { animation-delay: 0.40s; }
.list-rank {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
}
.list-name {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-you {
  font-size: 9px;
  padding: 2px 6px;
}
.flame-tag {
  font-size: 13px;
  filter: drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3));
}

/* Your-rank pin (only when out of the visible list) */
.your-pin {
  display: grid;
  grid-template-columns: 22px auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--brand-soft);
  border: 1.5px solid color-mix(in srgb, var(--brand) 35%, transparent);
  border-radius: var(--radius-card);
  margin-top: 8px;
}

.metric-help {
  margin-top: 6px;
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

.skeleton-row {
  border-bottom: 1px solid var(--hairline);
  padding: 12px 0;
}
</style>
