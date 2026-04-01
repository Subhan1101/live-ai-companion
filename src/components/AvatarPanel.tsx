import { useRef, useEffect, useState, useCallback } from "react";
import { Mic, RefreshCw } from "lucide-react";
import * as Simli from "simli-client";
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
  onSimliReady?: (listenToTrack: (track: MediaStreamTrack) => void, clearBuffer: () => void) => void;
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
  const simliClientRef = useRef<Simli.SimliClient | null>(null);
  const [isSimliReady, setIsSimliReady] = useState(false);
  const [simliError, setSimliError] = useState<string | null>(null);

  // FIX: Store onSimliReady in a ref so it never causes the effect to re-run.
  // Without this, every parent re-render recreates the callback → triggers Simli
  // teardown + re-init in an infinite loop.
  const onSimliReadyRef = useRef(onSimliReady);
  useEffect(() => {
    onSimliReadyRef.current = onSimliReady;
  }, [onSimliReady]);

  const initSimli = useCallback(async () => {
    let isMounted = true;

    const run = async () => {
      try {
        // Close any existing session first
        if (simliClientRef.current) {
          console.log("Closing existing Simli session before reinit");
          try {
            simliClientRef.current.stop();
          } catch (e) {
            console.warn("Simli stop error:", e);
          }
          simliClientRef.current = null;
          setIsSimliReady(false);
        }

        setSimliError(null);
        console.log("Initializing Simli with face:", faceId);

        // Fetch API key from backend function
        const { data, error } = await supabase.functions.invoke("simli-token");

        if (error) {
          throw new Error(error.message || "Failed to get Simli token");
        }

        const apiKey = (data as any)?.apiKey as string | undefined;

        if (!apiKey) {
          throw new Error("No API key returned from simli-token function. Check SIMLI_API_KEY secret in Supabase.");
        }

        // Wait for video element to be available
        if (!videoRef.current || !audioRef.current) {
          console.log("Waiting for video/audio elements...");
          return;
        }

        if (!isMounted) return;

        // Create the session request configuration
        const sessionRequest = {
          faceId: faceId,
          handleSilence: false,
          maxSessionLength: 3600,
          maxIdleTime: 3600, // Increased to 1 hour to prevent 10-minute idle freeze
          model: "fasttalk" as const,
        };

        // Generate the session token
        const sessionTokenResponse = await Simli.generateSimliSessionToken({
          apiKey: apiKey,
          config: sessionRequest,
        });

        // Create a fresh Simli client instance using v3 API
        // Signature: (session_token, videoElement, audioElement, iceServers, logLevel, transport_mode)
        const simliClient = new Simli.SimliClient(
          sessionTokenResponse.session_token,
          videoRef.current,
          audioRef.current,
          null, // undefined/null iceServers
          Simli.LogLevel.DEBUG,
          "livekit" // explicitly set 'livekit' instead of default 'p2p'
        );

        simliClientRef.current = simliClient;

        // Bind failure listeners before starting
        (simliClient as any).on?.("disconnected", () => {
          console.warn("Simli disconnected unexpectedly!");
          if (isMounted) {
            setIsSimliReady(false);
            setSimliError("Avatar connection lost");
          }
        });
        (simliClient as any).on?.("failed", () => {
          console.warn("Simli failed to connect!");
          if (isMounted) {
            setIsSimliReady(false);
            setSimliError("Avatar stream failed");
          }
        });

        // Start the Simli session
        await simliClient.start();

        if (!isMounted) {
          try {
            simliClient.stop();
          } catch (e) {
            console.warn("Simli stop error:", e);
          }
          return;
        }

        console.log("Simli client started, waiting for video frames...");

        const listenToTrack = (track: MediaStreamTrack) => {
          if (simliClientRef.current) {
            simliClientRef.current.listenToMediastreamTrack(track);
          }
        };
        
        const clearBuffer = () => {
          if (simliClientRef.current) {
            simliClientRef.current.ClearBuffer();
          }
        };

        // Wait for actual video frames before signaling ready
        const video = videoRef.current;
        const signalReady = () => {
          if (!isMounted) return;
          console.log("Simli video playing — signaling ready with face:", faceId);
          setIsSimliReady(true);
          setSimliError(null);
          if (onSimliReadyRef.current) {
            onSimliReadyRef.current(listenToTrack, clearBuffer);
          }
        };

        if (video && video.readyState >= 3) {
          signalReady();
        } else if (video) {
          const onPlaying = () => {
            video.removeEventListener("playing", onPlaying);
            clearTimeout(fallback);
            signalReady();
          };
          video.addEventListener("playing", onPlaying);
          const fallback = setTimeout(() => {
            video.removeEventListener("playing", onPlaying);
            signalReady();
          }, 5000);
        }
      } catch (error) {
        console.error("Simli initialization error:", error);
        if (isMounted) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : typeof error === "string" 
              ? error 
              : "Failed to initialize avatar";
          setSimliError(errorMessage);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [faceId]);

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
        try {
          simliClientRef.current.stop();
        } catch (e) {
          console.warn("Simli stop error:", e);
        }
        simliClientRef.current = null;
        setIsSimliReady(false);
      }
      return;
    }

    // If Simli is already initialized and ready, don't reinitialize on reconnect
    if (simliClientRef.current && isSimliReady) {
      console.log("Simli already active, skipping re-initialization on reconnect");
      // Re-provide audio handler to parent in case it was lost
      if (onSimliReadyRef.current) {
        onSimliReadyRef.current(
          (track: MediaStreamTrack) => {
            if (simliClientRef.current) {
              simliClientRef.current.listenToMediastreamTrack(track);
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

    // Small delay to ensure refs are ready
    const timer = setTimeout(initSimli, 500);
    return () => clearTimeout(timer);

    // NOTE: onSimliReady intentionally excluded — stored in ref to avoid re-init loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isReconnecting, initSimli]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (simliClientRef.current) {
          simliClientRef.current.stop();
        }
      } catch (e) {
        console.warn("Simli cleanup error (safe to ignore):", e);
      }
      simliClientRef.current = null;
    };
  }, []);

  const handleRetry = useCallback(() => {
    if (!isConnected) return;
    setSimliError(null);
    setIsSimliReady(false);
    initSimli();
  }, [isConnected, initSimli]);

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
          muted={true}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isSimliReady ? "opacity-100" : "opacity-0"}`}
          style={{ objectFit: 'cover' }}
        />
        {/* FIX: audio must NOT be muted — this is what produces the avatar's voice */}
        <audio ref={audioRef} autoPlay className="hidden" />

        {/* Loading/Error state overlay */}
        {!isSimliReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500">
            {simliError ? (
              <div className="text-center p-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full border-4 border-white/30 flex items-center justify-center">
                  <span className="text-white text-xl">⚠️</span>
                </div>
                <p className="text-white font-semibold text-sm">Avatar failed to load</p>
                <p className="text-white/70 text-xs max-w-[200px] mx-auto">{simliError}</p>
                {isConnected && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                )}
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
