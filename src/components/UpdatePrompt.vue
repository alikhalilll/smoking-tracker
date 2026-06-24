<template>
  <transition name="upd">
    <div
      v-if="needRefresh"
      class="update-banner glass"
      :class="{ 'is-attn': attnPulse }"
      role="alertdialog"
      aria-live="assertive"
      :aria-label="t('update.available_title')"
    >
      <div class="upd-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/>
          <polyline points="21 4 21 10 15 10"/>
        </svg>
      </div>
      <div class="upd-body">
        <div class="upd-title">{{ t('update.available_title') }}</div>
        <div class="upd-sub">{{ t('update.available_body') }}</div>
        <div class="upd-whatsnew">{{ t('update.whats_new') }}</div>
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
import { ref, watch } from 'vue'
import { usePwaUpdate } from '../composables/usePwaUpdate'
import { useI18n } from '../i18n'
import { useToast } from '../composables/useToast'
import { useHaptics } from '../composables/useHaptics'

const { t } = useI18n()
const { needRefresh, applyUpdate, dismiss } = usePwaUpdate()
const { show: showToast } = useToast()
const haptics = useHaptics()

// One-shot attention pulse on the banner (3.6s) — gives the user a
// chance to actually notice it on a busy screen without being a
// permanent distraction.
const attnPulse = ref(false)

// Mirror the banner into the toast host the FIRST time it appears in
// a session. The banner sits low on the screen and can be missed
// while the user is mid-tap; the toast pops above the nav and brings
// haptics with it. We don't loop — if the user dismisses without
// updating, the banner stays available to re-tap, but we don't keep
// nagging via toasts.
let firstAnnounceDone = false
watch(needRefresh, (now) => {
  if (!now || firstAnnounceDone) return
  firstAnnounceDone = true
  haptics.fire('success')
  showToast(t('update.toast_announce'), 'success')
  attnPulse.value = true
  setTimeout(() => {
    attnPulse.value = false
  }, 3600)
})

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
/* One-line release note. Brand-tinted so it stands apart from the
   generic "Update available" subtitle and tells the user *what*
   they're getting before they tap Refresh. */
.upd-whatsnew {
  font-size: 11px;
  font-weight: 600;
  color: var(--brand);
  line-height: 1.3;
  margin-top: 4px;
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

/* Short attention pulse — 3 cycles of a soft brand-tinted glow and a
   barely-perceptible scale, then stops. Enough to catch the eye
   without becoming a permanent distraction. */
.update-banner.is-attn {
  animation: upd-attn 1.2s ease-in-out 3;
}
@keyframes upd-attn {
  0%, 100% {
    transform: scale(1);
    box-shadow: var(--shadow-sm, 0 2px 10px rgba(0, 0, 0, 0.06));
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 6px 24px color-mix(in srgb, var(--brand) 40%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .update-banner.is-attn {
    animation: none;
  }
}
</style>
