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
create policy "users update their own entries"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users delete their own entries"
  on public.entries for delete using (auth.uid() = user_id);

-- Existing installs: if you set up the schema before the
-- "edit entry time" feature, you must run JUST the UPDATE policy
-- above to allow the upsert that powers entry edits:
--
--   create policy "users update their own entries"
--     on public.entries for update
--     using (auth.uid() = user_id)
--     with check (auth.uid() = user_id);
--
-- Without it, every edit fails with code 42501 / "new row violates
-- row-level security policy".

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

-- leaderboard_entries: opt-in public profile of each user's quitting stats.
-- Anyone signed in can READ; only the owner can write their own row.
create table public.leaderboard_entries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  smoke_free_days integer not null default 0,
  reduction_pct numeric not null default 0,
  total_logged integer not null default 0,
  daily_avg numeric not null default 0,
  updated_at timestamptz default now()
);

create index leaderboard_smoke_free_idx
  on public.leaderboard_entries (smoke_free_days desc);
create index leaderboard_reduction_idx
  on public.leaderboard_entries (reduction_pct desc);

alter table public.leaderboard_entries enable row level security;

create policy "leaderboard read"
  on public.leaderboard_entries for select using (auth.role() = 'authenticated');
create policy "leaderboard insert own"
  on public.leaderboard_entries for insert with check (auth.uid() = user_id);
create policy "leaderboard update own"
  on public.leaderboard_entries for update using (auth.uid() = user_id);
create policy "leaderboard delete own"
  on public.leaderboard_entries for delete using (auth.uid() = user_id);

-- user_settings: theme, language, and reminder preferences. Stored as a
-- single JSONB blob so adding a new setting later is a code change, not
-- a migration. Last-write-wins via updated_at.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "users see their own settings"
  on public.user_settings for select using (auth.uid() = user_id);
create policy "users insert their own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "users update their own settings"
  on public.user_settings for update using (auth.uid() = user_id);
create policy "users delete their own settings"
  on public.user_settings for delete using (auth.uid() = user_id);

-- delete_account(): wraps the privileged auth.users delete behind a
-- SECURITY DEFINER function so a signed-in client can wipe their own
-- account with a single RPC call. Foreign keys on the public.* tables
-- are ON DELETE CASCADE, so removing the auth.users row also clears
-- entries / quit_plans / leaderboard_entries / user_settings.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;

-- email_exists(): used by the sign-in card's email-first flow to decide
-- whether to show the "Welcome back" or "Create your account" step.
-- Returns a boolean so the only thing leaked is whether the email is
-- already registered — which a try-signin-then-signup flow leaks
-- implicitly anyway.
create or replace function public.email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return exists(select 1 from auth.users where lower(email) = lower(p_email));
end;
$$;

revoke all on function public.email_exists(text) from public;
grant execute on function public.email_exists(text) to anon, authenticated;
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

## 6. Social login (optional)

The app supports Google, Apple, Facebook, and GitHub via Supabase's
OAuth flow. Each provider you want to enable is configured separately:

### Common steps (all providers)

1. Authentication → **URL Configuration** in Supabase. Make sure your
   **Site URL** and **Redirect URLs** include both production and dev:
   - `https://alikhalilll.github.io/smoking-tracker/`
   - `http://localhost:5173/smoking-tracker/`
2. Authentication → **Providers** in Supabase. Enable the provider and
   paste the Client ID + Client Secret (per provider, see below).
3. The Supabase OAuth callback URL — copy it from the provider settings
   panel — needs to be registered as the redirect URI on the provider's
   side. It looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Authentication → **Settings** → enable **"Manual linking"**. This is
   required for the Settings → Linked accounts feature in the app, which
   lets a signed-in user attach extra providers (Google/Apple/etc) to
   their existing account without creating a duplicate.

### Google

1. https://console.cloud.google.com → Create project (or pick existing).
2. APIs & Services → **OAuth consent screen** → External → fill required
   fields → add your email as a test user.
3. APIs & Services → **Credentials** → **Create credentials** → OAuth
   client ID → **Web application**.
4. Authorized redirect URIs: paste the Supabase callback URL.
5. Copy Client ID + Client secret into Supabase.

### Apple

Requires an Apple Developer account ($99/yr).

