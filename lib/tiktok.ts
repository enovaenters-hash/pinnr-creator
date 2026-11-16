// Compatibility shim: the platform-neutral parsing now lives in ./location, and the TikTok
// scraper + provider in ./platforms/tiktok. Import from those directly in new code.
export * from './location';
export { fetchLatestVideos, poiFromAnchors } from './platforms/tiktok';
export type { RawVideo as RawTikTokVideo, Poi as TikTokPoi } from './platforms/types';
