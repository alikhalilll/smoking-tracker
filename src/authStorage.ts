/**
 * Cookie-backed storage adapter for the Supabase auth client.
 *
 * Why this exists: the default `localStorage` backing gets wiped in
 * several real-world scenarios — iOS Safari ITP after ~7 days of
 * inactivity, service-worker updates on some PWAs, "clear site data"
 * actions — silently logging the user out. Cookies with a long
 * `Max-Age` survive most of those.
 *
 * Strategy: read prefers the cookie; if absent, fall back to
 * localStorage (migrates existing sessions on first read). Write
 * persists to BOTH so a future cookie wipe still has localStorage as a
 * backstop, and vice versa. Remove clears both.
 *
 * Tokens can be ~2–3 KB. We chunk into 3.5 KB cookie pieces to stay
 * under the 4 KB per-cookie browser limit; large tokens are spelled
 * `<key>.0`, `<key>.1`, … with `<key>` storing the chunk count.
 */

import type { SupportedStorage } from '@supabase/supabase-js'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const CHUNK_SIZE = 3500

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined'
}

function cookieAttrs(): string {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; Secure'
      : ''
  return `; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null
  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split(';')) {
    const c = part.trim()
    if (c.startsWith(prefix)) {
      try {
        return decodeURIComponent(c.slice(prefix.length))
      } catch {
        return null
      }
    }
  }
  return null
}

function writeCookie(name: string, value: string): void {
  if (!isBrowser()) return
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${cookieAttrs()}`
}

function deleteCookie(name: string): void {
  if (!isBrowser()) return
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`
}

function readChunkedCookie(key: string): string | null {
  const head = readCookie(key)
  if (head == null) return null
  const n = parseInt(head, 10)
  if (!Number.isFinite(n) || n <= 0) {
    // Single-cookie value (legacy / un-chunked).
    return head
  }
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const part = readCookie(`${key}.${i}`)
    if (part == null) return null
    parts.push(part)
  }
  return parts.join('')
}

function writeChunkedCookie(key: string, value: string): void {
  // Clear any previous chunks for this key first.
  clearChunkedCookie(key)
  if (value.length <= CHUNK_SIZE) {
    writeCookie(key, value)
    return
  }
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE))
  }
  writeCookie(key, String(chunks.length))
  chunks.forEach((c, i) => writeCookie(`${key}.${i}`, c))
}

function clearChunkedCookie(key: string): void {
  const head = readCookie(key)
  if (head == null) return
  deleteCookie(key)
  const n = parseInt(head, 10)
  if (!Number.isFinite(n) || n <= 0) return
  for (let i = 0; i < n; i++) deleteCookie(`${key}.${i}`)
}

function readLocal(key: string): string | null {
  if (!isBrowser()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore — quota or disabled
  }
}

function removeLocal(key: string): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const cookieStorage: SupportedStorage = {
  getItem(key: string): string | null {
    const fromCookie = readChunkedCookie(key)
    if (fromCookie !== null) return fromCookie
    // Migration path: existing users have the session in localStorage
    // only. Read it, hydrate the cookie so subsequent reads are cheap,
    // and return.
    const fromLocal = readLocal(key)
    if (fromLocal !== null) writeChunkedCookie(key, fromLocal)
    return fromLocal
  },
  setItem(key: string, value: string): void {
    writeChunkedCookie(key, value)
    writeLocal(key, value)
  },
  removeItem(key: string): void {
    clearChunkedCookie(key)
    removeLocal(key)
  },
}
