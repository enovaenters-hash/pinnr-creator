/**
 * The contract every social platform plugs into. TikTok is the first; adding Instagram later
 * means writing one more provider that fills in this shape and registering it in ./index.ts.
 * Nothing else (sync, connect routes, dashboard) needs to change.
 */

export type Platform = 'tiktok' | 'instagram';

/** A creator's location tag on a video, when it points at a specific place (not just a city). */
export interface Poi {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** The platform's own category text, e.g. "Food and Drink, Japanese Cuisine, Sushi Restaurant". */
  kind: string | null;
}

/** One post, in a platform-neutral shape. (`tiktokId` is the platform's own post id for any platform.) */
export interface RawVideo {
  tiktokId: string;
  caption: string;
  coverUrl: string | null;
  videoUrl: string;
  postedAt: string | null;
  authorNickname: string | null;
  authorAvatar: string | null;
  poi: Poi | null;
}

export interface ConnectTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string | null;
  scope: string | null;
}

/** Who the creator turned out to be after they approved our app on the platform. */
export interface ConnectedProfile {
  externalId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  tokens: ConnectTokens;
}

/** Optional: platforms where the creator can log in and authorize us (official API). */
export interface OAuthSupport {
  /** False until the app's keys are set, which keeps every connect button switched off. */
  configured(): boolean;
  authorizeUrl(request: Request, state: string): string;
  exchangeCode(code: string, request: Request): Promise<ConnectedProfile>;
  refresh(refreshToken: string): Promise<ConnectTokens>;
  /** The creator's own latest posts through the official API. */
  fetchOwnVideos(accessToken: string, handle: string, count: number): Promise<RawVideo[]>;
  revoke(accessToken: string): Promise<void>;
}

export interface PlatformProvider {
  id: Platform;
  label: string;
  /** Column on `creators` that holds this platform's handle. */
  handleColumn: 'tiktok_username';
  /** Latest public posts for a handle, no login needed (the default sync source). */
  fetchLatest(handle: string, count: number): Promise<RawVideo[]>;
  oauth?: OAuthSupport;
}
