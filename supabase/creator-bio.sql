-- POVGo creator bio: a short line (150 characters max) shown at the top of the creator's page.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

alter table public.creators add column if not exists bio text;
alter table public.creators drop constraint if exists creators_bio_len;
alter table public.creators add constraint creators_bio_len check (bio is null or char_length(bio) <= 150);
