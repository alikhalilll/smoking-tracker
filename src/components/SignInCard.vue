<template>
  <div>
    <!-- Step 1: email + social. After we know whether the email exists,
         we render a different password step (existing vs new) so the
         password input's autocomplete attribute is correct on mount and
         never mutates — which fixes the autofill-clears-value bug. -->
    <template v-if="step === 'email'">
      <!-- Social providers — 2-column grid with a tinted icon chip and
           a centered label below it. -->
      <div class="provider-grid">
        <button
          v-for="p in providers"
          :key="p.id"
          type="button"
          class="provider-btn"
          :class="`provider-${p.id}`"
          :disabled="busy !== null"
          :aria-label="t(`cloud.${p.labelKey}`)"
          @click="onProvider(p.id)"
        >
          <span v-if="busy === p.id" class="provider-spinner spinner" />
          <template v-else>
            <span class="provider-chip" v-html="p.icon" />
            <span class="provider-label">{{ p.shortLabel }}</span>
          </template>
        </button>
      </div>

      <div class="divider">
        <span>{{ t('cloud.or_with_email') }}</span>
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
          name="email"
          class="field-input with-icon"
          :placeholder="t('cloud.email_placeholder')"
          :disabled="busy !== null"
          @keydown.enter="onContinueEmail"
        />
      </div>

      <button
        class="btn btn-primary block"
        :disabled="busy !== null || !isValidEmail(emailInput)"
        @click="onContinueEmail"
      >
        <span v-if="busy === 'email'" class="spinner"></span>
        {{ busy === 'email' ? t('cloud.sending') : t('cloud.continue') }}
      </button>
    </template>

    <!-- Step 2a: existing user -->
    <template v-else-if="step === 'password-existing'">
      <div class="step-header">
        <h3 class="step-title">{{ t('cloud.welcome_back') }}</h3>
        <p class="step-sub">{{ t('cloud.welcome_back_sub', { email: emailInput }) }}</p>
      </div>

      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
        </span>
        <!-- Hidden username input gives password managers a stable
             association so the autofill picks up the right credential.
             Marked readonly so the user can't edit from this step. -->
        <input
          type="email"
          autocomplete="username"
          name="email"
          :value="emailInput"
          class="hidden-username"
          readonly
          tabindex="-1"
          aria-hidden="true"
        />
        <input
          ref="passwordEl"
          v-model="passwordInput"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          name="password"
          class="field-input with-icon with-action"
          :placeholder="t('cloud.password_placeholder')"
          :disabled="busy !== null"
          @keydown.enter="onSubmitExisting"
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

      <button
        class="btn btn-primary block"
        :disabled="busy !== null || passwordInput.length < 6"
        @click="onSubmitExisting"
      >
        <span v-if="busy === 'submit'" class="spinner"></span>
        {{ busy === 'submit' ? t('cloud.sending') : t('cloud.sign_in') }}
      </button>

      <button type="button" class="link-btn" @click="resetToEmail">
        {{ t('cloud.use_different_email') }}
      </button>
    </template>

    <!-- Step 2b: new user -->
    <template v-else>
      <div class="step-header">
        <h3 class="step-title">{{ t('cloud.create_account_headline') }}</h3>
        <p class="step-sub">{{ t('cloud.create_account_sub', { email: emailInput }) }}</p>
      </div>

      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
        </span>
        <input
          type="email"
          autocomplete="username"
          name="email"
          :value="emailInput"
          class="hidden-username"
          readonly
          tabindex="-1"
          aria-hidden="true"
        />
        <input
          ref="passwordEl"
          v-model="passwordInput"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          name="new-password"
          class="field-input with-icon with-action"
          :placeholder="t('cloud.password_placeholder')"
          :disabled="busy !== null"
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

      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <input
          v-model="confirmInput"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          name="new-password-confirm"
          class="field-input with-icon"
          :placeholder="t('cloud.password_confirm_placeholder')"
          :disabled="busy !== null"
          @keydown.enter="onSubmitNew"
        />
      </div>

      <button
        class="btn btn-primary block"
        :disabled="busy !== null || passwordInput.length < 6 || confirmInput.length < 6"
        @click="onSubmitNew"
      >
        <span v-if="busy === 'submit'" class="spinner"></span>
        {{ busy === 'submit' ? t('cloud.sending') : t('cloud.create_account') }}
      </button>

      <button type="button" class="link-btn" @click="resetToEmail">
        {{ t('cloud.use_different_email') }}
      </button>
    </template>

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
import { nextTick, ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth, type SocialProvider } from '../composables/useAuth'

const emit = defineEmits<{
  'signed-in': []
}>()

const { t } = useI18n()
const auth = useAuth()

type Step = 'email' | 'password-existing' | 'password-new'
type Busy = null | 'email' | 'submit' | SocialProvider

const step = ref<Step>('email')
const emailInput = ref('')
const passwordInput = ref('')
const confirmInput = ref('')
const showPassword = ref(false)
const busy = ref<Busy>(null)
const signupNeedsConfirm = ref(false)
const signInError = ref<string | null>(null)
const passwordEl = ref<HTMLInputElement | null>(null)

interface ProviderDef {
  id: SocialProvider
  labelKey: string
  shortLabel: string
  icon: string
}

