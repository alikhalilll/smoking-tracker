<template>
  <div>
    <!-- Animated method tabs -->
    <div class="tab-pills" role="tablist">
      <div
        class="tab-pill-indicator"
        :style="{
          width: `${100 / authMethods.length}%`,
          transform: `translateX(${authMethods.indexOf(authMethod) * 100}%)`,
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
        {{ t(`cloud.method_${m}`) }}
      </button>
    </div>

    <!-- OTP flow -->
    <template v-if="authMethod === 'otp'">
      <div v-if="!codeSent">
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
            :disabled="signingIn"
            @keydown.enter="onSendCode"
          />
        </div>
        <button
          class="btn btn-primary block"
          :disabled="signingIn || !emailInput"
          @click="onSendCode"
        >
          <span v-if="signingIn" class="spinner"></span>
          {{ signingIn ? t('cloud.sending') : t('cloud.send_code') }}
        </button>
      </div>

      <div v-else>
        <div class="hint-msg">
          {{ t('cloud.code_sent', { email: emailInput }) }}
        </div>

        <div class="otp-row" :dir="isRtl ? 'ltr' : undefined">
          <input
            v-for="(_, i) in 6"
            :key="i"
            ref="otpRefs"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="1"
            class="otp-box"
            :value="codeChars[i] || ''"
            @input="onOtpInput(i, $event)"
            @keydown="onOtpKey(i, $event)"
            @paste="onOtpPaste"
          />
        </div>

        <button
          class="btn btn-primary block"
          :disabled="verifying || codeInput.length < 6"
          @click="onVerifyCode"
        >
          <span v-if="verifying" class="spinner"></span>
          {{ verifying ? t('cloud.verifying') : t('cloud.verify') }}
        </button>
        <button class="btn btn-ghost block-secondary" @click="onResetFlow">
          {{ t('cloud.use_different_email') }}
        </button>
      </div>
    </template>

    <!-- Password flow -->
    <template v-else>
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
          :disabled="signingIn"
        />
      </div>
      <div class="field">
        <span class="field-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
        </span>
        <input
          v-model="passwordInput"
          type="password"
          autocomplete="current-password"
          class="field-input with-icon"
          :placeholder="t('cloud.password_placeholder')"
          :disabled="signingIn"
          @keydown.enter="onPasswordSubmit"
        />
      </div>

      <button
        class="btn btn-primary block"
        :disabled="signingIn || !emailInput || passwordInput.length < 6"
        @click="onPasswordSubmit"
      >
        <span v-if="signingIn" class="spinner"></span>
        {{ signingIn ? t('cloud.sending') : t('cloud.sign_in') }}
      </button>

      <!-- Smart prompt: appears when sign-in failed because the user
           doesn't exist yet. One tap creates the account. -->
      <div v-if="suggestSignUp" class="hint-msg signup-prompt chip chip-brand block-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <span style="flex: 1; text-align: start">
          {{ t('cloud.smart_signup_prompt') }}
        </span>
        <button class="chip-cta" @click="onConfirmSignUp">
          {{ t('cloud.smart_signup_confirm') }}
        </button>
      </div>
      <div v-if="signupNeedsConfirm" class="hint-msg">
        {{ t('cloud.signup_confirm_sent', { email: emailInput }) }}
      </div>
    </template>

    <div v-if="signInError && !suggestSignUp" class="hint-msg error-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span>{{ signInError }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  'signed-in': []
}>()

const { t, isRtl } = useI18n()
const auth = useAuth()

type AuthMethod = 'otp' | 'password'
const authMethods: ReadonlyArray<AuthMethod> = ['otp', 'password']
const authMethod = ref<AuthMethod>('otp')

const emailInput = ref('')
const codeInput = ref('')
const codeSent = ref(false)
const otpRefs = ref<HTMLInputElement[]>([])

const passwordInput = ref('')
const suggestSignUp = ref(false)
const signupNeedsConfirm = ref(false)

const signingIn = ref(false)
const verifying = ref(false)
const signInError = ref<string | null>(null)

const codeChars = computed(() => codeInput.value.split(''))

function setAuthMethod(m: AuthMethod): void {
  authMethod.value = m
  signInError.value = null
  signupNeedsConfirm.value = false
  suggestSignUp.value = false
}

