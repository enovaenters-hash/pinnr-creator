-- POVGo creator preview maps (/m/<handle>): maps the admin builds for creators who aren't on POVGo yet, to share in
-- their comments. Not shown in Explore, search or anywhere else; only people with the link see them.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.preview_maps (
  handle        text primary key check (handle ~ '^[a-z0-9._]{2,40}$'),   -- TikTok @username, lowercase
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.preview_spots (
  id           uuid primary key default gen_random_uuid(),
  handle       text not null references public.preview_maps(handle) on delete cascade on update cascade,
  tiktok_id    text not null,
  caption      text,
  cover_url    text,
  video_url    text,
  posted_at    timestamptz,
  place_name   text,
  address      text,
  lat          double precision,
  lng          double precision,
  category     text,
  geocode_attempted boolean not null default false,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (handle, tiktok_id)
);
create index if not exists preview_spots_handle_idx on public.preview_spots (handle);

alter table public.preview_maps  enable row level security;
alter table public.preview_spots enable row level security;

-- Anyone with the link can read a map (hidden spots stay admin-only); only admins create, edit or delete.
drop policy if exists "preview maps read" on public.preview_maps;
create policy "preview maps read" on public.preview_maps for select using (true);
drop policy if exists "preview maps admin write" on public.preview_maps;
create policy "preview maps admin write" on public.preview_maps
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "preview spots read" on public.preview_spots;
create policy "preview spots read" on public.preview_spots for select using (not hidden or public.is_admin());
drop policy if exists "preview spots admin write" on public.preview_spots;
create policy "preview spots admin write" on public.preview_spots
  for all using (public.is_admin()) with check (public.is_admin());
