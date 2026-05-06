/**
 * Display-name validator for the public leaderboard.
 *
 * The lists below cover the most common offensive substrings in English
 * and Arabic — slurs, sexual terms, and impersonation handles like
 * "admin". They're intentionally conservative; a long list increases
 * false positives (the Scunthorpe problem). Extend cautiously.
 *
 * The matcher normalizes input first:
 *   - Unicode NFKD + strips combining marks (so "fück" / "ḟṳçḳ" still
 *     match "fuck", and Arabic tashkeel diacritics don't hide a slur).
 *   - Leetspeak swap (4→a, 1→i, etc.) for the English pass.
 *   - Removes punctuation/spacing so "f.u.c.k" and "f u c k" still match.
 */

const BANNED_SUBSTRINGS_EN: ReadonlyArray<string> = [
  // sexual / explicit
  'fuck', 'fuk', 'shit', 'pussy', 'cock', 'dick', 'cunt', 'asshole',
  'penis', 'vagina', 'boobs', 'tits', 'porn', 'cum', 'orgasm',
  'masturbat', 'horny', 'nude', 'naked', 'erection', 'blowjob',
  // slurs (anti-Black, anti-LGBTQ, ableist, ethnic)
  'nigger', 'nigga', 'faggot', 'fagot', 'retard', 'tranny', 'kike',
  'chink', 'spic', 'gook', 'wetback',
  // general profanity
  'bitch', 'bastard', 'slut', 'whore', 'wanker', 'motherfucker',
  // impersonation / role-squat
  'admin', 'administrator', 'moderator', 'support', 'staff',
  'system', 'official', 'supabase',
]

const BANNED_SUBSTRINGS_AR: ReadonlyArray<string> = [
  // common explicit / sexual
  'كس', 'زب', 'شرموط', 'شرموطة', 'متناك', 'متناكة', 'لبوة',
  'عاهرة', 'منيوك', 'منيوكة', 'لوطي', 'احا', 'طيز', 'كحبة',
  'قحبة', 'نيك', 'ينيك', 'منياك', 'سحاقية',
  // slurs / insults commonly weaponized
  'خول', 'كافر', 'كلب', 'حمار', 'وسخ',
  // impersonation
  'مسؤول', 'إدارة', 'مدير', 'دعم', 'مشرف',
]

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '8': 'b', '@': 'a', '$': 's', '!': 'i',
}

function normalizeForLatinPass(input: string): string {
  let s = input.toLowerCase().normalize('NFKD')
  // Drop combining marks (diacritics, tashkeel, etc.).
  s = s.replace(/\p{M}+/gu, '')
  // Leetspeak swap.
  s = s
    .split('')
    .map((c) => LEET_MAP[c] ?? c)
    .join('')
  // Remove anything that isn't a letter or digit so spacing/punctuation
  // can't be used to slip through ("f-u-c-k").
  s = s.replace(/[^\p{L}\p{N}]+/gu, '')
  return s
}

function normalizeForArabicPass(input: string): string {
  let s = input.normalize('NFKC')
  // Strip Arabic tashkeel and tatweel.
  s = s.replace(/[ً-ْٰـ]/g, '')
  // Collapse internal whitespace + punctuation.
  s = s.replace(/[^\p{L}\p{N}]+/gu, '')
  return s
}

export type NameValidationReason =
  | 'too_short'
  | 'too_long'
  | 'banned'
  | 'invalid_chars'

export interface NameValidation {
  ok: boolean
  reason?: NameValidationReason
}

const MIN_LEN = 2
const MAX_LEN = 30

/**
 * Validate a leaderboard display name. Returns `{ ok: true }` if the
 * name passes, or `{ ok: false, reason }` otherwise.
 *
 * The reason is a stable enum the caller can map to a localized
 * message; it's not user-facing text on its own.
 */
export function validateDisplayName(raw: string): NameValidation {
  const trimmed = raw.trim()
  if (trimmed.length < MIN_LEN) return { ok: false, reason: 'too_short' }
  if (trimmed.length > MAX_LEN) return { ok: false, reason: 'too_long' }
  // Must contain at least one letter so we don't accept "...." or "1234".
  if (!/\p{L}/u.test(trimmed)) return { ok: false, reason: 'invalid_chars' }

  const latin = normalizeForLatinPass(trimmed)
  for (const w of BANNED_SUBSTRINGS_EN) {
    if (latin.includes(w)) return { ok: false, reason: 'banned' }
  }

  const arabic = normalizeForArabicPass(trimmed)
  for (const w of BANNED_SUBSTRINGS_AR) {
    if (arabic.includes(w)) return { ok: false, reason: 'banned' }
  }

  return { ok: true }
}

export const DISPLAY_NAME_LIMITS = { min: MIN_LEN, max: MAX_LEN } as const
