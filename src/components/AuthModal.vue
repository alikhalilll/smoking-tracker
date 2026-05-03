<template>
  <DrawerRoot :open="isOpen" @update:open="(v) => (v ? null : close())">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content auth-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>

        <button
          type="button"
          class="modal-close btn btn-icon"
          :aria-label="'Close'"
          @click="close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div class="modal-hero">🌱</div>
        <DrawerTitle class="modal-title">{{ t('login.title') }}</DrawerTitle>
        <DrawerDescription class="modal-sub">{{ t('login.subtitle') }}</DrawerDescription>

        <SignInCard @signed-in="onSignedIn" />
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from 'vaul-vue'
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
/* Auth-specific layout. The base sheet styles come from
   styles/sheet.css (loaded globally), since vaul portals to <body>. */
.auth-sheet {
  text-align: center;
  padding: 8px 22px calc(28px + env(safe-area-inset-bottom));
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
  margin: 4px 0 6px;
}
.modal-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
  text-align: center;
}
.modal-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin: 0 0 22px;
  text-align: center;
}
</style>
