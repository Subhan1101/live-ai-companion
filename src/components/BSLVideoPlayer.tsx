/**
 * BSL Video Player Component
 * 
 * A specialized video player for displaying BSL sign videos.
 * Features:
 * - Smooth video playback with looping
 * - Fallback to emoji display
 * - Playback speed control
 * - Loading states
 * - Preloading for smooth transitions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadVideo, getVideoOrFallback } from '@/lib/bslVideoService';
import { getFallbackEmoji } from '@/lib/bslVideoLibrary';

interface BSLVideoPlayerProps {
  sign: string;
  playbackSpeed?: number;
  isCompact?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  onVideoEnd?: () => void;
  onVideoLoad?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const BSLVideoPlayer = ({
  sign,
  playbackSpeed = 1,
  isCompact = false,
  autoPlay = true,
  loop = true,
  onVideoEnd,
  onVideoLoad,
  onError,
  className,
}: BSLVideoPlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [fallbackEmoji, setFallbackEmoji] = useState('✋');
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousSign = useRef<string>('');

  // Load video when sign changes
  useEffect(() => {
    if (!sign || sign === ' ') {
      setIsLoading(false);
      setIsVideoMode(false);
      setFallbackEmoji('⏸️');
      return;
    }

    // Only reload if sign actually changed
    if (sign === previousSign.current) {
      return;
    }
    previousSign.current = sign;

    setIsLoading(true);
    setFallbackEmoji(getFallbackEmoji(sign));

    // First check cache
    const cached = getVideoOrFallback(sign);
    if (cached.isVideo && cached.url) {
      setVideoUrl(cached.url);
      setIsVideoMode(true);
      setIsLoading(false);
      onVideoLoad?.();
      return;
    }

    // Load video
    loadVideo(sign).then((result) => {
      if (result.isVideo && result.objectUrl) {
        setVideoUrl(result.objectUrl);
        setIsVideoMode(true);
        onVideoLoad?.();
      } else {
        setIsVideoMode(false);
        if (result.error) {
          onError?.(result.error);
        }
      }
      setFallbackEmoji(result.fallbackEmoji);
      setIsLoading(false);
    });
  }, [sign, onVideoLoad, onError]);

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle video events
  const handleVideoEnded = useCallback(() => {
    if (!loop) {
      onVideoEnd?.();
    }
  }, [loop, onVideoEnd]);

  const handleVideoError = useCallback(() => {
    console.error('Video playback error for sign:', sign);
    setIsVideoMode(false);
    onError?.('Video playback failed');
  }, [sign, onError]);

  const handleVideoLoaded = useCallback(() => {
    setIsLoading(false);
    if (videoRef.current && autoPlay) {
      videoRef.current.play().catch(console.error);
    }
  }, [autoPlay]);

  const containerSize = isCompact ? 'w-16 h-16' : 'w-24 h-24';
  const emojiSize = isCompact ? 'text-3xl' : 'text-4xl';

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn(
        'rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30',
        containerSize,
        className
      )}>
        <Loader2 className={cn('text-primary animate-spin', isCompact ? 'w-5 h-5' : 'w-6 h-6')} />
      </div>
    );
  }

  // Render video or emoji
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 overflow-hidden',
      containerSize,
      className
    )}>
      {isVideoMode && videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          autoPlay={autoPlay}
          loop={loop}
          muted
          playsInline
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
        />
      ) : (
        <span className={cn(emojiSize, 'animate-pulse')}>
          {fallbackEmoji}
        </span>
      )}
    </div>
  );
};

export default BSLVideoPlayer;
