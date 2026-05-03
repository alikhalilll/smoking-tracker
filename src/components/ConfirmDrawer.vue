<template>
  <DrawerRoot :open="open" @update:open="setOpen">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content confirm-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>

        <DrawerTitle class="confirm-title">
          {{ state?.title ?? '' }}
        </DrawerTitle>
        <DrawerDescription
          v-if="state?.body"
          class="confirm-body"
        >
          {{ state.body }}
        </DrawerDescription>

        <div class="sheet-actions">
          <button type="button" class="btn btn-ghost" @click="answer(false)">
            {{ state?.cancelText || t('confirm.cancel') }}
          </button>
          <button
            type="button"
            class="btn"
            :class="state?.variant === 'danger' ? 'danger-btn' : 'btn-primary'"
            @click="answer(true)"
          >
            {{ state?.confirmText || t('confirm.ok') }}
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from 'vaul-vue'
import { useConfirm } from '../composables/useConfirm'
import { useI18n } from '../i18n'

const { open, state, answer, setOpen } = useConfirm()
const { t } = useI18n()
</script>

<style scoped>
.confirm-sheet {
  /* Slightly tighter than other sheets — confirms are short */
  gap: 8px;
}
.confirm-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin: 4px 0;
  text-align: center;
}
.confirm-body {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin: 0 0 8px;
  text-align: center;
}
</style>
