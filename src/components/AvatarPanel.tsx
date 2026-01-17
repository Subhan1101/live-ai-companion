import { useRef, useEffect, useState, useCallback } from "react";
import { Mic } from "lucide-react";
import { SimliClient } from "simli-client";

interface AvatarPanelProps {
  status: "idle" | "listening" | "speaking" | "processing";
  isRecording: boolean;
  onMicPress: () => void;
  onMicRelease: () => void;
  audioLevel: number;
  onSimliReady?: (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => void;
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

// Default Simli face ID - you can change this to any available face
const SIMLI_FACE_ID = "tmp9i8bbq7c";

export const AvatarPanel = ({
  status,
  isRecording,
  onMicPress,
  onMicRelease,
  audioLevel,
  onSimliReady,
}: AvatarPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const [isSimliReady, setIsSimliReady] = useState(false);
  const [simliError, setSimliError] = useState<string | null>(null);

  // Initialize Simli client
  useEffect(() => {
    const initSimli = async () => {
      try {
        console.log("Initializing Simli...");
        
        // Fetch API key from edge function
        const response = await fetch(
          "https://jvfvwysvhqpiosvhzhkf.functions.supabase.co/functions/v1/simli-token"
        );
        
        if (!response.ok) {
          throw new Error("Failed to get Simli token");
        }
        
        const { apiKey } = await response.json();
        
        if (!apiKey) {
          throw new Error("No API key returned");
        }

        // Wait for video element to be available
        if (!videoRef.current || !audioRef.current) {
          console.log("Waiting for video/audio elements...");
          return;
        }

        const simliClient = new SimliClient();
        
        // Pass the actual elements, not the refs
        simliClient.Initialize({
          apiKey: apiKey,
          faceID: SIMLI_FACE_ID,
          handleSilence: true,
          maxSessionLength: 3600,
          maxIdleTime: 600,
          videoRef: videoRef.current,
          audioRef: audioRef.current,
          session_token: "",
          SimliURL: "",
          maxRetryAttempts: 3,
          retryDelay_ms: 2000,
          videoReceivedTimeout: 15000,
          enableSFU: true,
          model: "fasttalk",
        });

        simliClientRef.current = simliClient;

        // Start the Simli session
        await simliClient.start();
        
        console.log("Simli client started successfully");
        setIsSimliReady(true);
        setSimliError(null);

        // Provide audio sending function to parent
        if (onSimliReady) {
          onSimliReady(
            (audioData: Uint8Array) => {
              if (simliClientRef.current) {
                simliClientRef.current.sendAudioData(audioData);
              }
            },
            () => {
              if (simliClientRef.current) {
                simliClientRef.current.ClearBuffer();
              }
            }
          );
        }
      } catch (error) {
        console.error("Simli initialization error:", error);
        setSimliError(error instanceof Error ? error.message : "Failed to initialize avatar");
      }
    };

    // Small delay to ensure refs are ready
    const timer = setTimeout(initSimli, 500);

    return () => {
      clearTimeout(timer);
      if (simliClientRef.current) {
        simliClientRef.current.close();
        simliClientRef.current = null;
      }
    };
  }, [onSimliReady]);

  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening";
      case "speaking":
        return "Speaking";
      case "processing":
        return "Thinking...";
      default:
        return isSimliReady ? "Ready" : "Loading...";
    }
  };

  const isListening = status === "listening" || isRecording;

  return (
    <div className="panel-card avatar-panel flex flex-col h-full relative overflow-hidden">
      {/* Simli Avatar Video */}
      <div className="flex-1 flex items-center justify-center relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${isSimliReady ? "opacity-100" : "opacity-0"}`}
        />
        <audio ref={audioRef} autoPlay className="hidden" />
        
        {/* Loading/Error state overlay */}
        {!isSimliReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            {simliError ? (
              <div className="text-center p-4">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-white/80 text-sm">{simliError}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4 animate-pulse">🤖</div>
                <p className="text-white/80 text-sm">Loading avatar...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/40 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-display font-bold text-white drop-shadow-md">Mr. Maddle</h2>
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
    </div>
  );
};

export default AvatarPanel;