-- POVGo fan accounts: follow creators, save videos, group them into lists.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- ─── Signup: only people who give a TikTok username become creators ──────────
-- Fan signups pass just a display name, so they get a login but no creator row.
create or replace function public.handle_new_creator()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  handle text := lower(trim(leading '@' from coalesce(new.raw_user_meta_data->>'tiktok_username', '')));
begin
  if handle <> '' then
    insert into public.creators (id, tiktok_username, display_name)
    values (new.id, handle, coalesce(new.raw_user_meta_data->>'display_name', handle))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- A fan can become a creator later by adding their TikTok username.
drop policy if exists "creators insert own" on public.creators;
create policy "creators insert own" on public.creators
  for insert with check (auth.uid() = id);

-- ─── Saved videos ("My Videos") ──────────────────────────────────────────────
create table if not exists public.saved_videos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id   uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.saved_videos enable row level security;
drop policy if exists "saved own" on public.saved_videos;
create policy "saved own" on public.saved_videos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Follows (the Feed) ──────────────────────────────────────────────────────
create table if not exists public.follows (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);
alter table public.follows enable row level security;
drop policy if exists "follows own" on public.follows;
create policy "follows own" on public.follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Lists ("My Lists") ──────────────────────────────────────────────────────
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.lists enable row level security;
drop policy if exists "lists own" on public.lists;
create policy "lists own" on public.lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.list_items (
  list_id    uuid not null references public.lists(id) on delete cascade,
  video_id   uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, video_id)
);
alter table public.list_items enable row level security;
drop policy if exists "list items own" on public.list_items;
create policy "list items own" on public.list_items
  for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

create index if not exists saved_videos_user_idx on public.saved_videos (user_id, created_at desc);
create index if not exists lists_user_idx on public.lists (user_id, created_at);
create index if not exists videos_feed_idx on public.videos (creator_id, posted_at desc) where hidden = false;

-- ─── Creator content type (what fans can choose to discover) ─────────────────
-- Existing creators start as 'food'; each creator can change it in their dashboard.
alter table public.creators add column if not exists content_type text not null default 'food';
alter table public.creators drop constraint if exists creators_content_type_check;
alter table public.creators add constraint creators_content_type_check
  check (content_type in ('food', 'fashion', 'travel', 'events', 'other'));
