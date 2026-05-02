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
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time timestamptz not null,
  date date not null,
  created_at timestamptz default now(),
  unique (user_id, time)
);

create index entries_user_time_idx on public.entries (user_id, time desc);

alter table public.entries enable row level security;

create policy "users see their own entries"
  on public.entries for select using (auth.uid() = user_id);
create policy "users insert their own entries"
  on public.entries for insert with check (auth.uid() = user_id);
create policy "users delete their own entries"
  on public.entries for delete using (auth.uid() = user_id);

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

## 3. Configure auth (magic link)

Authentication → **Providers** → **Email** is on by default. Make sure
"Enable email confirmations" is **off** for first run if you want
zero-friction sign-in.

In **URL Configuration**, set:

- **Site URL**: `https://alikhalilll.github.io/smoking-tracker/`
- **Redirect URLs**: add the same URL plus `http://localhost:5173/smoking-tracker/`
  for local dev.

## 4. Wire env vars

Project Settings → **API** → copy these two values:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY` (this is meant to be public;
  Row Level Security is what protects data)

### Local dev

```bash
cp .env.example .env.local
# fill in the two values
npm run dev
```

### Production (GitHub Pages)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The deploy workflow already passes them through to the build.

## 5. Use it

Open the app → Settings → **Cloud sync** → enter your email →
**Send sign-in link** → click the link in your inbox. From that point
every log syncs to the server, and signing in on another device pulls
your history down.
