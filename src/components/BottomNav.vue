<template>
  <!--
    Bottom navigation — flat, full-width dock.

    Solid surface (var(--card)), hairline top border, subtle elevation
    shadow above. Each cell is a vertical icon-over-label stack.
    Active state = filled icon + bold label in brand coral, plus a
    small underline. No glass, no refraction filter — clean and
    restrained.
  -->
  <nav
    class="bottom-nav"
    :aria-label="navLabel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="bn-tab"
      :class="{ 'is-active': tab.id === currentView }"
      :aria-current="tab.id === currentView ? 'page' : undefined"
      :aria-label="tab.label"
      @click="$emit('change', tab.id)"
    >
      <span
        class="bn-icon"
        v-html="tab.id === currentView ? ICONS_FILLED[tab.id] : ICONS_STROKE[tab.id]"
      />
      <span class="bn-label">{{ tab.label }}</span>
      <span class="bn-underline" aria-hidden="true" />
    </button>
  </nav>
</template>

<script setup lang="ts">
export type BottomNavTabId =
  | 'home'
  | 'history'
  | 'quit'
  | 'leaderboard'
  | 'settings'

interface NavTabInput {
  id: BottomNavTabId
  label: string
}

interface Props {
  currentView: string
  tabs: NavTabInput[]
  navLabel?: string
}

withDefaults(defineProps<Props>(), {
  navLabel: 'Primary',
})

defineEmits<{
  change: [id: BottomNavTabId]
}>()

const ICONS_STROKE: Record<BottomNavTabId, string> = {
  home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  history: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  quit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  leaderboard: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4z"/><path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2"/></svg>`,
  settings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
}

const ICONS_FILLED: Record<BottomNavTabId, string> = {
  home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 7.5a.75.75 0 0 1-.49 1.32H19v7.59a.75.75 0 0 1-.75.75H14.5v-6.5h-5V21H5.75a.75.75 0 0 1-.75-.75V12.66H3.27a.75.75 0 0 1-.49-1.32z"/></svg>`,
  history: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm.75 4.25a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 .22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78z"/></svg>`,
  quit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14z"/><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  leaderboard: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4h10v6a5 5 0 0 1-10 0zM5.5 4H7v3.5A1.5 1.5 0 0 1 5.5 9 1.5 1.5 0 0 1 4 7.5v-2A1.5 1.5 0 0 1 5.5 4zm13 0H17v3.5A1.5 1.5 0 0 0 18.5 9 1.5 1.5 0 0 0 20 7.5v-2A1.5 1.5 0 0 0 18.5 4zM10.5 16h3v3H17v2H7v-2h3.5z"/></svg>`,
  settings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"/></svg>`,
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  /* Match the app-shell content rail: app-shell is max-width 480px
     with 16px horizontal padding, so items sit inside a 448px column
     on wide viewports. We mirror that here so the nav lines up with
     cards/buttons in the page above. */
  left: 50%;
  transform: translateX(-50%);
  width: min(448px, calc(100vw - 32px));
  bottom: max(21px, env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 8px 4px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08),
              0 2px 6px rgba(15, 23, 42, 0.04);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .bottom-nav {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45),
                0 2px 6px rgba(0, 0, 0, 0.28);
  }
}
[data-theme='dark'] .bottom-nav {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45),
              0 2px 6px rgba(0, 0, 0, 0.28);
}

.bn-tab {
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px 6px;
  border-radius: 12px;
  color: var(--muted);
  transition: color 0.18s ease, background-color 0.18s ease;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.bn-tab:hover {
  background-color: color-mix(in srgb, var(--text) 4%, transparent);
}
.bn-tab:active {
  transform: scale(0.96);
  transition: transform 0.08s ease;
}
.bn-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 50%, transparent);
}

.bn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.bn-icon :deep(svg) {
  display: block;
}

.bn-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: font-weight 0.18s ease;
}

.bn-underline {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  border-radius: 2px;
  background: var(--brand);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.bn-tab.is-active {
  color: var(--brand);
}
.bn-tab.is-active .bn-label {
  font-weight: 700;
  letter-spacing: 0.02em;
}
.bn-tab.is-active .bn-underline {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .bn-tab,
  .bn-label,
  .bn-underline {
    transition: none;
  }
  .bn-tab:active {
    transform: none;
  }
}
</style>
