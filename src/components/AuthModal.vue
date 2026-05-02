<template>
  <transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @click.self="close">
      <div class="modal-card glass-strong">
        <button class="modal-close btn btn-icon" @click="close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div class="modal-hero">🌱</div>
        <h2 class="modal-title">{{ t('login.title') }}</h2>
        <p class="modal-sub">{{ t('login.subtitle') }}</p>

        <SignInCard @signed-in="onSignedIn" />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { useAuthModal } from '../composables/useAuthModal'
import { useToast } from '../composables/useToast'
import SignInCard from './SignInCard.vue'

const { t } = useI18n()
const { isOpen, close } = useAuthModal()
const auth = useAuth()
const { show } = useToast()

// Close automatically once we're signed in (e.g. via OTP).
watch(
  () => auth.isAuthed.value,
  (now, was) => {
    if (now && !was && isOpen.value) {
      close()
      show(t('cloud.signed_in_toast'), 'success')
    }
  }
)

function onSignedIn(): void {
  close()
  show(t('cloud.signed_in_toast'), 'success')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 17, 13, 0.45);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}
.modal-card {
  width: 100%;
  max-width: 420px;
  border-radius: 28px;
  padding: 28px 22px 22px;
  position: relative;
  text-align: center;
}
.modal-close {
  position: absolute;
  top: 14px;
  inset-inline-end: 14px;
  width: 36px;
  height: 36px;
  background: var(--btn-ghost-bg);
  color: var(--text);
}
.modal-hero {
  font-size: 56px;
  line-height: 1;
  margin-bottom: 8px;
}
.modal-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.modal-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 22px;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: all 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
