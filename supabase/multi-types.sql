-- POVGo: let creators pick several content types.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- ─── Multiple content types per creator ──────────────────────────────────────
-- A creator can pick several of: food, fashion, travel, events, other (at least one).
-- Existing creators keep their current single type. `content_type` stays, mirroring the first pick.
alter table public.creators add column if not exists content_types text[] not null default array['food']::text[];
update public.creators set content_types = array[content_type]
  where content_types = array['food']::text[] and content_type is not null and content_type <> 'food';
alter table public.creators drop constraint if exists creators_content_types_check;
alter table public.creators add constraint creators_content_types_check
  check (cardinality(content_types) >= 1
         and content_types <@ array['food', 'fashion', 'travel', 'events', 'other']::text[]);
