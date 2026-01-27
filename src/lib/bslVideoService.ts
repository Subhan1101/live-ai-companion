/**
 * BSL Video Service
 * 
 * Handles fetching, caching, and preloading of BSL sign videos.
 * Supports fallback to emoji if videos are unavailable or fail to load.
 */

import { getVideoEntry, getFallbackEmoji, type BSLVideoEntry } from './bslVideoLibrary';

// Video cache using IndexedDB for persistence
const VIDEO_CACHE_NAME = 'bsl-video-cache';
const VIDEO_CACHE_VERSION = 1;

interface CachedVideo {
  sign: string;
  blob: Blob;
  timestamp: number;
  expiresAt: number;
}

interface VideoLoadResult {
  sign: string;
  url: string | null;
  objectUrl: string | null;
  fallbackEmoji: string;
  isVideo: boolean;
  error?: string;
}

// In-memory URL cache for quick access
const urlCache: Map<string, string> = new Map();

// Pending load promises to prevent duplicate requests
const pendingLoads: Map<string, Promise<VideoLoadResult>> = new Map();

/**
 * Get the proxy URL for a video (handles CORS)
 */
const getProxyUrl = (originalUrl: string): string => {
  // Use edge function proxy to handle CORS for SignBank videos
  const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bsl-video-proxy`;
  return `${proxyBase}?url=${encodeURIComponent(originalUrl)}`;
};

/**
 * Preload a video and return a blob URL
 */
const loadVideoBlob = async (url: string, useProxy: boolean = true): Promise<Blob> => {
  const fetchUrl = useProxy ? getProxyUrl(url) : url;
  
  const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'video/mp4,video/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load video: ${response.status} ${response.statusText}`);
  }

  return await response.blob();
};

/**
 * Load a video for a sign
 */
export const loadVideo = async (sign: string): Promise<VideoLoadResult> => {
  const normalizedSign = sign.toUpperCase();
  
  // Check if already loading
  const pending = pendingLoads.get(normalizedSign);
  if (pending) {
    return pending;
  }

  // Check URL cache
  const cachedUrl = urlCache.get(normalizedSign);
  if (cachedUrl) {
    const entry = getVideoEntry(normalizedSign);
    return {
      sign: normalizedSign,
      url: entry?.videoUrl || null,
      objectUrl: cachedUrl,
      fallbackEmoji: getFallbackEmoji(normalizedSign),
      isVideo: true,
    };
  }

  // Create loading promise
  const loadPromise = (async (): Promise<VideoLoadResult> => {
    const entry = getVideoEntry(normalizedSign);
    
    if (!entry || !entry.videoUrl) {
      return {
        sign: normalizedSign,
        url: null,
        objectUrl: null,
        fallbackEmoji: getFallbackEmoji(normalizedSign),
        isVideo: false,
      };
    }

    try {
      // Try loading with proxy first, then direct
      let blob: Blob;
      try {
        blob = await loadVideoBlob(entry.videoUrl, true);
      } catch (proxyError) {
        console.warn(`Proxy failed for ${normalizedSign}, trying direct:`, proxyError);
        blob = await loadVideoBlob(entry.videoUrl, false);
      }

      const objectUrl = URL.createObjectURL(blob);
      urlCache.set(normalizedSign, objectUrl);

      return {
        sign: normalizedSign,
        url: entry.videoUrl,
        objectUrl,
        fallbackEmoji: entry.fallbackEmoji,
        isVideo: true,
      };
    } catch (error) {
      console.error(`Failed to load video for ${normalizedSign}:`, error);
      return {
        sign: normalizedSign,
        url: entry.videoUrl,
        objectUrl: null,
        fallbackEmoji: entry.fallbackEmoji,
        isVideo: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      pendingLoads.delete(normalizedSign);
    }
  })();

  pendingLoads.set(normalizedSign, loadPromise);
  return loadPromise;
};

/**
 * Preload multiple videos
 */
export const preloadVideos = async (signs: string[]): Promise<Map<string, VideoLoadResult>> => {
  const results = new Map<string, VideoLoadResult>();
  
  const loadPromises = signs.map(async (sign) => {
    const result = await loadVideo(sign);
    results.set(sign.toUpperCase(), result);
  });

  await Promise.allSettled(loadPromises);
  return results;
};

/**
 * Get cached video URL or fallback
 */
export const getVideoOrFallback = (sign: string): { url: string | null; isVideo: boolean; emoji: string } => {
  const normalizedSign = sign.toUpperCase();
  const cachedUrl = urlCache.get(normalizedSign);
  
  if (cachedUrl) {
    return {
      url: cachedUrl,
      isVideo: true,
      emoji: getFallbackEmoji(normalizedSign),
    };
  }

  const entry = getVideoEntry(normalizedSign);
  return {
    url: null,
    isVideo: false,
    emoji: entry?.fallbackEmoji || '✋',
  };
};

/**
 * Clear all cached video URLs
 */
export const clearVideoCache = (): void => {
  // Revoke all object URLs
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    cachedCount: urlCache.size,
    pendingCount: pendingLoads.size,
  };
};

/**
 * Parse text to signs and preload videos
 */
export const preloadForText = async (text: string): Promise<void> => {
  const words = text.toUpperCase().split(/\s+/);
  const signsToLoad = new Set<string>();

  for (const word of words) {
    const entry = getVideoEntry(word);
    if (entry) {
      signsToLoad.add(word);
    } else {
      // Add individual letters for fingerspelling
      for (const letter of word) {
        if (/[A-Z0-9]/.test(letter)) {
          signsToLoad.add(letter);
        }
      }
    }
  }

  if (signsToLoad.size > 0) {
    await preloadVideos(Array.from(signsToLoad));
  }
};

export default {
  loadVideo,
  preloadVideos,
  getVideoOrFallback,
  clearVideoCache,
  getCacheStats,
  preloadForText,
};