// Inline brand SVGs — kept in this file to honor the project's
// no-icon-library convention. Marks are simplified one-color glyphs
// (currentColor) so they tint with the button's text colour.
const providers: ReadonlyArray<ProviderDef> = [
  {
    id: 'google',
    labelKey: 'provider_google',
    shortLabel: 'Google',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.36-.18-2H12v3.79h5.39a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.97-4.33 2.97-7.32z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.45l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.41 13.89A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.89V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.48l3.35-2.59z"/><path fill="#EA4335" d="M12 5.99c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.52l3.35 2.59C7.2 7.75 9.4 5.99 12 5.99z"/></svg>`,
  },
  {
    id: 'apple',
    labelKey: 'provider_apple',
    shortLabel: 'Apple',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.36 12.6c-.02-2.31 1.89-3.42 1.97-3.47-1.07-1.57-2.74-1.78-3.34-1.81-1.42-.14-2.78.84-3.5.84-.74 0-1.84-.82-3.03-.8-1.55.02-2.99.9-3.79 2.3-1.62 2.81-.41 6.96 1.16 9.24.77 1.12 1.68 2.36 2.87 2.32 1.16-.05 1.6-.74 3-.74 1.4 0 1.79.74 3.01.72 1.25-.02 2.04-1.13 2.8-2.25.88-1.3 1.24-2.55 1.26-2.61-.03-.02-2.41-.93-2.41-3.74zM14.04 5.85c.64-.78 1.07-1.86.95-2.94-.92.04-2.05.61-2.71 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.73-1.3z"/></svg>`,
  },
  {
    id: 'facebook',
    labelKey: 'provider_facebook',
    shortLabel: 'Facebook',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>`,
  },
  {
    id: 'github',
    labelKey: 'provider_github',
    shortLabel: 'GitHub',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.37-3.87-1.37-.52-1.34-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg>`,
  },
]

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function resetToEmail(): void {
  step.value = 'email'
  passwordInput.value = ''
  confirmInput.value = ''
  showPassword.value = false
  signInError.value = null
  signupNeedsConfirm.value = false
}

async function onContinueEmail(): Promise<void> {
  const email = emailInput.value.trim()
  if (!isValidEmail(email)) {
    signInError.value = t('cloud.invalid_email')
    return
  }
  busy.value = 'email'
  signInError.value = null
  const result = await auth.checkEmailExists(email)
  busy.value = null
  if (!result.ok) {
    signInError.value = result.error ?? 'Lookup failed'
    return
  }
  step.value = result.exists ? 'password-existing' : 'password-new'
  // Focus the password field after the conditional template paints.
  await nextTick()
  passwordEl.value?.focus()
}

async function onSubmitExisting(): Promise<void> {
  if (passwordInput.value.length < 6) return
  busy.value = 'submit'
  signInError.value = null
  const result = await auth.signInPassword(emailInput.value.trim(), passwordInput.value)
  busy.value = null
  if (!result.ok) {
    signInError.value = result.error ?? 'Sign-in failed'
  } else {
    emit('signed-in')
  }
}

async function onSubmitNew(): Promise<void> {
  if (passwordInput.value.length < 6) return
  if (passwordInput.value !== confirmInput.value) {
    signInError.value = t('cloud.password_mismatch')
    return
  }
  busy.value = 'submit'
  signInError.value = null
  const result = await auth.signUpPassword(emailInput.value.trim(), passwordInput.value)
  busy.value = null
  if (!result.ok) {
    signInError.value = result.error ?? 'Sign-up failed'
  } else if (result.needsConfirm) {
    signupNeedsConfirm.value = true
  } else {
    emit('signed-in')
  }
}

async function onProvider(provider: SocialProvider): Promise<void> {
  busy.value = provider
  signInError.value = null
  const result = await auth.signInWithProvider(provider)
  // The browser is about to redirect; clear busy only if the call
  // returned an error before the redirect.
  if (!result.ok) {
    busy.value = null
    signInError.value = result.error ?? 'Provider sign-in failed'
  }
}
</script>

<style scoped>
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

/* Off-screen but accessible to password managers so they can
   pair the email with the password input. */
.hidden-username {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.block {
  width: 100%;
  margin-top: 6px;
}

.link-btn {
  display: block;
  margin: 12px auto 0;
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}
.link-btn:hover {
  color: var(--text);
  background: var(--btn-ghost-bg);
}

.step-header {
  margin-bottom: 14px;
  text-align: start;
}
.step-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--text);
}
.step-sub {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  word-break: break-all;
}

.provider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.provider-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 92px;
  padding: 14px 12px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.08s ease,
    box-shadow 0.18s ease;
}
.provider-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  border-color: color-mix(in srgb, var(--text) 14%, var(--border));
}
.provider-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.provider-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.provider-btn:focus-visible {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 24%, transparent);
}

.provider-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--btn-ghost-bg);
  flex-shrink: 0;
  transition: background 0.18s ease, transform 0.18s ease;
}
.provider-btn:hover:not(:disabled) .provider-chip {
  transform: scale(1.05);
}
.provider-label {
  text-align: center;
  color: var(--text);
}
.provider-spinner {
  width: 18px;
  height: 18px;
}

/* Per-provider tints — soft, dark-mode safe. */
.provider-google .provider-chip {
  background: rgba(66, 133, 244, 0.10);
}
.provider-apple .provider-chip {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}
.provider-facebook .provider-chip {
  background: rgba(24, 119, 242, 0.12);
}
.provider-github .provider-chip {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.provider-google:hover:not(:disabled) {
  border-color: rgba(66, 133, 244, 0.45);
}
.provider-apple:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--text) 36%, transparent);
}
.provider-facebook:hover:not(:disabled) {
  border-color: rgba(24, 119, 242, 0.45);
}
.provider-github:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--text) 30%, transparent);
}

@media (max-width: 360px) {
  .provider-btn {
    min-height: 84px;
    padding: 12px 10px;
  }
  .provider-chip {
    width: 36px;
    height: 36px;
  }
}

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 14px 0 12px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
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