async function onSendCode(): Promise<void> {
  if (!emailInput.value) return
  signingIn.value = true
  signInError.value = null
  const result = await auth.sendOtp(emailInput.value.trim())
  signingIn.value = false
  if (result.ok) {
    codeSent.value = true
    nextTick(() => otpRefs.value[0]?.focus())
  } else {
    signInError.value = result.error ?? 'Sign-in failed'
  }
}

function setOtpDigit(i: number, ch: string): void {
  const arr = codeInput.value.split('')
  while (arr.length < 6) arr.push('')
  arr[i] = ch
  codeInput.value = arr.join('').slice(0, 6).replace(/\s+$/, '')
}

function onOtpInput(i: number, e: Event): void {
  const value = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  if (!value) {
    setOtpDigit(i, '')
    return
  }
  // If a multi-char value got pasted into one box, distribute it.
  for (let k = 0; k < value.length && i + k < 6; k++) {
    setOtpDigit(i + k, value[k])
  }
  const nextIdx = Math.min(5, i + value.length)
  otpRefs.value[nextIdx]?.focus()
}

function onOtpKey(i: number, e: KeyboardEvent): void {
  if (e.key === 'Backspace') {
    if (codeChars.value[i]) {
      setOtpDigit(i, '')
    } else if (i > 0) {
      otpRefs.value[i - 1]?.focus()
      setOtpDigit(i - 1, '')
    }
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    otpRefs.value[i - 1]?.focus()
  } else if (e.key === 'ArrowRight' && i < 5) {
    otpRefs.value[i + 1]?.focus()
  }
}

function onOtpPaste(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData('text') ?? ''
  const digits = text.replace(/\D/g, '').slice(0, 6)
  if (!digits) return
  e.preventDefault()
  codeInput.value = digits
  nextTick(() => otpRefs.value[Math.min(5, digits.length)]?.focus())
}

async function onVerifyCode(): Promise<void> {
  if (!codeInput.value) return
  verifying.value = true
  signInError.value = null
  const result = await auth.verifyOtp(
    emailInput.value.trim(),
    codeInput.value.trim()
  )
  verifying.value = false
  if (!result.ok) signInError.value = result.error ?? 'Verification failed'
  else emit('signed-in')
}

async function onPasswordSubmit(): Promise<void> {
  if (!emailInput.value || passwordInput.value.length < 6) return
  signingIn.value = true
  signInError.value = null
  signupNeedsConfirm.value = false
  suggestSignUp.value = false

  const result = await auth.signInPassword(
    emailInput.value.trim(),
    passwordInput.value
  )
  signingIn.value = false
  if (result.ok) {
    emit('signed-in')
    return
  }
  // Heuristic — if Supabase says "Invalid login credentials", offer to sign
  // up with the same password. Other errors surface raw.
  const msg = (result.error ?? '').toLowerCase()
  if (msg.includes('invalid login') || msg.includes('credentials')) {
    suggestSignUp.value = true
  } else {
    signInError.value = result.error ?? 'Sign-in failed'
  }
}

async function onConfirmSignUp(): Promise<void> {
  signingIn.value = true
  signInError.value = null
  suggestSignUp.value = false
  const result = await auth.signUpPassword(
    emailInput.value.trim(),
    passwordInput.value
  )
  signingIn.value = false
  if (!result.ok) {
    signInError.value = result.error ?? 'Sign-up failed'
  } else if (result.needsConfirm) {
    signupNeedsConfirm.value = true
  } else {
    emit('signed-in')
  }
}

function onResetFlow(): void {
  codeSent.value = false
  codeInput.value = ''
  signInError.value = null
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
  background: var(--card);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
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
}
.tab-pill.active {
  color: var(--text);
}

.field {
  margin-bottom: 10px;
}

.block {
  width: 100%;
  margin-top: 6px;
}
.block-secondary {
  width: 100%;
  margin-top: 8px;
  font-size: 12px;
  padding: 10px;
}

.otp-row {
  display: flex;
  gap: 8px;
  margin: 12px 0 14px;
  justify-content: space-between;
}
.otp-box {
  width: 100%;
  max-width: 48px;
  aspect-ratio: 1;
  text-align: center;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 22px;
  font-weight: 600;
  border: 1.5px solid var(--hairline);
  border-radius: 12px;
  background: var(--card);
  color: var(--text);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.otp-box:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 4px var(--brand-soft);
}

.hint-msg {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.signup-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 500;
}
.chip-cta {
  appearance: none;
  border: none;
  background: var(--brand);
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  white-space: nowrap;
}
.error-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: 12px;
  font-weight: 500;
}
</style>
