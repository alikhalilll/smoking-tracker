import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { User, UserIdentity, Provider } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'github'

export const ALL_SOCIAL_PROVIDERS: ReadonlyArray<SocialProvider> = [
  'google',
  'apple',
  'facebook',
  'github',
]

/** Flip to `true` once OAuth providers are configured in Supabase
 *  (Authentication → Providers). Until then the social login + linking
 *  UI is rendered as "Coming soon" — visible but non-interactive — so
 *  users know the feature is on the way without seeing broken redirects. */
export const SOCIAL_LOGIN_ENABLED = false

/** Display label for a provider (used in Settings → Linked accounts). */
export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  github: 'GitHub',
}

const user: Ref<User | null> = ref(null)
const loading: Ref<boolean> = ref(true)
// True between the moment Supabase exchanges a recovery link for a
// (temporary) session and the moment the user saves a new password. We
// track it so the UI shows the "set a new password" screen instead of
// treating the recovery session as a normal sign-in.
const recovering: Ref<boolean> = ref(false)

if (supabase) {
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      user.value = data.session?.user ?? null
    })
    .finally(() => {
      loading.value = false
    })

  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null
    if (event === 'PASSWORD_RECOVERY') recovering.value = true
  })
} else {
  loading.value = false
}

export interface UseAuth {
  user: ComputedRef<User | null>
  isAuthed: ComputedRef<boolean>
  loading: ComputedRef<boolean>
  /** True while the user is mid password-recovery (arrived via a reset
   *  link, hasn't saved a new password yet). Drives the reset screen. */
  recovering: ComputedRef<boolean>
  /** Email the user a password-recovery link. The link returns to the
   *  app's origin + base path, where detectSessionInUrl exchanges the
   *  PKCE code and fires a PASSWORD_RECOVERY auth event. */
  sendPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>
  /** Set a new password for the user (used during recovery, once the
   *  recovery session is active). Clears `recovering` on success. */
  updatePassword: (
    password: string
  ) => Promise<{ ok: boolean; error?: string }>
  /** Send a 6-digit OTP code to the email. PWA-friendly (no link redirect). */
  sendOtp: (email: string) => Promise<{ ok: boolean; error?: string }>
  verifyOtp: (
    email: string,
    token: string
  ) => Promise<{ ok: boolean; error?: string }>
  signInPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>
  signUpPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }>
  /** Returns true if an account with this email already exists. Backed by
   *  the `email_exists` SECURITY DEFINER RPC (see SUPABASE_SETUP.md). */
  checkEmailExists: (email: string) => Promise<{ ok: boolean; exists?: boolean; error?: string }>
  /** Redirects to the OAuth provider. Supabase's PKCE flow is already
   *  configured in supabase.ts; the callback is handled by
   *  detectSessionInUrl on return. */
  signInWithProvider: (
    provider: SocialProvider
  ) => Promise<{ ok: boolean; error?: string }>
  /** Link an OAuth provider to the *currently signed-in* user. Requires
   *  the "Manual Linking" toggle to be enabled in Supabase Auth settings.
   *  Redirects out to the provider, then returns to the app. */
  linkIdentity: (
    provider: SocialProvider
  ) => Promise<{ ok: boolean; error?: string }>
  /** Remove a previously linked identity. The user keeps their account
   *  as long as at least one identity remains. */
  unlinkIdentity: (
    identity: UserIdentity
  ) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
  /** Permanently delete the current user's account + all server data.
   *  Requires the `delete_account()` SQL function with SECURITY DEFINER
   *  (see SUPABASE_SETUP.md). Signs out locally on success. */
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>
}

export function useAuth(): UseAuth {
  return {
    user: computed(() => user.value),
    isAuthed: computed(() => user.value !== null),
    loading: computed(() => loading.value),
    recovering: computed(() => recovering.value),

    async sendPasswordReset(
      email: string
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      // Returns to the same origin + base path; detectSessionInUrl picks
      // up the recovery code on arrival (same pattern as OAuth).
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      )
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async updatePassword(
      password: string
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { ok: false, error: error.message }
      recovering.value = false
      return { ok: true }
    },

    async sendOtp(
      email: string
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      // No emailRedirectTo → Supabase sends the OTP code rather than a
      // clickable link, so the PWA never has to follow a URL out of the
      // installed app context.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async verifyOtp(
      email: string,
      token: string
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: 'email',
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async signInPassword(
      email: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async signUpPassword(
      email: string,
      password: string
    ): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) return { ok: false, error: error.message }
      // If email confirmation is enabled in the Supabase project, the user
      // is created but no session is returned until they confirm.
      const needsConfirm = !data.session
      return { ok: true, needsConfirm }
    },

    async checkEmailExists(
      email: string
    ): Promise<{ ok: boolean; exists?: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { data, error } = await supabase.rpc('email_exists', {
        p_email: email.trim(),
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, exists: Boolean(data) }
    },

    async signInWithProvider(
      provider: SocialProvider
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      // PKCE flow returns the user to the same origin + base path. The
      // SDK's detectSessionInUrl picks up the auth code on return.
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { redirectTo },
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async linkIdentity(
      provider: SocialProvider
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      // linkIdentity requires "Manual Linking" to be enabled in the
      // Supabase project's Auth settings. If it isn't, Supabase returns
      // a 422 with a clear message — we surface that as-is.
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as Provider,
        options: { redirectTo },
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async unlinkIdentity(
      identity: UserIdentity
    ): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      const { error } = await supabase.auth.unlinkIdentity(identity)
      if (error) return { ok: false, error: error.message }
      // Refresh the session so user.identities reflects the removal
      // immediately in the UI.
      const { data } = await supabase.auth.getSession()
      user.value = data.session?.user ?? null
      return { ok: true }
    },

    async signOut(): Promise<void> {
      if (!supabase) return
      recovering.value = false
      await supabase.auth.signOut()
    },

    async deleteAccount(): Promise<{ ok: boolean; error?: string }> {
      if (!supabase) return { ok: false, error: 'Supabase not configured' }
      // SECURITY DEFINER function — runs with elevated privileges so it
      // can drop the auth.users row. Cascade FKs clean up entries /
      // quit_plans / leaderboard_entries / user_settings.
      const { error } = await supabase.rpc('delete_account')
      if (error) return { ok: false, error: error.message }
      // Tear down the local session immediately.
      await supabase.auth.signOut()
      return { ok: true }
    },
  }
}
