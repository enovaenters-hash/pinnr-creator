import type { Platform, PlatformProvider } from './types';
import { tiktok } from './tiktok';

/** Every platform POVGo can read from. Add Instagram here once its provider exists. */
export const providers: Partial<Record<Platform, PlatformProvider>> = {
  tiktok,
};

export function getProvider(id: string): PlatformProvider | null {
  return (providers as Record<string, PlatformProvider | undefined>)[id] ?? null;
}

export const allProviders = (): PlatformProvider[] => Object.values(providers) as PlatformProvider[];
