-- POVGo business page backgrounds: a background image per business page, picked in Admin > Business Pages.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Run supabase/business-pages.sql first.

alter table public.business_pages add column if not exists bg_url  text not null default '' check (bg_url = '' or bg_url ~* '^https://');
alter table public.business_pages add column if not exists bg_tone text not null default 'light' check (bg_tone in ('light', 'dark'));

-- Public bucket for the images (anyone can see them; only admins add or remove).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-backgrounds', 'business-backgrounds', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "business backgrounds read" on storage.objects;
create policy "business backgrounds read" on storage.objects for select using (bucket_id = 'business-backgrounds');
drop policy if exists "business backgrounds admin insert" on storage.objects;
create policy "business backgrounds admin insert" on storage.objects for insert with check (bucket_id = 'business-backgrounds' and public.is_admin());
drop policy if exists "business backgrounds admin update" on storage.objects;
create policy "business backgrounds admin update" on storage.objects for update using (bucket_id = 'business-backgrounds' and public.is_admin());
drop policy if exists "business backgrounds admin delete" on storage.objects;
create policy "business backgrounds admin delete" on storage.objects for delete using (bucket_id = 'business-backgrounds' and public.is_admin());
