<template>
  <div>
    <!-- Animated Sign in / Sign up tabs -->
    <div class="tab-pills" role="tablist">
      <div
        class="tab-pill-indicator"
        :style="{
          width: `${100 / authMethods.length}%`,
          /* In RTL the visual order of children is reversed, so the
             indicator must move in the opposite physical direction. */
          transform: `translateX(${
            authMethods.indexOf(authMethod) * (isRtl ? -100 : 100)
          }%)`,
        }"
      />
      <button
        v-for="m in authMethods"
        :key="m"
        class="tab-pill"
        :class="{ active: authMethod === m }"
        role="tab"
        @click="setAuthMethod(m)"
      >
        {{ t(`cloud.${m === 'signin' ? 'tab_signin' : 'tab_signup'}`) }}
      </button>
    </div>

    <!-- Email -->
    <div class="field">
      <span class="field-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>
      </span>
      <input
        v-model="emailInput"
        type="email"
        inputmode="email"
        autocomplete="email"
        class="field-input with-icon"
        :placeholder="t('cloud.email_placeholder')"
        :disabled="busy"
      />
    </div>

    <!-- Password -->
    <div class="field">
      <span class="field-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
      </span>
      <input
        v-model="passwordInput"
        :type="showPassword ? 'text' : 'password'"
        :autocomplete="
          authMethod === 'signup' ? 'new-password' : 'current-password'
        "
        class="field-input with-icon with-action"
        :placeholder="t('cloud.password_placeholder')"
        :disabled="busy"
        @keydown.enter="onSubmit"
      />
      <button
        type="button"
        class="field-action"
        :aria-label="showPassword ? t('cloud.hide_password') : t('cloud.show_password')"
        @click="showPassword = !showPassword"
      >
        <svg v-if="showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>

    <!-- Submit -->
    <button
      class="btn btn-primary block"
      :disabled="busy || !emailInput || passwordInput.length < 6"
      @click="onSubmit"
    >
      <span v-if="busy" class="spinner"></span>
      {{
        busy
          ? t('cloud.sending')
          : authMethod === 'signup'
            ? t('cloud.create_account')
            : t('cloud.sign_in')
      }}
    </button>

    <!-- Confirmation hint after a sign-up where Supabase requires email confirmation -->
    <div v-if="signupNeedsConfirm" class="hint-msg success-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>{{ t('cloud.signup_confirm_sent', { email: emailInput }) }}</span>
    </div>

    <!-- Error -->
    <div v-if="signInError" class="hint-msg error-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span>{{ signInError }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  'signed-in': []
}>()

const { t, isRtl } = useI18n()
const auth = useAuth()

type AuthMethod = 'signin' | 'signup'
const authMethods: ReadonlyArray<AuthMethod> = ['signin', 'signup']
const authMethod = ref<AuthMethod>('signin')

const emailInput = ref('')
const passwordInput = ref('')
const showPassword = ref(false)
const busy = ref(false)
const signupNeedsConfirm = ref(false)
const signInError = ref<string | null>(null)

function setAuthMethod(m: AuthMethod): void {
  authMethod.value = m
  signInError.value = null
  signupNeedsConfirm.value = false
}

async function onSubmit(): Promise<void> {
  if (!emailInput.value || passwordInput.value.length < 6) return
  busy.value = true
  signInError.value = null
  signupNeedsConfirm.value = false

  if (authMethod.value === 'signup') {
    const result = await auth.signUpPassword(
      emailInput.value.trim(),
      passwordInput.value
    )
    busy.value = false
    if (!result.ok) {
      signInError.value = result.error ?? 'Sign-up failed'
    } else if (result.needsConfirm) {
      signupNeedsConfirm.value = true
    } else {
      emit('signed-in')
    }
  } else {
    const result = await auth.signInPassword(
      emailInput.value.trim(),
      passwordInput.value
    )
    busy.value = false
    if (!result.ok) {
      signInError.value = result.error ?? 'Sign-in failed'
    } else {
      emit('signed-in')
    }
  }
}
</script>

<style scoped>
.tab-pills {
  position: relative;
  display: flex;
  gap: 0;
  background: var(--btn-ghost-bg);
  border-radius: var(--radius-pill);
  padding: 4px;
  margin-bottom: 18px;
}
.tab-pill-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  inset-inline-start: 4px;
  background: linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to));
  border-radius: var(--radius-pill);
  box-shadow: var(--brand-shadow);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: calc((100% - 8px) / 2);
}
.tab-pill {
  position: relative;
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted);
  border-radius: var(--radius-pill);
  z-index: 1;
  transition: color 0.2s ease;
}
.tab-pill.active {
  color: #fff;
}

.field {
  margin-bottom: 10px;
  position: relative;
}
.with-action {
  padding-inline-end: 44px;
}
.field-action {
  position: absolute;
  inset-inline-end: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.field-action:hover {
  background: var(--btn-ghost-bg);
  color: var(--text);
}

.block {
  width: 100%;
  margin-top: 6px;
}

.hint-msg {
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 500;
}
.success-chip {
  background: var(--success-soft);
  color: var(--success);
}
.error-chip {
  background: var(--danger-soft);
  color: var(--danger);
}
</style>
