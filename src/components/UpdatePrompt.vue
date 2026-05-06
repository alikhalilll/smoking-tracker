<template>
  <transition name="upd">
    <div v-if="needRefresh" class="update-banner glass" role="status" aria-live="polite">
      <div class="upd-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/>
          <polyline points="21 4 21 10 15 10"/>
        </svg>
      </div>
      <div class="upd-body">
        <div class="upd-title">{{ t('update.available_title') }}</div>
        <div class="upd-sub">{{ t('update.available_body') }}</div>
      </div>
      <div class="upd-actions">
        <button class="btn btn-ghost btn-sm" @click="onDismiss">
          {{ t('update.dismiss_btn') }}
        </button>
        <button class="btn btn-primary btn-sm" @click="onApply">
          {{ t('update.refresh_btn') }}
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { usePwaUpdate } from '../composables/usePwaUpdate'
import { useI18n } from '../i18n'

const { t } = useI18n()
const { needRefresh, applyUpdate, dismiss } = usePwaUpdate()

function onApply(): void {
  applyUpdate()
}
function onDismiss(): void {
  dismiss()
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  inset-inline: 0;
  bottom: calc(96px + env(safe-area-inset-bottom));
  margin-inline: 16px;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-card);
  z-index: 250;
}
.upd-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--brand) 18%, transparent);
  color: var(--brand);
}
.upd-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.upd-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}
.upd-sub {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.3;
}
.upd-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.btn-sm {
  padding: 8px 12px;
  font-size: 12px;
  border-radius: var(--radius-pill);
}

.upd-enter-from,
.upd-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
.upd-enter-active,
.upd-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
</style>
