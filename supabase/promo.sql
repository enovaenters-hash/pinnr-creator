-- POVGo promo pop-up: the admin sets one pop-up that appears after a visitor has played N videos.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.site_promo (
  id           int primary key default 1 check (id = 1),     -- one row only
  enabled      boolean not null default false,
  title        text not null default '',
  body         text not null default '',
  button_label text not null default '',
  button_url   text not null default '',
  after_plays  int  not null default 3 check (after_plays between 1 and 100),
  repeat_days  int  not null default 7 check (repeat_days between 0 and 365),  -- 0 = show once per visitor
  updated_at   timestamptz not null default now()
);
insert into public.site_promo (id) values (1) on conflict (id) do nothing;

alter table public.site_promo enable row level security;

-- Everyone can read it (the app decides whether to show it); only admins can change it.
drop policy if exists "site promo read" on public.site_promo;
create policy "site promo read" on public.site_promo for select using (true);
drop policy if exists "site promo admin write" on public.site_promo;
create policy "site promo admin write" on public.site_promo
  for all using (public.is_admin()) with check (public.is_admin());