1. developer.apple.com → Certificates, Identifiers & Profiles.
2. Identifiers → **App IDs** → New (if you don't have one) → enable
   "Sign In with Apple".
3. Identifiers → **Services IDs** → New. Set the identifier (e.g.
   `com.example.smokingtracker.signin`). Enable "Sign In with Apple",
   click **Configure**, set Web Domain to `<project-ref>.supabase.co`,
   Return URLs to the Supabase callback URL.
4. Keys → New → enable "Sign In with Apple", attach the App ID, save
   the .p8 key file once (it can only be downloaded once).
5. In Supabase Apple provider settings, paste:
   - **Services ID** as the Client ID
   - The .p8 key contents (Supabase generates a JWT client secret from it)
   - Team ID and Key ID

### Facebook

1. https://developers.facebook.com → Create app → Consumer.
2. Add the **Facebook Login** product.
3. Settings → Basic → copy App ID + App Secret.
4. Facebook Login → Settings → Valid OAuth Redirect URIs: paste the
   Supabase callback URL.
5. Paste App ID + App Secret into Supabase.

### GitHub

1. https://github.com/settings/developers → **New OAuth App**.
2. Authorization callback URL: paste the Supabase callback URL.
3. Generate a client secret. Paste Client ID + Client secret into Supabase.

## 7. Admin dashboard (optional)

The `/admin` route in the app talks to a Supabase Edge Function that
verifies env-var credentials before reading aggregate data with the
service-role key.

### 7a. Add the supporting RPCs

Run this in **SQL Editor → New query** (one-off):

```sql
-- Returns the total number of registered users (auth.users is hidden
-- from anon/service-role direct selects in some Supabase configs, so
-- we wrap it in a SECURITY DEFINER function called by the Edge Function).
create or replace function public.admin_user_count()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return (select count(*)::int from auth.users);
end;
$$;

revoke all on function public.admin_user_count() from public;
grant execute on function public.admin_user_count() to service_role;

-- Sign-ups grouped by day, since a given date.
create or replace function public.admin_signups_per_day(since_date date)
returns table(day text, count integer)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select to_char(date_trunc('day', u.created_at), 'YYYY-MM-DD') as day,
           count(*)::int as count
    from auth.users u
    where u.created_at >= since_date
    group by 1
    order by 1;
end;
$$;

revoke all on function public.admin_signups_per_day(date) from public;
grant execute on function public.admin_signups_per_day(date) to service_role;

-- Users active in the last `window_days` days (logged a cigarette).
create or replace function public.count_active_users(window_days integer)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return (
    select count(distinct e.user_id)::int
    from public.entries e
    where e.date >= (current_date - window_days)
  );
end;
$$;

revoke all on function public.count_active_users(integer) from public;
grant execute on function public.count_active_users(integer) to service_role;

-- Per-user summary for the admin dashboard's user list. Returns email,
-- join date, total entries, whether they have a quit plan, and the most
-- recent log timestamp.
create or replace function public.admin_user_list(row_limit integer default 200)
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  total_entries integer,
  has_plan boolean,
  last_log_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select u.id,
           u.email,
           u.created_at,
           coalesce(e_counts.cnt, 0)::int as total_entries,
           (qp.user_id is not null) as has_plan,
           e_counts.last_log
    from auth.users u
    left join (
      select user_id, count(*)::int as cnt, max(time) as last_log
      from public.entries
      group by user_id
    ) e_counts on e_counts.user_id = u.id
    left join public.quit_plans qp on qp.user_id = u.id
    order by u.created_at desc
    limit row_limit;
end;
$$;

revoke all on function public.admin_user_list(integer) from public;
grant execute on function public.admin_user_list(integer) to service_role;

-- Per-user account fields the service role can't read directly
-- (auth.users is hidden from non-superuser roles in some Supabase
-- configurations). Used by the admin "user activity" drawer.
create or replace function public.admin_user_activity_account(p_user_id uuid)
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  providers text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select u.id,
           u.email::text,
           u.created_at,
           u.last_sign_in_at,
           u.email_confirmed_at,
           coalesce(
             array(
               select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')
             ),
             array[]::text[]
           ) as providers
    from auth.users u
    where u.id = p_user_id;
end;
$$;

revoke all on function public.admin_user_activity_account(uuid) from public;
grant execute on function public.admin_user_activity_account(uuid) to service_role;
```

### 7b. Deploy the Edge Function

```bash
# 1. Generate a bcrypt hash of the admin password locally
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'YOUR_PASSWORD'

# 2. Set Supabase secrets
supabase secrets set \
  ADMIN_USERNAME=admin \
  ADMIN_PASSWORD_HASH='$2a$10$…' \
  ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"

# 3. Deploy the function
supabase functions deploy admin --no-verify-jwt
```

Then visit `https://alikhalilll.github.io/smoking-tracker/#/admin` and
sign in with the username/password you set.
