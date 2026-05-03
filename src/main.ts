import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import './styles/components.css'
import './styles/sheet.css'
// Imported for its side effect: applies the saved theme to <html> immediately.
import './composables/useTheme'

createApp(App).mount('#app')
