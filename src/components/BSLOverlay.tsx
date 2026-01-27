import { useState, useEffect, useCallback, useRef } from 'react';
import { Hand, Settings, Play, Pause, RotateCcw, X, Loader2, Video, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import BSLSettings, { type BSLSettingsState } from './BSLSettings';
import BSLVideoPlayer from './BSLVideoPlayer';
import { getVideoEntry, getFallbackEmoji, hasVideo } from '@/lib/bslVideoLibrary';
import { preloadForText } from '@/lib/bslVideoService';

// Sign library with video support - now references bslVideoLibrary
const getSignDisplay = (sign: string): { emoji: string; hasVideo: boolean } => {
  const entry = getVideoEntry(sign);
  if (entry) {
    return { emoji: entry.fallbackEmoji, hasVideo: entry.videoUrl !== null };
  }
  // Fallback for punctuation and spaces
  const punctuation: Record<string, string> = {
    '.': '⏸️', ',': '⏸️', '?': '❓', '!': '❗', ' ': '⏸️'
  };
  return { emoji: punctuation[sign] || '✋', hasVideo: false };
};

// Convert text to sign sequence - prioritize full words over fingerspelling
const textToSigns = (text: string): string[] => {
  const words = text.toUpperCase().split(/\s+/);
  const signs: string[] = [];
  
  for (const word of words) {
    // Check if word exists in video library
    const entry = getVideoEntry(word);
    if (entry) {
      signs.push(word);
    } else {
      // Fingerspell letters that exist in library
      for (const letter of word) {
        if (/[A-Z0-9]/.test(letter)) {
          signs.push(letter);
        }
      }
    }
    signs.push(' ');
  }
  
  return signs.filter(s => s.trim() || s === ' ');
};

interface BSLOverlayProps {
  text: string;
  isActive: boolean;
  settings: BSLSettingsState;
  onSettingsChange: (settings: BSLSettingsState) => void;
  onClose: () => void;
}

const positionClasses = {
  'top-left': 'top-20 left-4',
  'top-right': 'top-20 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const BSLOverlay = ({
  text,
  isActive,
  settings,
  onSettingsChange,
  onClose,
}: BSLOverlayProps) => {
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [signs, setSigns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useVideoMode, setUseVideoMode] = useState(true); // Toggle between video and emoji
  const intervalRef = useRef<number | null>(null);
  const lastTextRef = useRef<string>('');

  // Parse text into signs when text changes + preload videos
  useEffect(() => {
    if (!text) return;
    
    const newSigns = textToSigns(text);
    const isExtension = text.startsWith(lastTextRef.current) && lastTextRef.current.length > 0;
    
    if (isExtension) {
      setSigns(newSigns);
      if (!isPlaying && newSigns.length > 0 && settings.autoPlay) {
        setIsPlaying(true);
      }
    } else {
      setIsLoading(true);
      setSigns(newSigns);
      setCurrentSignIndex(0);
      
      // Preload videos for smooth playback
      if (useVideoMode) {
        preloadForText(text).finally(() => {
          setIsLoading(false);
          if (settings.autoPlay) {
            setIsPlaying(true);
          }
        });
      } else {
        setIsLoading(false);
        if (settings.autoPlay) {
          setIsPlaying(true);
        }
      }
    }
    
    lastTextRef.current = text;
  }, [text, isPlaying, settings.autoPlay, useVideoMode]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && signs.length > 0 && currentSignIndex < signs.length) {
      const delay = signs[currentSignIndex] === ' ' ? 300 : 800 / settings.speed;
      
      intervalRef.current = window.setTimeout(() => {
        setCurrentSignIndex(prev => {
          const next = prev + 1;
          if (next >= signs.length) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, delay);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentSignIndex, signs, settings.speed]);

  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const restart = useCallback(() => {
    setCurrentSignIndex(0);
    setIsPlaying(true);
  }, []);

  const currentSign = signs[currentSignIndex];
  const signDisplay = currentSign ? getSignDisplay(currentSign) : { emoji: '✋', hasVideo: false };
  const progress = signs.length > 0 ? ((currentSignIndex + 1) / signs.length) * 100 : 0;
  const currentSignHasVideo = currentSign ? hasVideo(currentSign) : false;

  if (!isActive) {
    return null;
  }

  const overlaySize = settings.isCompact 
    ? 'w-32 h-36' 
    : 'w-44 h-52';

  const signSize = settings.isCompact ? 'text-4xl' : 'text-5xl';
  const containerSize = settings.isCompact ? 'w-16 h-16' : 'w-24 h-24';

  return (
    <div
      className={cn(
        'absolute z-30 transition-all duration-300 animate-scale-in',
        positionClasses[settings.position]
      )}
    >
      <div
        className={cn(
          'bg-card/95 backdrop-blur-md rounded-xl shadow-lg border border-border/50 flex flex-col overflow-hidden transition-all duration-300',
          overlaySize
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-1">
            <Hand className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground">BSL</span>
            {currentSignHasVideo && useVideoMode && (
              <Video className="w-2.5 h-2.5 text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {/* Toggle video/emoji mode */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-5 w-5", useVideoMode ? "text-green-500" : "text-muted-foreground")}
              onClick={() => setUseVideoMode(!useVideoMode)}
              title={useVideoMode ? "Using video mode" : "Using emoji mode"}
            >
              {useVideoMode ? <Video className="w-2.5 h-2.5" /> : <Image className="w-2.5 h-2.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-primary/10"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-2.5 h-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={onClose}
            >
              <X className="w-2.5 h-2.5" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <BSLSettings
            settings={settings}
            onSettingsChange={onSettingsChange}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Main content */}
        {!showSettings && (
          <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : signs.length === 0 ? (
              <div className="flex flex-col items-center gap-1 text-center px-2">
                <div className={cn(
                  'rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30',
                  containerSize
                )}>
                  <Hand className={cn('text-primary', settings.isCompact ? 'w-6 h-6' : 'w-8 h-8')} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Waiting for response...
                </p>
              </div>
            ) : (
              <>
                {/* Sign display - Video or Emoji */}
                <div className="relative mb-2">
                  {currentSign === ' ' ? (
                    <div className={cn(
                      'rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30',
                      containerSize
                    )}>
                      <span className="text-lg text-muted-foreground">...</span>
                    </div>
                  ) : useVideoMode && currentSignHasVideo ? (
                    <BSLVideoPlayer
                      sign={currentSign}
                      playbackSpeed={settings.speed}
                      isCompact={settings.isCompact}
                      autoPlay={true}
                      loop={true}
                      className={containerSize}
                    />
                  ) : (
                    <div className={cn(
                      'rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30',
                      containerSize
                    )}>
                      <span className={cn(signSize, 'animate-pulse')}>{signDisplay.emoji}</span>
                    </div>
                  )}
                  
                  {/* Sign label */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-card border border-border rounded-full shadow-sm">
                    <span className="text-[9px] font-medium">
                      {currentSign === ' ' ? '...' : currentSign}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full px-2 mb-2">
                  <Progress value={progress} className="h-1" />
                  <p className="text-[8px] text-muted-foreground text-center mt-0.5">
                    {currentSignIndex + 1}/{signs.length}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={restart}
                    disabled={signs.length === 0}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={togglePlayback}
                    disabled={signs.length === 0}
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                  <span className="text-[9px] text-muted-foreground">{settings.speed}x</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BSLOverlay;
