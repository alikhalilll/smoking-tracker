# Cloud sync setup (Supabase)

The app runs locally with `localStorage` by default. To enable
cross-device sync you need a free Supabase project.

## 1. Create a project

1. Sign in at https://supabase.com (free tier is enough).
2. New project → pick a name and password, region close to you.
3. Wait ~2 minutes for it to provision.

## 2. Run the schema

In the project dashboard, open **SQL Editor → New query**, paste:

```sql
-- entries: one row per logged cigarette
-- IDs are generated client-side (uuid) so batched logs at the same
-- timestamp can each have a stable identity for sync.
create table public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  time timestamptz not null,
  date date not null,
  created_at timestamptz default now()
);

create index entries_user_time_idx on public.entries (user_id, time desc);

alter table public.entries enable row level security;

create policy "users see their own entries"
  on public.entries for select using (auth.uid() = user_id);
create policy "users insert their own entries"
  on public.entries for insert with check (auth.uid() = user_id);
create policy "users delete their own entries"
  on public.entries for delete using (auth.uid() = user_id);

-- If you set the schema up before this change you'll have a unique
-- constraint on (user_id, time). It blocks batched logs (multiple
-- cigarettes logged in the same tap share a timestamp). Drop it:
--
--   alter table public.entries
--     drop constraint if exists entries_user_id_time_key;
--
-- Also remove the default on `id` if you had it; the client now
-- supplies the uuid:
--
--   alter table public.entries
--     alter column id drop default;

-- quit_plans: at most one active plan per user
create table public.quit_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_date date not null,
  baseline integer not null,
  duration_days integer not null,
  intensity text not null check (
    intensity in ('quick','standard','gradual','extended')
  ),
  targets jsonb not null,
  updated_at timestamptz default now()
);

alter table public.quit_plans enable row level security;

create policy "users see their own plan"
  on public.quit_plans for select using (auth.uid() = user_id);
create policy "users upsert their own plan"
  on public.quit_plans for insert with check (auth.uid() = user_id);
create policy "users update their own plan"
  on public.quit_plans for update using (auth.uid() = user_id);
create policy "users delete their own plan"
  on public.quit_plans for delete using (auth.uid() = user_id);
```

Click **Run**.

## 3. Configure auth (OTP code)

Authentication → **Providers** → **Email** is on by default.

The app uses a **6-digit OTP code** instead of a magic link, because
magic links open in the system browser instead of the installed PWA.
Two settings need to be aligned for this to work:

1. Authentication → **Email Templates** → **Magic Link** template.
   Replace the body so it sends the OTP token instead of (or alongside)
   the link. The minimum is one line:

   ```
   Your sign-in code: {{ .Token }}
   ```

   You can keep the link too if you also want desktop browser users to
   click — the app will work either way.
2. Authentication → **URL Configuration** — Site URL and Redirect URLs
   are still useful for the link flow on desktop:
   - **Site URL**: `https://alikhalilll.github.io/smoking-tracker/`
   - **Redirect URLs**: add the same URL plus
     `http://localhost:5173/smoking-tracker/` for local dev.

## 4. Wire env vars

Project Settings → **API** → copy these two values:

- **Project URL** → `VITE_SUPABASE_URL`
- **publishable key** (older projects call this the "anon public key") →
  `VITE_SUPABASE_PUBLISHABLE_KEY`. This value is meant to be public; Row
  Level Security is what protects data.

### Local dev

```bash
cp .env.example .env.local
# fill in the two values
npm run dev
```

### Production (GitHub Pages)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The deploy workflow already passes them through to the build.

## 5. Use it

Open the app → Settings → **Cloud sync** → enter your email →
**Send sign-in link** → click the link in your inbox. From that point
every log syncs to the server, and signing in on another device pulls
your history down.
