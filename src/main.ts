import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import './styles/components.css'
import './styles/sheet.css'
// Imported for its side effect: applies the saved theme to <html> immediately.
import { applyPrepaintTheme } from './composables/useTheme'
import { applyPrepaintLocale } from './i18n'
import { vReveal } from './composables/useReveal'
import { hydrateAll } from './composables/hydrate'

// Pre-paint hints: theme + locale are read from localStorage
// synchronously so <html data-theme>/<lang>/<dir> are correct on first
// paint. Dexie is the source of truth, but IndexedDB is async and would
// flash the wrong theme before hydrateAll finishes.
applyPrepaintTheme()
applyPrepaintLocale()

// hydrateAll opens Dexie, runs the one-time localStorage → Dexie
// migration, then populates every module-level ref (entries,
// tombstones, all settings) from Dexie. It never throws — a Dexie
// failure just leaves in-memory defaults in place and the app still
// mounts.
void hydrateAll().finally(() => {
  createApp(App)
    .directive('reveal', vReveal)
    .mount('#app')
})
