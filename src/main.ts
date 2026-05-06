import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import './styles/components.css'
import './styles/sheet.css'
// Imported for its side effect: applies the saved theme to <html> immediately.
import './composables/useTheme'
import { vReveal } from './composables/useReveal'
import { vLiquidGlass } from './lib/liquidGlass/directive'

createApp(App)
  .directive('reveal', vReveal)
  .directive('liquid-glass', vLiquidGlass)
  .mount('#app')
