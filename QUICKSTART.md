# Quick Start Guide - Pinnr Creator Dashboard

## 30-Second Setup

```bash
# 1. Install
npm install

# 2. Run
npm run dev

# 3. Visit
open http://localhost:3000
```

You're now in the Creator Dashboard.

## Try It Out

1. **Enter a username**: Type any name (e.g., "samspov")
2. **Click "Fetch Videos"**: Mock data loads (3 sample videos)
3. **Click "Add to Map"** on a video → Automatically geocodes the address
4. **View Your Map**: Click "View My Map" to see the interactive map
5. **View Combined**: Click "View All Maps" to see all creators' videos

## What You Can Do Right Now

✅ Add TikTok username
✅ Fetch sample videos (mock data)
✅ Manually edit addresses
✅ Geocode addresses to coordinates
✅ View personal map with all your locations
✅ View combined map with all creators

## What's Not Ready Yet (Phase 2)

❌ Real TikTok API (currently mock data)
❌ Real database (uses browser localStorage)
❌ User authentication
❌ Creator profiles
❌ Monetization/discount codes

## File Structure

```
pinnr-creator/
├── app/
│   ├── dashboard/       → Main dashboard page
│   ├── map/personal/    → Your personal map
│   ├── map/combined/    → Combined creator map
│   ├── api/
│   │   ├── fetch-videos → Gets videos (mock)
│   │   └── geocode      → Converts address → lat/lng
│   └── page.tsx         → Redirects to dashboard
├── components/
│   └── Map.tsx          → Leaflet map component
├── lib/
│   └── types.ts         → TypeScript types
└── package.json         → Dependencies
```

## API Endpoints

### GET /api/fetch-videos (POST)
```json
{
  "username": "samspov"
}
```

Returns mock videos with description and extracted address.

### POST /api/geocode
```json
{
  "address": "Times Square, NYC"
}
```

Returns:
```json
{
  "latitude": 40.7580,
  "longitude": -73.9855,
  "displayName": "Times Square, Manhattan, New York, ..."
}
```

## Data Storage (MVP)

All data is stored in **browser localStorage**:
- `creatorUsername` → The username entered
- `creatorLocations` → Array of geocoded locations

**Clear browser data to reset.**

## Next Phase

To add real features:
1. Replace mock `/api/fetch-videos` with real TikTok data
2. Add Supabase database for persistent storage
3. Implement user authentication
4. Add creator metadata editing

## Troubleshooting

**"No locations mapped yet"**
→ Add some videos from the dashboard

**Map not showing**
→ Make sure you have at least 1 location mapped

**Address not geocoding**
→ Try a more specific address (e.g., "Times Square, New York" instead of just "Times Square")

**Data disappeared**
→ You cleared browser cookies/localStorage. It's stored locally by design.

## Ready to Deploy?

```bash
npm run build
npm run start
```

Or push to GitHub and deploy to Vercel for free.

---

Questions? Check the README.md for more details.
