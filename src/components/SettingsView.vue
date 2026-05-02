<template>
  <div class="fade-in">
    <div class="section-title">Settings</div>

    <div class="info-card">
      <div class="info-label">Tracking since</div>
      <div class="info-value">{{ startDate }}</div>
    </div>

    <div class="info-card">
      <div class="info-label">Total entries</div>
      <div class="info-value">
        {{ totalSmoked }} cigarettes over {{ totalDays }} day{{ totalDays > 1 ? 's' : '' }}
      </div>
    </div>

    <div class="info-card">
      <div class="info-label">Average per day</div>
      <div class="info-value">{{ dailyAvg }} cigarettes</div>
    </div>

    <button class="reset-btn" @click="handleReset">Reset all data</button>
    <div class="reset-warning">
      This will permanently delete all your tracked data.
    </div>

    <div class="pwa-info">
      <div class="info-label">Offline mode</div>
      <div class="info-value">
        This app works offline as a PWA. Add it to your home screen for the best
        experience.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  startDate: string
  totalSmoked: number
  totalDays: number
  dailyAvg: number
}

defineProps<Props>()

const emit = defineEmits<{
  reset: []
}>()

function handleReset(): void {
  if (confirm('Delete all tracking data? This cannot be undone.')) {
    emit('reset')
  }
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.info-card {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.info-label {
  font-size: 13px;
  font-weight: 500;
}
.info-value {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
}
.reset-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px 18px;
  border: 1.5px solid var(--red-border);
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--red);
}
.reset-warning {
  font-size: 11px;
  color: var(--subtle);
  text-align: center;
  margin-top: 8px;
}
.pwa-info {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 24px;
}
</style>
