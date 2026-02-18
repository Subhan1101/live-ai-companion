import { useRef, useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { SimliClient } from "simli-client";
import { supabase } from "@/integrations/supabase/client";

interface AvatarPanelProps {
  faceId: string;
  teacherName: string;
  status: "idle" | "listening" | "speaking" | "processing";
  isRecording: boolean;
  onMicPress: () => void;
  onMicRelease: () => void;
  audioLevel: number;
  isConnected: boolean;
  isReconnecting?: boolean;
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

export const AvatarPanel = ({
  faceId,
  teacherName,
  status,
  isRecording,
  onMicPress,
  onMicRelease,
  audioLevel,
  isConnected,
  isReconnecting = false,
  onSimliReady,
}: AvatarPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const [isSimliReady, setIsSimliReady] = useState(false);
  const [simliError, setSimliError] = useState<string | null>(null);

  // Initialize Simli client when connected
  useEffect(() => {
    // Only initialize when connected, but DON'T tear down during reconnects
    if (!isConnected) {
      // Skip cleanup if we're just reconnecting - keep avatar alive
      if (isReconnecting) {
        console.log("Skipping Simli cleanup during reconnect");
        return;
      }
      // Clean up when fully disconnected (not reconnecting)
      if (simliClientRef.current) {
        console.log("Cleaning up Simli client on disconnect");
        simliClientRef.current.close();
        simliClientRef.current = null;
        setIsSimliReady(false);
      }
      return;
    }

    // If Simli is already initialized and ready, don't reinitialize on reconnect
    if (simliClientRef.current && isSimliReady) {
      console.log("Simli already active, skipping re-initialization on reconnect");
      // Re-provide audio handler to parent in case it was lost
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
      return;
    }

    let isMounted = true;
    
    const initSimli = async () => {
      try {
        // Close any existing session first
        if (simliClientRef.current) {
          console.log("Closing existing Simli session before reinit");
          simliClientRef.current.close();
          simliClientRef.current = null;
          setIsSimliReady(false);
        }
        
        console.log("Initializing Simli with face:", faceId);
        
        // Fetch API key from backend function (using the client SDK avoids CORS/URL issues)
        const { data, error } = await supabase.functions.invoke("simli-token");

        if (error) {
          throw new Error(error.message || "Failed to get Simli token");
        }

        const apiKey = (data as any)?.apiKey as string | undefined;
        
        if (!apiKey) {
          throw new Error("No API key returned");
        }

        // Wait for video element to be available
        if (!videoRef.current || !audioRef.current) {
          console.log("Waiting for video/audio elements...");
          return;
        }

        if (!isMounted) return;

        // Create a fresh Simli client instance
        const simliClient = new SimliClient();
        
        // Initialize with the correct face ID
        simliClient.Initialize({
          apiKey: apiKey,
          faceID: faceId,
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
        
        if (!isMounted) {
          simliClient.close();
          return;
        }
        
        console.log("Simli client started successfully with face:", faceId);
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
        if (isMounted) {
          setSimliError(error instanceof Error ? error.message : "Failed to initialize avatar");
        }
      }
    };

    // Small delay to ensure refs are ready
    const timer = setTimeout(initSimli, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isConnected, isReconnecting, onSimliReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simliClientRef.current) {
        simliClientRef.current.close();
        simliClientRef.current = null;
      }
    };
  }, []);

  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening...";
      case "speaking":
        return "Speaking";
      case "processing":
        return "Thinking...";
      default:
        return isSimliReady ? "Say something!" : "Teacher is coming...";
    }
  };

  const isListening = status === "listening" || isRecording;

  return (
    <div className="panel-card avatar-panel flex flex-col h-full relative overflow-hidden">
      {/* Simli Avatar Video */}
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isSimliReady ? "opacity-100" : "opacity-0"}`}
          style={{ objectFit: 'cover' }}
        />
        <audio ref={audioRef} autoPlay className="hidden" />
        
        {/* Loading/Error state overlay */}
        {!isSimliReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500">
            {simliError ? (
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                <p className="text-white/80 text-sm">{simliError}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                <p className="text-white/80 text-sm">Teacher is coming...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/40 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-display font-bold text-white drop-shadow-md">{teacherName}</h2>
            <div className={`status-badge ${isListening ? "status-listening" : status === "speaking" ? "status-speaking" : ""}`}>
              {getStatusText()}
              {(isListening || status === "speaking") && <WaveformVisualizer audioLevel={status === "speaking" ? 50 : audioLevel} isActive={isListening || status === "speaking"} />}
            </div>
          </div>

          {/* Mic indicator - shows when listening */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isRecording 
              ? "bg-status-listening/20 border-2 border-status-listening" 
              : "bg-white/10 border-2 border-white/20"
          }`}>
            <Mic className={`w-6 h-6 text-white ${isRecording ? "animate-pulse" : ""}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarPanel;
