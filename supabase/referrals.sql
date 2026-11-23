-- POVGo referral codes + "Saved" counts for creators
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
--
-- After this runs, EVERY new signup (fan or creator) must enter a valid referral code.
-- Codes belong to creators (up to 3 each, made on My Spots). Existing accounts are not affected.
-- To start the chain, make your own code on My Spots from an account that already exists.
-- Emergency / launch codes not tied to a person can be added with:
--   insert into public.referral_codes (creator_id, code) values ('<an existing creator id>', 'LAUNCH');

-- ─── Codes: up to 3 per creator, letters and numbers only, unique (stored UPPERCASE) ────────────
create table if not exists public.referral_codes (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(id) on delete cascade,
  code        text not null,
  created_at  timestamptz not null default now(),
  constraint referral_code_format check (code ~ '^[A-Z0-9]{3,20}$')
);
create unique index if not exists referral_codes_code_key on public.referral_codes (code);
create index if not exists referral_codes_creator_idx on public.referral_codes (creator_id);

create or replace function public.referral_codes_guard()
returns trigger language plpgsql as $$
begin
  new.code := upper(trim(new.code));
  if tg_op = 'INSERT' and (select count(*) from public.referral_codes where creator_id = new.creator_id) >= 3 then
    raise exception 'You can have up to 3 referral codes.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists referral_codes_guard on public.referral_codes;
create trigger referral_codes_guard before insert or update on public.referral_codes
  for each row execute function public.referral_codes_guard();

alter table public.referral_codes enable row level security;
drop policy if exists "referral codes read own" on public.referral_codes;
create policy "referral codes read own" on public.referral_codes for select using (auth.uid() = creator_id);
drop policy if exists "referral codes insert own" on public.referral_codes;
create policy "referral codes insert own" on public.referral_codes for insert with check (auth.uid() = creator_id);
drop policy if exists "referral codes delete own" on public.referral_codes;
create policy "referral codes delete own" on public.referral_codes for delete using (auth.uid() = creator_id);

-- ─── Who signed up with which code (no policies: only the functions below can read it) ──────────
create table if not exists public.referral_signups (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code        text not null,
  creator_id  uuid references public.creators(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists referral_signups_creator_idx on public.referral_signups (creator_id, created_at);
alter table public.referral_signups enable row level security;

-- ─── The gate: signups without a valid code are rejected by the database itself ─────────────────
create or replace function public.require_referral_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.referral_codes
    where code = upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')))
  ) then
    raise exception 'A valid referral code is required to sign up.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists require_referral_code on auth.users;
create trigger require_referral_code before insert on auth.users
  for each row execute function public.require_referral_code();

create or replace function public.record_referral_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare rc public.referral_codes%rowtype;
begin
  select * into rc from public.referral_codes
   where code = upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  if found then
    insert into public.referral_signups (user_id, code, creator_id) values (new.id, rc.code, rc.creator_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists record_referral_signup on auth.users;
create trigger record_referral_signup after insert on auth.users
  for each row execute function public.record_referral_signup();

-- ─── Functions the app calls ────────────────────────────────────────────────────────────────────
-- Signup form: "is this code real?" (so people get a friendly message before we try to create the account)
create or replace function public.check_referral_code(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.referral_codes where code = upper(trim(coalesce(p_code, ''))));
$$;
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- Creator dashboard: signups per code for the last 1, 7 and 30 days, and in total.
-- A row with code = null covers signups from codes that were since removed.
create or replace function public.referral_stats()
returns table (code text, total bigint, d1 bigint, d7 bigint, d30 bigint)
language sql stable security definer set search_path = public as $$
  select c.code,
         count(s.user_id),
         count(s.user_id) filter (where s.created_at >= now() - interval '1 day'),
         count(s.user_id) filter (where s.created_at >= now() - interval '7 days'),
         count(s.user_id) filter (where s.created_at >= now() - interval '30 days')
    from public.referral_codes c
    left join public.referral_signups s on s.code = c.code and s.creator_id = c.creator_id
   where c.creator_id = auth.uid()
   group by c.code, c.created_at
  union all
  select null::text,
         count(*),
         count(*) filter (where s.created_at >= now() - interval '1 day'),
         count(*) filter (where s.created_at >= now() - interval '7 days'),
         count(*) filter (where s.created_at >= now() - interval '30 days')
    from public.referral_signups s
   where s.creator_id = auth.uid()
     and not exists (select 1 from public.referral_codes c where c.code = s.code and c.creator_id = s.creator_id)
  having count(*) > 0
  order by 1 nulls last;
$$;
grant execute on function public.referral_stats() to authenticated;

-- Creator dashboard: how many people saved each of the creator's videos.
create or replace function public.video_save_counts()
returns table (video_id uuid, saves bigint)
language sql stable security definer set search_path = public as $$
  select sv.video_id, count(*)
    from public.saved_videos sv
    join public.videos v on v.id = sv.video_id
   where v.creator_id = auth.uid()
   group by sv.video_id;
$$;
grant execute on function public.video_save_counts() to authenticated;
