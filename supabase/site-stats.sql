-- POVGo: public site totals for the home page (counts only, no personal data).
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- "fans" = accounts that aren't creators.
create or replace function public.site_stats()
returns json
language sql
stable
security definer set search_path = public, auth
as $$
  select json_build_object(
    'creators',  (select count(*) from public.creators),
    'fans',      (select count(*) from auth.users u where not exists (select 1 from public.creators c where c.id = u.id)),
    'locations', (select count(*) from public.videos where hidden = false and lat is not null)
  );
$$;
grant execute on function public.site_stats() to anon, authenticated;
