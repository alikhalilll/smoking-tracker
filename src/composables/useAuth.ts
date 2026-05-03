import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

const user: Ref<User | null> = ref(null)
const loading: Ref<boolean> = ref(true)

if (supabase) {
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      user.value = data.session?.user ?? null
    })
    .finally(() => {
      loading.value = false
    })

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })
} else {
  loading.value = false
}

export interface UseAuth {
  user: ComputedRef<User | null>
  isAuthed: ComputedRef<boolean>
  loading: ComputedRef<boolean>
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

    async signOut(): Promise<void> {
      if (!supabase) return
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
