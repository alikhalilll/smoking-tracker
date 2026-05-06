<template>
  <div class="admin-login">
    <div class="admin-login-card">
      <div class="admin-login-glyph">🔒</div>
      <h1 class="admin-login-title">Admin sign-in</h1>
      <p class="admin-login-sub">Restricted access. Smoking Tracker analytics dashboard.</p>

      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
        </span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          name="username"
          class="field-input with-icon"
          placeholder="Username"
          :disabled="busy"
          @keydown.enter="onSubmit"
        />
      </div>

      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
        </span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          name="password"
          class="field-input with-icon"
          placeholder="Password"
          :disabled="busy"
          @keydown.enter="onSubmit"
        />
      </div>

      <button
        class="btn btn-primary block"
        :disabled="busy || !username || !password"
        @click="onSubmit"
      >
        <span v-if="busy" class="spinner"></span>
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>

      <div v-if="error" class="hint-msg error-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>{{ error }}</span>
      </div>

      <button type="button" class="link-btn" @click="emit('exit')">
        ← Back to the app
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAdminApi } from '../composables/useAdminApi'

const emit = defineEmits<{
  authed: []
  exit: []
}>()

const api = useAdminApi()
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function onSubmit(): Promise<void> {
  if (!username.value || !password.value) return
  busy.value = true
  error.value = null
  const result = await api.login(username.value, password.value)
  busy.value = false
  if (!result.ok) {
    error.value = result.error ?? 'Sign-in failed'
    return
  }
  emit('authed')
}
</script>

<style scoped>
.admin-login {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}
.admin-login-card {
  width: 100%;
  max-width: 360px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 28px 22px 22px;
  text-align: start;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}
.admin-login-glyph {
  font-size: 32px;
  text-align: center;
  margin-bottom: 8px;
}
.admin-login-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
  text-align: center;
  color: var(--text);
}
.admin-login-sub {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 22px;
  text-align: center;
  line-height: 1.5;
}
.field {
  position: relative;
  margin-bottom: 10px;
}
.block {
  width: 100%;
  margin-top: 6px;
}
.hint-msg {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 500;
}
.error-chip {
  background: var(--danger-soft);
  color: var(--danger);
}
.link-btn {
  display: block;
  margin: 14px auto 0;
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}
.link-btn:hover {
  color: var(--text);
  background: var(--btn-ghost-bg);
}
</style>
