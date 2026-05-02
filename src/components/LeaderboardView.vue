<template>
  <div class="fade-in">
    <div class="section-title">{{ t('leaderboard.title') }}</div>

    <div v-if="!leaderboard.prefs.value.optedIn" class="opt-in-card">
      <div class="opt-in-headline">{{ t('leaderboard.opt_in_headline') }}</div>
      <div class="opt-in-body">{{ t('leaderboard.opt_in_body') }}</div>
      <button class="primary-btn" @click="$emit('open-settings')">
        {{ t('leaderboard.opt_in_cta') }}
      </button>
    </div>

    <template v-else>
      <div class="segmented" style="margin-bottom: 14px">
        <button
          v-for="m in metrics"
          :key="m"
          class="segmented-btn"
          :class="{ active: metric === m }"
          @click="metric = m"
        >
          {{ t(`leaderboard.metric_${m}`) }}
        </button>
      </div>

      <div v-if="leaderboard.loading.value && rows.length === 0" class="muted-line">
        {{ t('leaderboard.loading') }}
      </div>
      <div v-else-if="leaderboard.error.value" class="error-line">
        {{ leaderboard.error.value }}
      </div>
      <div v-else-if="rows.length === 0" class="muted-line">
        {{ t('leaderboard.empty') }}
      </div>

      <div v-else class="lb-list">
        <div
          v-for="(row, i) in rows"
          :key="row.user_id"
          class="lb-row"
          :class="{ 'lb-self': isOwn(row) }"
        >
          <div class="lb-rank">{{ i + 1 }}</div>
          <div class="lb-name">
            {{ row.display_name }}
            <span v-if="isOwn(row)" class="lb-you">{{ t('leaderboard.you') }}</span>
          </div>
          <div class="lb-value">
            {{ formatValue(row) }}
          </div>
        </div>
      </div>

      <div class="lb-meta">
        {{ t('leaderboard.metric_help_' + metric) }}
      </div>

      <button class="link-btn" style="margin-top: 14px" @click="leaderboard.refresh">
        {{ t('leaderboard.refresh') }}
      </button>
    </template>

    <div style="height: 2rem" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import type { LeaderboardEntry, LeaderboardMetric } from '../types'
import type { UseLeaderboard } from '../composables/useLeaderboard'

interface Props {
  leaderboard: UseLeaderboard
}

const props = defineProps<Props>()

defineEmits<{
  'open-settings': []
}>()

const { t } = useI18n()
const { user } = useAuth()

const metrics: ReadonlyArray<LeaderboardMetric> = ['smoke_free', 'reduction']
const metric = ref<LeaderboardMetric>('smoke_free')

const rows = computed<LeaderboardEntry[]>(() =>
  metric.value === 'smoke_free'
    ? props.leaderboard.topSmokeFree.value
    : props.leaderboard.topReduction.value
)

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
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.segmented {
  display: flex;
  gap: 4px;
  background: var(--card);
  border-radius: 10px;
  padding: 4px;
}
.segmented-btn {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
}
.segmented-btn.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.opt-in-card {
  background: var(--card);
  border-radius: 14px;
  padding: 22px 18px;
  text-align: center;
}
.opt-in-headline {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.opt-in-body {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 16px;
}
.primary-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--btn-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.muted-line {
  font-size: 12px;
  color: var(--subtle);
  text-align: center;
  padding: 2rem 0;
}
.error-line {
  font-size: 12px;
  color: var(--red);
  text-align: center;
  padding: 1rem 0;
}
.lb-list {
  display: flex;
  flex-direction: column;
}
.lb-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.lb-row.lb-self {
  background: var(--card);
  border-radius: 8px;
  padding: 12px 10px;
  border-bottom-color: transparent;
  margin: 2px 0;
}
.lb-rank {
  font-size: 12px;
  color: var(--subtle);
  font-weight: 600;
}
.lb-name {
  font-weight: 500;
  display: flex;
  gap: 6px;
  align-items: center;
}
.lb-you {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bg);
  background: var(--text);
  padding: 2px 6px;
  border-radius: 8px;
}
.lb-value {
  font-weight: 600;
  color: var(--text);
}
.lb-meta {
  margin-top: 14px;
  font-size: 11px;
  color: var(--subtle);
  text-align: center;
  line-height: 1.5;
}
.link-btn {
  display: block;
  margin: 0 auto;
  padding: 6px 14px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
}
</style>
