import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

interface VideoPanelProps {
  userName: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

export const VideoPanel = ({ userName, isSpeaking, isMuted }: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasVideo(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Camera access denied");
      }
    };

    initCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="panel-card flex flex-col h-full relative overflow-hidden">
      {/* Video display */}
      <div className="flex-1 bg-gray-900 relative">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {error ? (
              <p className="text-white/60 text-center px-4">{error}</p>
            ) : (
              <div className="animate-pulse text-white/60">Loading camera...</div>
            )}
          </div>
        )}
        
        {/* Hidden video element for fallback */}
        {!hasVideo && <video ref={videoRef} autoPlay playsInline muted className="hidden" />}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-display font-bold text-white">{userName}</h2>
            <div className={`status-badge ${isSpeaking ? "status-speaking" : "bg-white/20 text-white"}`}>
              {isSpeaking ? "Speaking" : "Listening"}
              {isSpeaking && <Mic className="w-4 h-4" />}
            </div>
          </div>
          
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isMuted ? "bg-destructive" : "bg-white/20"}`}>
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPanel;