/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare const __BUILD_ID__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Newer Supabase naming — preferred. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy alias kept for backward compatibility. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Local-only: inject mock leaderboard rows so the full UI is visible. */
  readonly VITE_SEED_LEADERBOARD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
