<template>
  <div>
    <!-- Method tabs -->
    <div class="segmented" style="margin-bottom: 12px">
      <button
        v-for="m in authMethods"
        :key="m"
        class="segmented-btn"
        :class="{ active: authMethod === m }"
        @click="setAuthMethod(m)"
      >
        {{ t(`cloud.method_${m}`) }}
      </button>
    </div>

    <!-- OTP flow -->
    <template v-if="authMethod === 'otp'">
      <div v-if="!codeSent" class="cloud-form">
        <input
          v-model="emailInput"
          type="email"
          inputmode="email"
          autocomplete="email"
          class="email-input"
          :placeholder="t('cloud.email_placeholder')"
          :disabled="signingIn"
          @keydown.enter="onSendCode"
        />
        <button
          class="primary-btn"
          :disabled="signingIn || !emailInput"
          @click="onSendCode"
        >
          {{ signingIn ? t('cloud.sending') : t('cloud.send_code') }}
        </button>
      </div>

      <div v-else>
        <div class="hint-msg" style="margin-top: 0; margin-bottom: 10px">
          {{ t('cloud.code_sent', { email: emailInput }) }}
        </div>
        <div class="cloud-form">
          <input
            v-model="codeInput"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="email-input"
            :placeholder="t('cloud.code_placeholder')"
            :disabled="verifying"
            @keydown.enter="onVerifyCode"
          />
          <button
            class="primary-btn"
            :disabled="verifying || codeInput.length < 6"
            @click="onVerifyCode"
          >
            {{ verifying ? t('cloud.verifying') : t('cloud.verify') }}
          </button>
        </div>
        <button class="link-btn" style="margin-top: 8px" @click="onResetFlow">
          {{ t('cloud.use_different_email') }}
        </button>
      </div>
    </template>

    <!-- Password flow -->
    <template v-else>
      <div class="password-form">
        <input
          v-model="emailInput"
          type="email"
          inputmode="email"
          autocomplete="email"
          class="email-input"
          :placeholder="t('cloud.email_placeholder')"
          :disabled="signingIn"
        />
        <input
          v-model="passwordInput"
          type="password"
          :autocomplete="
            passwordMode === 'signup' ? 'new-password' : 'current-password'
          "
          class="email-input"
          :placeholder="t('cloud.password_placeholder')"
          :disabled="signingIn"
          @keydown.enter="onPasswordSubmit"
        />
        <button
          class="primary-btn"
          :disabled="signingIn || !emailInput || passwordInput.length < 6"
          @click="onPasswordSubmit"
        >
          {{
            signingIn
              ? t('cloud.sending')
              : passwordMode === 'signup'
                ? t('cloud.create_account')
                : t('cloud.sign_in')
          }}
        </button>
      </div>
      <div class="password-toggle">
        <span class="muted-line">
          {{
            passwordMode === 'signup'
              ? t('cloud.have_account')
              : t('cloud.no_account')
          }}
        </span>
        <button
          class="link-btn"
          @click="
            passwordMode = passwordMode === 'signup' ? 'signin' : 'signup'
          "
        >
          {{
            passwordMode === 'signup'
              ? t('cloud.sign_in')
              : t('cloud.create_account')
          }}
        </button>
      </div>
      <div v-if="signupNeedsConfirm" class="hint-msg">
        {{ t('cloud.signup_confirm_sent', { email: emailInput }) }}
      </div>
    </template>

    <div v-if="signInError" class="hint-msg" style="color: var(--red)">
      {{ signInError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'

const { t } = useI18n()
const auth = useAuth()

type AuthMethod = 'otp' | 'password'
const authMethods: ReadonlyArray<AuthMethod> = ['otp', 'password']
const authMethod = ref<AuthMethod>('otp')

const emailInput = ref('')
const codeInput = ref('')
const codeSent = ref(false)

const passwordInput = ref('')
const passwordMode = ref<'signin' | 'signup'>('signin')
const signupNeedsConfirm = ref(false)

const signingIn = ref(false)
const verifying = ref(false)
const signInError = ref<string | null>(null)

function setAuthMethod(m: AuthMethod): void {
  authMethod.value = m
  signInError.value = null
  signupNeedsConfirm.value = false
}

async function onSendCode(): Promise<void> {
  if (!emailInput.value) return
  signingIn.value = true
  signInError.value = null
  const result = await auth.sendOtp(emailInput.value.trim())
  signingIn.value = false
  if (result.ok) codeSent.value = true
  else signInError.value = result.error ?? 'Sign-in failed'
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
}

async function onPasswordSubmit(): Promise<void> {
  if (!emailInput.value || passwordInput.value.length < 6) return
  signingIn.value = true
  signInError.value = null
  signupNeedsConfirm.value = false
  if (passwordMode.value === 'signup') {
    const result = await auth.signUpPassword(
      emailInput.value.trim(),
      passwordInput.value
    )
    signingIn.value = false
    if (!result.ok) {
      signInError.value = result.error ?? 'Sign-up failed'
    } else if (result.needsConfirm) {
      signupNeedsConfirm.value = true
    }
  } else {
    const result = await auth.signInPassword(
      emailInput.value.trim(),
      passwordInput.value
    )
    signingIn.value = false
    if (!result.ok) signInError.value = result.error ?? 'Sign-in failed'
  }
}

function onResetFlow(): void {
  codeSent.value = false
  codeInput.value = ''
  signInError.value = null
}
</script>

<style scoped>
.segmented {
  display: flex;
  gap: 4px;
  background: var(--card);
  border-radius: 10px;
  padding: 4px;
}
.segmented-btn {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.segmented-btn.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.cloud-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.password-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.password-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.email-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}
.email-input:focus {
  outline: none;
  border-color: var(--text);
}
.primary-btn {
  padding: 9px 14px;
  border: none;
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--btn-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.link-btn {
  padding: 5px 10px;
  border: 1.5px solid var(--faint);
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
}
.muted-line {
  font-size: 11px;
  color: var(--subtle);
}
.hint-msg {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
</style>
