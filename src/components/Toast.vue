<template>
  <div class="toast-host" aria-live="polite">
    <transition-group name="toast">
      <div
        v-for="m in messages"
        :key="m.id"
        class="toast"
        :class="`toast-${m.tone}`"
      >
        {{ m.text }}
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { messages } = useToast()
</script>

<style scoped>
.toast-host {
  position: fixed;
  inset-inline: 0;
  /* Sit just above the floating bottom nav */
  bottom: calc(96px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 200;
  padding: 0 16px;
}
.toast {
  pointer-events: auto;
  /* Heavier blur + a more opaque card so the text reads cleanly
     against busy backgrounds (ambient dots, dashboards, etc.).
     color-mix off --card keeps the surface theme-correct in light
     and dark. */
  background: color-mix(in srgb, var(--card) 92%, transparent);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight), var(--glass-shadow);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  padding: 12px 18px;
  border-radius: var(--radius-pill);
  max-width: 360px;
  text-align: center;
}
.toast-success {
  color: var(--success);
}
.toast-warn {
  color: var(--warning);
}
.toast-danger {
  color: var(--danger);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}
</style>
