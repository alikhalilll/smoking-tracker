import { ref, computed, type ComputedRef } from 'vue'

const SESSION_KEY = 'st-admin-session'
const FUNCTION_PATH = '/functions/v1/admin'

interface AdminSession {
  token: string
  expiresAt: number
}

function readSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminSession
    if (parsed.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSession(s: AdminSession | null): void {
  if (typeof window === 'undefined') return
  if (s) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else window.sessionStorage.removeItem(SESSION_KEY)
}

const session = ref<AdminSession | null>(readSession())
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

function functionUrl(): string {
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not set')
  return supabaseUrl.replace(/\/+$/, '') + FUNCTION_PATH
}

interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  status?: number
}

async function call<T>(
  body: unknown,
  authHeader: string
): Promise<ApiResult<T>> {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: 'Supabase not configured' }
  }
  let res: Response
  try {
    res = await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        // Supabase Edge Functions reject requests without an apikey
        // header even when the function itself is --no-verify-jwt.
        apikey: supabaseKey,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { ok: false, error: String(err) }
  }
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    /* non-JSON body — leave payload null */
  }
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${res.status})`
    return { ok: false, error: message, status: res.status }
  }
  return { ok: true, data: payload as T, status: res.status }
}

export interface UseAdminApi {
  isAuthed: ComputedRef<boolean>
  expiresAt: ComputedRef<number | null>
  login: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  request: <T>(action: string, params?: Record<string, unknown>) => Promise<ApiResult<T>>
}

export function useAdminApi(): UseAdminApi {
  return {
    isAuthed: computed(() => session.value !== null),
    expiresAt: computed(() => session.value?.expiresAt ?? null),

    async login(
      username: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> {
      const basic = `Basic ${btoa(`${username}:${password}`)}`
      const res = await call<{ token: string; expiresAt: number }>(
        { action: 'login' },
        basic
      )
      if (!res.ok || !res.data) return { ok: false, error: res.error ?? 'Login failed' }
      const next: AdminSession = {
        token: res.data.token,
        expiresAt: res.data.expiresAt,
      }
      session.value = next
      writeSession(next)
      return { ok: true }
    },

    logout(): void {
      session.value = null
      writeSession(null)
    },

    async request<T>(
      action: string,
      params: Record<string, unknown> = {}
    ): Promise<ApiResult<T>> {
      const current = session.value
      if (!current) return { ok: false, error: 'Not signed in', status: 401 }
      const res = await call<T>(
        { action, ...params },
        `Bearer ${current.token}`
      )
      // 401 means the session expired or was revoked. Drop it locally
      // so the UI bounces back to the login screen.
      if (res.status === 401) {
        session.value = null
        writeSession(null)
      }
      return res
    },
  }
}

export type { ApiResult, AdminSession }
