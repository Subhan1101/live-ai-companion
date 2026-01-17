import { Mic } from "lucide-react";

interface AvatarPanelProps {
  status: "idle" | "listening" | "speaking" | "processing";
  isRecording: boolean;
  onMicPress: () => void;
  onMicRelease: () => void;
  audioLevel: number;
}

const WaveformVisualizer = ({ audioLevel, isActive }: { audioLevel: number; isActive: boolean }) => {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5 h-4">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = i * 0.1;
        const height = isActive ? Math.max(4, (audioLevel / 100) * 16 + Math.sin(Date.now() / 200 + i) * 4) : 4;
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{
              height: `${height}px`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
};

export const AvatarPanel = ({
  status,
  isRecording,
  onMicPress,
  onMicRelease,
  audioLevel,
}: AvatarPanelProps) => {
  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening";
      case "speaking":
        return "Speaking";
      case "processing":
        return "Thinking...";
      default:
        return "Ready";
    }
  };

  const isListening = status === "listening" || isRecording;

  return (
    <div className="panel-card avatar-panel flex flex-col h-full relative">
      {/* Avatar display area */}
      <div className="flex-1 flex items-center justify-center p-8">
        {/* Placeholder for Simli Avatar - in production, this would be the avatar video */}
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center">
            <div className="text-8xl">🤖</div>
          </div>
          {status === "speaking" && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-display font-bold text-white">Mr. Maddle</h2>
          <div className={`status-badge ${isListening ? "status-listening" : "status-speaking"}`}>
            {getStatusText()}
            {isListening && <WaveformVisualizer audioLevel={audioLevel} isActive={isListening} />}
          </div>
        </div>

        {/* Push-to-talk button */}
        <button
          className="mic-button"
          onMouseDown={onMicPress}
          onMouseUp={onMicRelease}
          onMouseLeave={onMicRelease}
          onTouchStart={onMicPress}
          onTouchEnd={onMicRelease}
        >
          <Mic className={`w-6 h-6 ${isRecording ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </div>
  );
};

export default AvatarPanel;