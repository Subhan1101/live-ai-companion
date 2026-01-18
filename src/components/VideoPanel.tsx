import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface VideoPanelProps {
  userName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOn?: boolean;
}

export const VideoPanel = ({ userName, isSpeaking, isMuted, isCameraOn = true }: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  // Get user initials for placeholder
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      if (!isCameraOn) {
        setHasVideo(false);
        setStreamActive(false);
        return;
      }

      try {
        console.log("Requesting camera access...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            setHasVideo(true);
            setStreamActive(true);
            setError(null);
          };
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Camera access denied");
        setHasVideo(false);
        setStreamActive(false);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log("Camera track stopped");
        });
      }
    };
  }, [isCameraOn]);

  return (
    <div className="panel-card flex flex-col h-full relative overflow-hidden">
      {/* Video display */}
      <div className="flex-1 bg-[#1a1f2e] relative flex items-center justify-center">
        {/* Always render video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover absolute inset-0 ${
            hasVideo && isCameraOn ? "opacity-100" : "opacity-0"
          }`}
        />
        
        {/* Placeholder when no video */}
        {(!hasVideo || !isCameraOn) && (
          <div className="flex flex-col items-center justify-center gap-4">
            {/* User avatar circle */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {getInitials(userName)}
            </div>
            
            {/* Status message */}
            <div className="text-white/60 text-sm text-center">
              {error ? (
                <span className="flex items-center gap-2">
                  <VideoOff className="w-4 h-4" />
                  {error}
                </span>
              ) : !isCameraOn ? (
                <span className="flex items-center gap-2">
                  <VideoOff className="w-4 h-4" />
                  Camera off
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Video className="w-4 h-4 animate-pulse" />
                  Starting camera...
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
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