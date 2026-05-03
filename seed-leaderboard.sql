-- ============================================================
--  Seed dummy leaderboard rows so you can see the full layout
--  while there's only one real user (you).
--
--  Paste this whole file into Supabase Dashboard → SQL Editor
--  → New query → Run.  It bypasses RLS because the SQL Editor
--  runs as the service role.
-- ============================================================

-- Step 1 — drop the FK on user_id so we can insert seed rows that
-- don't correspond to real auth.users. (Required because every
-- seeded uuid is fake.)
alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_user_id_fkey;

-- Step 2 — wipe any prior seed rows so you can re-run this safely.
delete from public.leaderboard_entries
  where display_name in (
    'Kameron Porter','Michael Kopfler','Alice Koller','Peter Dinklage',
    'George Limbof','Julia Berger','Dave Jhonson','Sarah Lee',
    'Marcus Chen','Elena Vega','Mia Thompson','Noah Brooks'
  );

-- Step 3 — insert 12 dummy users with a spread of metrics so both
-- the smoke_free_days and reduction_pct boards render meaningfully.
insert into public.leaderboard_entries
  (user_id, display_name, smoke_free_days, reduction_pct, total_logged, daily_avg, updated_at)
values
  (gen_random_uuid(), 'Kameron Porter',  100, 100, 0,   0.0, now() - interval '1 minute'),
  (gen_random_uuid(), 'Michael Kopfler',  75,  78, 12,  0.4, now() - interval '2 minutes'),
  (gen_random_uuid(), 'Alice Koller',     73,  65, 18,  0.6, now() - interval '3 minutes'),
  (gen_random_uuid(), 'Peter Dinklage',   69,  60, 22,  0.7, now() - interval '4 minutes'),
  (gen_random_uuid(), 'George Limbof',    66,  55, 14,  0.5, now() - interval '5 minutes'),
  (gen_random_uuid(), 'Julia Berger',     58,  50, 30,  0.9, now() - interval '6 minutes'),
  (gen_random_uuid(), 'Dave Jhonson',     54,  48, 28,  0.8, now() - interval '7 minutes'),
  (gen_random_uuid(), 'Sarah Lee',        45,  42, 35,  1.1, now() - interval '8 minutes'),
  (gen_random_uuid(), 'Marcus Chen',      38,  38, 41,  1.4, now() - interval '9 minutes'),
  (gen_random_uuid(), 'Elena Vega',       30,  30, 50,  1.5, now() - interval '10 minutes'),
  (gen_random_uuid(), 'Mia Thompson',     21,  22, 60,  1.8, now() - interval '11 minutes'),
  (gen_random_uuid(), 'Noah Brooks',      14,  18, 72,  2.0, now() - interval '12 minutes');

-- ============================================================
--  Cleanup — once you're done testing, run the block below to
--  remove the seed rows and put the FK back. Your real row stays.
-- ============================================================
--
-- delete from public.leaderboard_entries
--   where user_id not in (select id from auth.users);
--
-- alter table public.leaderboard_entries
--   add constraint leaderboard_entries_user_id_fkey
--   foreign key (user_id) references auth.users(id) on delete cascade;
