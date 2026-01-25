import { useState, useEffect, useCallback, useRef } from 'react';
import { Hand, Volume2, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BSLPanelProps {
  text: string;
  isActive: boolean;
  onSignComplete?: () => void;
  className?: string;
}

// Sign to animation mapping (using text-based representations for now)
// In production, these would be GIF/WebM URLs
const signLibrary: Record<string, string> = {
  // Alphabet
  'A': '👊', 'B': '🖐️', 'C': '🤲', 'D': '👆', 'E': '✊',
  'F': '👌', 'G': '🤙', 'H': '✌️', 'I': '🤙', 'J': '🤙',
  'K': '✌️', 'L': '🤟', 'M': '✊', 'N': '✊', 'O': '👌',
  'P': '👇', 'Q': '👇', 'R': '✌️', 'S': '✊', 'T': '✊',
  'U': '✌️', 'V': '✌️', 'W': '🤟', 'X': '👆', 'Y': '🤙',
  'Z': '👆',
  // Numbers
  '0': '👌', '1': '☝️', '2': '✌️', '3': '🤟', '4': '🖐️',
  '5': '🖐️', '6': '🤙', '7': '🤟', '8': '🤘', '9': '👆',
  // Common words
  'HELLO': '👋', 'GOODBYE': '👋', 'THANK': '🙏', 'YOU': '👆',
  'PLEASE': '🙏', 'SORRY': '✊', 'YES': '👍', 'NO': '👎',
  'HELP': '👍', 'GOOD': '👍', 'BAD': '👎', 'LOVE': '🤟',
  'FRIEND': '🤝', 'FAMILY': '👨‍👩‍👧', 'SCHOOL': '📚', 'LEARN': '📖',
  'TEACHER': '👨‍🏫', 'STUDENT': '👨‍🎓', 'QUESTION': '❓', 'ANSWER': '💬',
  'UNDERSTAND': '💡', 'DONT': '🚫', 'KNOW': '🧠', 'THINK': '🤔',
  'WANT': '👈', 'NEED': '👐', 'LIKE': '👍', 'HAPPY': '😊',
  'SAD': '😢', 'ANGRY': '😠', 'TIRED': '😴', 'HUNGRY': '🍽️',
  // Punctuation
  '.': '⏸️', ',': '⏸️', '?': '❓', '!': '❗', ' ': '⏸️'
};

// Convert text to sign sequence
const textToSigns = (text: string): string[] => {
  const words = text.toUpperCase().split(/\s+/);
  const signs: string[] = [];
  
  for (const word of words) {
    // Check if word exists as a whole sign
    if (signLibrary[word]) {
      signs.push(word);
    } else {
      // Fingerspell letter by letter
      for (const letter of word) {
        if (signLibrary[letter]) {
          signs.push(letter);
        }
      }
    }
    signs.push(' '); // Add pause between words
  }
  
  return signs.filter(s => s.trim() || s === ' ');
};

export const BSLPanel = ({ text, isActive, onSignComplete, className = '' }: BSLPanelProps) => {
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [signs, setSigns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Parse text into signs when text changes
  useEffect(() => {
    if (text) {
      setIsLoading(true);
      const newSigns = textToSigns(text);
      setSigns(newSigns);
      setCurrentSignIndex(0);
      setIsPlaying(true);
      setIsLoading(false);
    }
  }, [text]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && signs.length > 0 && currentSignIndex < signs.length) {
      const delay = signs[currentSignIndex] === ' ' ? 300 : 800 / playbackSpeed;
      
      intervalRef.current = window.setTimeout(() => {
        setCurrentSignIndex(prev => {
          const next = prev + 1;
          if (next >= signs.length) {
            setIsPlaying(false);
            onSignComplete?.();
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
  }, [isPlaying, currentSignIndex, signs, playbackSpeed, onSignComplete]);

  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const restart = useCallback(() => {
    setCurrentSignIndex(0);
    setIsPlaying(true);
  }, []);

  const currentSign = signs[currentSignIndex];
  const signEmoji = currentSign ? signLibrary[currentSign] || '✋' : null;
  const progress = signs.length > 0 ? ((currentSignIndex + 1) / signs.length) * 100 : 0;

  if (!isActive) {
    return null;
  }

  return (
    <div className={`bg-card rounded-2xl shadow-card h-full flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Hand className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">BSL Response</h3>
            <p className="text-xs text-muted-foreground">Sign Language Output</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={restart}
            disabled={signs.length === 0}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={togglePlayback}
            disabled={signs.length === 0}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Main display area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Preparing signs...</p>
          </div>
        ) : signs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30">
              <Hand className="w-10 h-10 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                BSL Mode Active
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask the teacher a question! The response will be shown here as BSL hand signs.
              </p>
            </div>
            <div className="mt-2 px-3 py-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-primary">
                💡 Tip: Ask short questions for clearer sign responses
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Current sign display */}
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30 shadow-lg">
                {currentSign === ' ' ? (
                  <span className="text-2xl text-muted-foreground">...</span>
                ) : (
                  <span className="text-6xl animate-pulse">{signEmoji}</span>
                )}
              </div>
              
              {/* Sign label */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-card border border-border rounded-full shadow-sm">
                <span className="text-sm font-medium">
                  {currentSign === ' ' ? 'pause' : currentSign}
                </span>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="w-full max-w-[200px] mb-4">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {currentSignIndex + 1} / {signs.length}
              </p>
            </div>

            {/* Speed control */}
            <div className="flex items-center gap-3 w-full max-w-[200px]">
              <span className="text-xs text-muted-foreground">Speed</span>
              <Slider
                value={[playbackSpeed]}
                onValueChange={([value]) => setPlaybackSpeed(value)}
                min={0.5}
                max={2}
                step={0.25}
                className="flex-1"
              />
              <span className="text-xs font-medium w-8">{playbackSpeed}x</span>
            </div>
          </>
        )}
      </div>

      {/* Text preview */}
      {text && (
        <div className="p-3 border-t border-border bg-muted/30">
          <ScrollArea className="h-16">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Text: </span>
              {text}
            </p>
          </ScrollArea>
        </div>
      )}

      {/* Legend */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            <span>Voice + Signs</span>
          </div>
          <div className="flex items-center gap-1">
            <Hand className="w-3 h-3" />
            <span>BSL Mode Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BSLPanel;
