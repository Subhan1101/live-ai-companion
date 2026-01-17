import { useEffect, useRef } from "react";
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Send, Mic, Upload } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface TranscriptPanelProps {
  messages: Message[];
  partialTranscript: string;
  isProcessing: boolean;
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const TranscriptPanel = ({ messages, partialTranscript, isProcessing }: TranscriptPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partialTranscript]);

  return (
    <div className="panel-card flex flex-col h-full border border-border/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl">
          🤖
        </div>
        <div>
          <h3 className="font-display font-bold text-lg">Aria</h3>
          <p className="text-sm text-muted-foreground">Tell me how you feel</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex gap-3 max-w-[90%]">
              {message.role === "assistant" && (
                <div className="w-10 h-10 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-lg">
                  🤖
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className={`transcript-bubble ${message.role === "assistant" ? "transcript-bubble-ai" : "transcript-bubble-user"}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                    <span className="text-xs text-status-speaking">✓✓</span>
                  </div>
                </div>
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Partial transcript while speaking */}
        {partialTranscript && (
          <div className="flex justify-end">
            <div className="flex gap-3 max-w-[90%]">
              <div className="transcript-bubble transcript-bubble-user opacity-70">
                <p className="text-sm leading-relaxed italic">{partialTranscript}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-lg">
                🤖
              </div>
              <div className="transcript-bubble transcript-bubble-ai">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-accent-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-accent-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area (decorative - voice only) */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2">
          <input
            type="text"
            placeholder="Typing Something..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled
          />
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="w-5 h-5" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Mic className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-full bg-status-speaking text-white flex items-center justify-center">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptPanel;