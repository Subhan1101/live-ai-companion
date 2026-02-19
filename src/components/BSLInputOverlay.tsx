import { useState, useCallback, useEffect } from 'react';
import { Hand, Send, X, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BSLInputOverlayProps {
  isEnabled: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  detectedSign: string | null;
  confidence: number;
  recognizedText: string;
  error: string | null;
  teacherName?: string;
  onSend: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
  onRetry?: () => void;
}

export const BSLInputOverlay = ({
  isEnabled,
  isLoading,
  isProcessing,
  detectedSign,
  confidence,
  recognizedText,
  error,
  teacherName = 'Teacher',
  onSend,
  onClear,
  onClose,
  onRetry,
}: BSLInputOverlayProps) => {
  const [showHelp, setShowHelp] = useState(true);

  // Auto-hide help after 5 seconds
  useEffect(() => {
    if (showHelp) {
      const timer = setTimeout(() => setShowHelp(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showHelp]);

  const handleSend = useCallback(() => {
    if (recognizedText.trim()) {
      onSend(recognizedText);
    }
  }, [recognizedText, onSend]);

  if (!isEnabled) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar - BSL mode indicator */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
        <Badge variant="secondary" className="bg-primary/90 text-primary-foreground gap-1.5">
          <Hand className="w-3.5 h-3.5" />
          BSL Input Active
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-black/40 hover:bg-black/60 text-white"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-card/95 rounded-xl p-4 flex flex-col items-center gap-2 shadow-lg">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading hand tracking...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-x-2 top-12 pointer-events-auto">
          <div className="bg-destructive/90 text-destructive-foreground rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span>{error}</span>
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0 text-xs h-6">
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Current sign detection indicator */}
      {detectedSign && !isLoading && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-card/95 rounded-xl px-4 py-3 shadow-lg border border-primary/30 flex flex-col items-center gap-1">
            <span className="text-3xl">{getSignEmoji(detectedSign)}</span>
            <span className="text-sm font-bold text-primary">{detectedSign}</span>
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && !detectedSign && !isLoading && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-card/90 rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Detecting sign...
          </div>
        </div>
      )}

      {/* Help tooltip */}
      {showHelp && !isLoading && !error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-[200px] pointer-events-none">
          <div className="bg-muted/95 text-muted-foreground rounded-lg px-3 py-2 text-xs text-center">
            Hold a BSL sign in front of the camera for 0.5 seconds to recognize it
          </div>
        </div>
      )}

      {/* Bottom bar - Recognized text and actions */}
      <div className="absolute bottom-2 left-2 right-2 pointer-events-auto">
        <div className="bg-card/95 rounded-xl p-3 shadow-lg border border-border">
          {/* Recognized text display */}
          <div className="mb-2">
            <div className="text-xs text-muted-foreground mb-1">Recognized Signs:</div>
            <div className="min-h-[2rem] bg-muted/50 rounded-lg px-3 py-2 text-sm font-medium">
              {recognizedText || (
                <span className="text-muted-foreground italic">Show signs to camera...</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClear}
              disabled={!recognizedText}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSend}
              disabled={!recognizedText.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              Send to {teacherName}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to get emoji for a sign
const getSignEmoji = (sign: string): string => {
  const signEmojis: Record<string, string> = {
    // Letters
    'A': '👊', 'B': '🖐️', 'C': '🤲', 'D': '👆', 'E': '✊',
    'F': '👌', 'G': '🤙', 'H': '✌️', 'I': '🤙', 'K': '✌️',
    'L': '🤟', 'O': '👌', 'V': '✌️', 'W': '🤟', 'Y': '🤙',
    // Numbers
    '0': '👌', '1': '☝️', '2': '✌️', '3': '🤟', '4': '🖐️', '5': '🖐️',
    // Words
    'Hello': '👋', 'Thank you': '🙏', 'Yes': '👍', 'No': '👎',
    'Help': '👍', 'Good': '👍', 'Bad': '👎', 'Question': '❓',
    'Stop': '✋', 'Learn': '📖', 'Think': '🤔', 'Understand': '💡',
    'Computer': '💻', 'Science': '🔬', 'Math': '🔢', 'Book': '📕',
    'Write': '✍️', 'Read': '📖', 'AI': '🤖', 'Technology': '⚙️',
    'Internet': '🌐', 'Please': '🙏',
  };
  return signEmojis[sign] || '✋';
};

export default BSLInputOverlay;
