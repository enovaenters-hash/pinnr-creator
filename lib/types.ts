export interface TikTokVideo {
  id: string;
  videoId: string;
  description: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  address?: string;
  cuisine?: string;
}

export interface CreatorLocation {
  id: string;
  creatorUsername: string;
  videoId: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  cuisine?: string;
  thumbnail: string;
}

export interface Creator {
  username: string;
  locations: CreatorLocation[];
  lastSync: string;
}
