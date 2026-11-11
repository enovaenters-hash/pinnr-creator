# Pinnr Creator Dashboard

A lean MVP dashboard for TikTok creators to create maps from their videos.

## Features

- 🔗 **Connect TikTok Username** - Enter your TikTok handle
- 📹 **Auto-Fetch Videos** - Pulls your latest 20 videos
- 📍 **Extract Addresses** - Auto-detects locations from descriptions or manual entry
- 🗺️ **Personal Map** - Display your videos on an interactive map
- 🌍 **Combined Map** - See all creators' locations in one view
- 💾 **LocalStorage** - Data persists in the browser (MVP version)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

The app will automatically redirect you to the dashboard.

## How to Use

### 1. Dashboard
- Enter your TikTok username (e.g., `samspov_1`)
- Click "Fetch Videos" to pull your latest 20 videos
- Edit addresses if they weren't auto-detected
- Click "Add to Map" for each video

### 2. Personal Map
- View your locations on an interactive Leaflet map
- Click markers to see video details
- Only shows your videos

### 3. Combined Map
- View all creators' videos in one map
- See stats on total creators and locations
- Browse all locations by creator

## Tech Stack

- **Frontend**: Next.js 16 + React + TypeScript
- **Styling**: Tailwind CSS
- **Mapping**: Leaflet.js + OpenStreetMap
- **Geocoding**: Nominatim (free, open-source)
- **Storage**: Browser localStorage (MVP)

## Project Structure

```
app/
├── dashboard/          # Creator dashboard page
├── map/
│   ├── personal/      # Creator's personal map
│   └── combined/      # Combined map of all creators
├── api/
│   ├── fetch-videos/  # Fetch TikTok videos (mock data)
│   └── geocode/       # Convert address to coordinates
└── page.tsx           # Redirect to dashboard

components/
└── Map.tsx            # Leaflet map component

lib/
└── types.ts           # TypeScript interfaces
```

## Next Steps - Phase 2

- Add Supabase for persistent storage
- Real TikTok API integration
- User authentication
- Creator analytics

## Deployment

### Deploy to Vercel

```bash
# Build for production
npm run build

# Start production server
npm start
```

Push to GitHub, then import into Vercel for one-click deployment.

## Known Limitations (MVP)

- Uses browser localStorage only (MVP)
- Mock TikTok data (no real API yet)
- No user authentication
- No persistent backend database

## License

MIT
