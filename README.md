# POVGo — creator maps from TikTok (Phase 2)

Creators sign up with email + their TikTok username, tap **Sync Videos**, and their
latest TikToks land on a public map. Fans browse one creator (`/c/<username>`) or
everyone (`/map`).

## Pages
| Path | What it is |
|---|---|
| `/signup`, `/login` | Email/password auth (Supabase) |
| `/dashboard` | Creator dashboard: sync, edit place name / category / address / discount code, star top 3, hide |
| `/c/<username>` | Public map for one creator |
| `/map` | Combined map of all creators |

## How sync works
`POST /api/sync` pulls the creator's latest 20 videos from the unofficial TikWM API,
inserts only videos not already stored, refreshes cover images (TikTok image links
expire), pulls the place + address out of the caption, and geocodes with OpenStreetMap
(about 15 lookups per sync; the rest are placed on the next sync).

The TikTok source lives in one function, `fetchLatestVideos` in `lib/tiktok.ts`, so it
can be swapped for an official or paid API later.

## Setup
1. **Supabase** — in Vercel open the project → *Storage* / *Integrations* → add **Supabase**
   and connect it to this project. That sets `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` automatically.
2. **Database** — in Supabase open *SQL Editor* → paste `supabase/schema.sql` → *Run*.
3. **(Optional) instant signup** — Supabase → *Authentication* → *Sign In / Providers* →
   *Email* → turn off **Confirm email**.
4. Redeploy on Vercel (any `git push` does this).

Local dev: put the two env vars in `.env.local`, then `npm install && npm run dev`.

## Known limits (MVP)
- TikWM is unofficial and rate-limited (~1 request/second); it can break if TikTok changes.
- Captions without an address need the creator to add one in **Edit**.
- Covers for videos older than the latest 20 eventually stop loading (TikTok link expiry).
