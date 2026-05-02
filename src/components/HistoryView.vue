<template>
  <div class="fade-in">
    <div class="section-title">Daily history</div>

    <div v-if="days.length === 0" class="empty-state">
      No data yet. Start logging!
    </div>

    <div
      v-for="(d, i) in days"
      :key="d"
      class="history-row"
      :style="{ animationDelay: i * 0.03 + 's' }"
    >
      <div>
        <div class="day-label">{{ getDayLabel(d) }}</div>
        <div class="day-date">{{ d }}</div>
      </div>
      <div class="day-right">
        <div
          class="day-bar"
          :style="{
            width: barWidth(byDay[d]) + 'px',
            background: getColor(byDay[d]),
          }"
        />
        <div class="day-count" :style="{ color: getColor(byDay[d]) }">
          {{ byDay[d] }}
        </div>
      </div>
    </div>

    <div style="height: 2rem" />
  </div>
</template>

<script setup>
import { getDayLabel, getColor } from '../composables/useStats'

const props = defineProps({
  days: Array,
  byDay: Object,
})

function barWidth(count) {
  const maxCount = Math.max(...Object.values(props.byDay), 1)
  return Math.max(20, (count / maxCount) * 80)
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.empty-state {
  color: var(--subtle);
  font-size: 14px;
  padding: 3rem 0;
  text-align: center;
}
.history-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  animation: slideUp 0.3s ease-out both;
}
.day-label {
  font-size: 14px;
  font-weight: 500;
}
.day-date {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 2px;
}
.day-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.day-bar {
  height: 6px;
  border-radius: 3px;
  transition: width 0.3s;
}
.day-count {
  font-size: 20px;
  font-weight: 600;
  min-width: 28px;
  text-align: right;
}
</style>
