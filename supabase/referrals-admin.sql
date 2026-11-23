-- Admin tools for referral codes (the "Referrals" tab on /admin).
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Needs supabase/referrals.sql to have been run first.
--
-- "House codes" are codes owned by no creator (like POVGO). Only admins can add, rename or delete them.

-- Every code on the site (house and creator-owned) with signup counts for 1 / 7 / 30 days and all time.
create or replace function public.admin_referral_overview()
returns table (code text, owner text, house boolean, total bigint, d1 bigint, d7 bigint, d30 bigint)
language sql stable security definer set search_path = public as $$
  select c.code,
         cr.tiktok_username,
         c.creator_id is null,
         count(s.user_id),
         count(s.user_id) filter (where s.created_at >= now() - interval '1 day'),
         count(s.user_id) filter (where s.created_at >= now() - interval '7 days'),
         count(s.user_id) filter (where s.created_at >= now() - interval '30 days')
    from public.referral_codes c
    left join public.creators cr on cr.id = c.creator_id
    left join public.referral_signups s on s.code = c.code
   where public.is_admin()
   group by c.code, cr.tiktok_username, c.creator_id
   order by (c.creator_id is null) desc, 4 desc, c.code;
$$;
grant execute on function public.admin_referral_overview() to authenticated;

create or replace function public.admin_add_house_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v text := upper(trim(coalesce(p_code, '')));
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = 'P0001'; end if;
  if v !~ '^[A-Z0-9]{3,20}$' then raise exception 'Use 3 to 20 letters or numbers.' using errcode = 'P0001'; end if;
  insert into public.referral_codes (creator_id, code) values (null, v);
  return v;
end;
$$;
grant execute on function public.admin_add_house_code(text) to authenticated;

-- Renames a house code and keeps its signup history attached to the new name.
create or replace function public.admin_rename_house_code(p_old text, p_new text)
returns text language plpgsql security definer set search_path = public as $$
declare o text := upper(trim(coalesce(p_old, '')));
        n text := upper(trim(coalesce(p_new, '')));
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = 'P0001'; end if;
  if n !~ '^[A-Z0-9]{3,20}$' then raise exception 'Use 3 to 20 letters or numbers.' using errcode = 'P0001'; end if;
  update public.referral_codes set code = n where code = o and creator_id is null;
  if not found then raise exception 'That house code doesn''t exist.' using errcode = 'P0001'; end if;
  update public.referral_signups set code = n where code = o and creator_id is null;
  return n;
end;
$$;
grant execute on function public.admin_rename_house_code(text, text) to authenticated;

create or replace function public.admin_delete_house_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = 'P0001'; end if;
  delete from public.referral_codes where code = upper(trim(coalesce(p_code, ''))) and creator_id is null;
  if not found then raise exception 'That house code doesn''t exist.' using errcode = 'P0001'; end if;
end;
$$;
grant execute on function public.admin_delete_house_code(text) to authenticated;
