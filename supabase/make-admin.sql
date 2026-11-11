-- Give a creator account access to /admin. Change the handle, then Run.
insert into public.admins (user_id)
select id from public.creators where tiktok_username = 'lavelldishmon'
on conflict do nothing;
