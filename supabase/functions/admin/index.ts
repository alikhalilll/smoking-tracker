/// <reference no-default-lib="true" />
/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Supabase Edge Function — admin dashboard backend.
//
// Verifies a username/password against env-var credentials, mints a
// short-lived signed bearer token, and exposes aggregate read-only
// queries against the database using the service-role key.
//
// Deploy:
//   supabase secrets set ADMIN_USERNAME=admin \
//     ADMIN_PASSWORD_HASH='$2a$10$…' \
//     ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
//   supabase functions deploy admin --no-verify-jwt
//
// The function intentionally bypasses Supabase's JWT check
// (--no-verify-jwt) — auth is handled here by Basic/Bearer.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3'

type Json = Record<string, unknown>

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') ?? ''
const ADMIN_PASSWORD_HASH = Deno.env.get('ADMIN_PASSWORD_HASH') ?? ''
const ADMIN_SESSION_SECRET = Deno.env.get('ADMIN_SESSION_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

// --- Token helpers --------------------------------------------------

const encoder = new TextEncoder()

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64Url(new Uint8Array(sig))
}

function base64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface IssuedToken {
  token: string
  expiresAt: number
}

async function issueToken(username: string): Promise<IssuedToken> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = `${username}.${expiresAt}`
  const sig = await hmac(ADMIN_SESSION_SECRET, payload)
  return {
    token: `${base64Url(encoder.encode(payload))}.${sig}`,
    expiresAt,
  }
}

async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  let payload: string
  try {
    const decoded = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
    payload = decoded
  } catch {
    return false
  }
  const [username, expiresAtStr] = payload.split('.')
  if (!username || !expiresAtStr) return false
  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  if (username !== ADMIN_USERNAME) return false
  const expected = await hmac(ADMIN_SESSION_SECRET, payload)
  return constantTimeEqual(expected, parts[1])
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// --- Auth dispatch --------------------------------------------------

async function authenticate(req: Request): Promise<{
  ok: boolean
  mode?: 'basic' | 'bearer'
  error?: string
}> {
  const auth = req.headers.get('Authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    let decoded = ''
    try {
      decoded = atob(auth.slice(6))
    } catch {
      return { ok: false, error: 'Bad credentials' }
    }
    const idx = decoded.indexOf(':')
    if (idx === -1) return { ok: false, error: 'Bad credentials' }
    const user = decoded.slice(0, idx)
    const pass = decoded.slice(idx + 1)
    if (user !== ADMIN_USERNAME) return { ok: false, error: 'Invalid login' }
    const passOk = await bcrypt.compare(pass, ADMIN_PASSWORD_HASH)
    if (!passOk) return { ok: false, error: 'Invalid login' }
    return { ok: true, mode: 'basic' }
  }
  if (auth.startsWith('Bearer ')) {
    const ok = await verifyToken(auth.slice(7))
    return ok
      ? { ok: true, mode: 'bearer' }
      : { ok: false, error: 'Session expired' }
  }
  return { ok: false, error: 'Missing credentials' }
}

// --- Aggregate queries ----------------------------------------------

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface TimeseriesPoint {
  day: string
  count: number
}

function emptyTimeseries(days: number): TimeseriesPoint[] {
  const out: TimeseriesPoint[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ day: d.toISOString().slice(0, 10), count: 0 })
  }
  return out
}

function bucketTimeseries(
  rows: Array<{ day: string }>,
  days: number
): TimeseriesPoint[] {
  const empty = emptyTimeseries(days)
  const bucket: Record<string, number> = {}
  for (const r of rows) {
    bucket[r.day] = (bucket[r.day] ?? 0) + 1
  }
  return empty.map((p) => ({ day: p.day, count: bucket[p.day] ?? 0 }))
}

