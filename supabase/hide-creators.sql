-- Hide a creator from public view (admin tool: /admin -> Creators -> Hide).
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
--
-- A hidden creator's profile page, videos, locations (map pins), groups and Top 3 all disappear for everyone
-- except that creator (they still see their own dashboard) and admins. Nothing is deleted: Unhide brings it all back.

alter table public.creators add column if not exists hidden boolean not null default false;

-- Used by the policies below. Security definer so it can see hidden creators even when the caller can't.
create or replace function public.creator_is_hidden(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select hidden from public.creators where id = cid), false);
$$;
grant execute on function public.creator_is_hidden(uuid) to anon, authenticated;

-- Only admins can change `hidden` (a creator can't unhide themselves through their own profile edit).
create or replace function public.creators_hidden_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.hidden and not public.is_admin() then new.hidden := false; end if;
  elsif new.hidden is distinct from old.hidden and auth.uid() is not null and not public.is_admin() then
    new.hidden := old.hidden;
  end if;
  return new;
end;
$$;
drop trigger if exists creators_hidden_guard on public.creators;
create trigger creators_hidden_guard before insert or update on public.creators
  for each row execute function public.creators_hidden_guard();

-- Profiles: public unless hidden (the creator and admins still see it).
drop policy if exists "creators are public" on public.creators;
create policy "creators are public" on public.creators
  for select using (not hidden or auth.uid() = id or public.is_admin());

drop policy if exists "creators admin update" on public.creators;
create policy "creators admin update" on public.creators
  for update using (public.is_admin()) with check (public.is_admin());

-- Videos (map pins, Top 3, explore, feeds): hidden when the video is hidden OR its creator is hidden.
drop policy if exists "videos readable" on public.videos;
create policy "videos readable" on public.videos
  for select using (
    (hidden = false and not public.creator_is_hidden(creator_id))
    or auth.uid() = creator_id or public.is_admin()
  );

-- Groups and their items follow the creator.
drop policy if exists "creator groups public read" on public.creator_groups;
create policy "creator groups public read" on public.creator_groups
  for select using (
    (is_public and not public.creator_is_hidden(creator_id)) or creator_id = auth.uid() or public.is_admin()
  );

drop policy if exists "creator group items public read" on public.creator_group_items;
create policy "creator group items public read" on public.creator_group_items
  for select using (exists (
    select 1 from public.creator_groups g
    where g.id = group_id
      and ((g.is_public and not public.creator_is_hidden(g.creator_id)) or g.creator_id = auth.uid() or public.is_admin())
  ));
