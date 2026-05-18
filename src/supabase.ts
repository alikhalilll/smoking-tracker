import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookieStorage } from './authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
// Supabase renamed "anon key" → "publishable key" in 2025; support both so
// existing setups keep working.
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // Cookie-backed (with localStorage fallback) so the session
          // survives iOS Safari ITP eviction and service-worker updates,
          // both of which can wipe localStorage and silently log the
          // user out.
          storage: cookieStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Implicit flow: Supabase's default email links (recovery /
          // confirmation) redirect with the session in the URL hash
          // (#access_token=…&type=recovery). auth-js *rejects* those
          // hash callbacks when flowType is 'pkce' ("Not a valid PKCE
          // flow url"), which broke the password-reset link. OAuth —
          // the only thing that benefits from PKCE — is disabled
          // (SOCIAL_LOGIN_ENABLED=false); password/OTP are flow-
          // agnostic. Revisit (PKCE + an /auth/confirm verifyOtp
          // handler + email-template change) if social login is
          // enabled later.
          flowType: 'implicit',
        },
      })
    : null

export function isSupabaseConfigured(): boolean {
  return supabase !== null
}