async function actionOverview() {
  const sb = adminClient()
  const [
    { count: totalUsers },
    { count: totalEntries },
    { count: totalPlans },
    { data: active7Rows },
    { data: active30Rows },
    { data: planRows },
  ] = await Promise.all([
    sb.from('leaderboard_entries').select('*', { count: 'exact', head: true }),
    sb.from('entries').select('*', { count: 'exact', head: true }),
    sb.from('quit_plans').select('*', { count: 'exact', head: true }),
    sb.rpc('count_active_users', { window_days: 7 }).then(emptyOnError),
    sb.rpc('count_active_users', { window_days: 30 }).then(emptyOnError),
    sb.from('quit_plans').select('start_date, duration_days'),
  ])
  const today = new Date()
  let plansComplete = 0
  for (const p of planRows ?? []) {
    const start = new Date(p.start_date)
    start.setDate(start.getDate() + (p.duration_days ?? 0))
    if (start < today) plansComplete++
  }
  // total_users sourced from auth.users via dedicated RPC because the
  // service-role client cannot select directly from auth.* tables.
  const { data: authUsersData } = await sb.rpc('admin_user_count')
  const realTotalUsers =
    typeof authUsersData === 'number' ? authUsersData : totalUsers ?? 0

  const active7 = Array.isArray(active7Rows)
    ? Number(active7Rows[0]?.count ?? 0)
    : Number(active7Rows ?? 0)
  const active30 = Array.isArray(active30Rows)
    ? Number(active30Rows[0]?.count ?? 0)
    : Number(active30Rows ?? 0)

  return {
    total_users: realTotalUsers,
    active_7d: active7,
    active_30d: active30,
    total_entries: totalEntries ?? 0,
    total_plans: totalPlans ?? 0,
    plans_complete: plansComplete,
  }
}

function emptyOnError<T>(res: { data: T | null; error: unknown }): {
  data: T | null
} {
  return { data: res.error ? null : res.data }
}

async function actionSignupsTimeseries(days: number) {
  const sb = adminClient()
  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const { data, error } = await sb.rpc('admin_signups_per_day', {
    since_date: since.toISOString().slice(0, 10),
  })
  if (error) return emptyTimeseries(days)
  // Expected shape: [{ day: 'YYYY-MM-DD', count: N }, …]
  if (Array.isArray(data)) {
    const known = new Map<string, number>()
    for (const r of data as Array<{ day: string; count: number }>) {
      known.set(r.day.slice(0, 10), Number(r.count))
    }
    return emptyTimeseries(days).map((p) => ({
      day: p.day,
      count: known.get(p.day) ?? 0,
    }))
  }
  return emptyTimeseries(days)
}

async function actionEntriesTimeseries(days: number) {
  const sb = adminClient()
  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  const sinceDate = since.toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('entries')
    .select('date')
    .gte('date', sinceDate)
  if (error) return emptyTimeseries(days)
  const rows = (data ?? []).map((r: { date: string }) => ({ day: r.date }))
  return bucketTimeseries(rows, days)
}

async function actionIntensityBreakdown() {
  const sb = adminClient()
  const { data, error } = await sb.from('quit_plans').select('intensity')
  if (error || !data) return []
  const counts: Record<string, number> = {}
  for (const r of data as Array<{ intensity: string }>) {
    counts[r.intensity] = (counts[r.intensity] ?? 0) + 1
  }
  return Object.entries(counts).map(([intensity, count]) => ({
    intensity,
    count,
  }))
}

async function actionUserList(limit: number) {
  const sb = adminClient()
  const { data, error } = await sb.rpc('admin_user_list', { row_limit: limit })
  if (error || !data) return []
  return data
}

// --- Entrypoint -----------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !ADMIN_SESSION_SECRET) {
    return errorResponse('Admin secrets are not configured', 500)
  }

  const auth = await authenticate(req)
  if (!auth.ok) return errorResponse(auth.error ?? 'Unauthorized', 401)

  let body: Json = {}
  try {
    body = (await req.json()) as Json
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  const action = String(body.action ?? '')

  // Login is the only action that accepts Basic auth.
  if (action === 'login') {
    if (auth.mode !== 'basic') return errorResponse('Use Basic auth to log in', 401)
    const issued = await issueToken(ADMIN_USERNAME)
    return jsonResponse({ ok: true, ...issued })
  }

  // All other actions require a Bearer token.
  if (auth.mode !== 'bearer') return errorResponse('Bearer token required', 401)

  try {
    switch (action) {
      case 'overview':
        return jsonResponse(await actionOverview() as unknown as Json)
      case 'signups_timeseries': {
        const days = Math.min(180, Number(body.days ?? 30) || 30)
        return jsonResponse(await actionSignupsTimeseries(days) as unknown as Json)
      }
      case 'entries_timeseries': {
        const days = Math.min(180, Number(body.days ?? 30) || 30)
        return jsonResponse(await actionEntriesTimeseries(days) as unknown as Json)
      }
      case 'intensity_breakdown':
        return jsonResponse(await actionIntensityBreakdown() as unknown as Json)
      case 'user_list': {
        const limit = Math.min(500, Number(body.limit ?? 200) || 200)
        return jsonResponse(await actionUserList(limit) as unknown as Json)
      }
      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : 'Internal error',
      500
    )
  }
})
