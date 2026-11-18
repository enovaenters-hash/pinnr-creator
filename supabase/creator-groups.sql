-- POVGo creator groups: a creator bundles their own videos into named groups
-- ("Date night", "Best tacos") that show on their public page /c/<username>.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.creator_groups (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.creators(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
alter table public.creator_groups enable row level security;

-- Anyone can see groups (they're on the public creator page); only the owner can change them.
drop policy if exists "creator groups public read" on public.creator_groups;
create policy "creator groups public read" on public.creator_groups
  for select using (true);
drop policy if exists "creator groups owner write" on public.creator_groups;
create policy "creator groups owner write" on public.creator_groups
  for all using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create table if not exists public.creator_group_items (
  group_id   uuid not null references public.creator_groups(id) on delete cascade,
  video_id   uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, video_id)
);
alter table public.creator_group_items enable row level security;

-- Public read. Hidden videos still stay off the page: the videos table only shows them to their owner.
drop policy if exists "creator group items public read" on public.creator_group_items;
create policy "creator group items public read" on public.creator_group_items
  for select using (true);

-- The owner can add only their own videos to their own groups.
drop policy if exists "creator group items owner write" on public.creator_group_items;
create policy "creator group items owner write" on public.creator_group_items
  for all
  using (exists (select 1 from public.creator_groups g where g.id = group_id and g.creator_id = auth.uid()))
  with check (
    exists (select 1 from public.creator_groups g where g.id = group_id and g.creator_id = auth.uid())
    and exists (select 1 from public.videos v where v.id = video_id and v.creator_id = auth.uid())
  );

create index if not exists creator_groups_creator_idx on public.creator_groups (creator_id, position, created_at);
create index if not exists creator_group_items_video_idx on public.creator_group_items (video_id);

-- ─── Public / private per group ──────────────────────────────────────────────
-- Private groups are visible only to their creator; fans never see them or their items.
alter table public.creator_groups add column if not exists is_public boolean not null default true;

drop policy if exists "creator groups public read" on public.creator_groups;
create policy "creator groups public read" on public.creator_groups
  for select using (is_public or creator_id = auth.uid());

drop policy if exists "creator group items public read" on public.creator_group_items;
create policy "creator group items public read" on public.creator_group_items
  for select using (exists (
    select 1 from public.creator_groups g
    where g.id = group_id and (g.is_public or g.creator_id = auth.uid())
  ));
