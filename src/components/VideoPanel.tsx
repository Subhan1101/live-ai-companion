import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, RefreshCw, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBSLRecognition } from "@/hooks/useBSLRecognition";
import BSLInputOverlay from "@/components/BSLInputOverlay";

interface VideoPanelProps {
  userName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOn?: boolean;
  onBSLInput?: (text: string) => void;
}

export const VideoPanel = ({ userName, isSpeaking, isMuted, isCameraOn = true, onBSLInput }: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // BSL Recognition hook
  const {
    isEnabled: isBSLInputEnabled,
    isLoading: isBSLLoading,
    isProcessing: isBSLProcessing,
    detectedSign,
    confidence,
    recognizedText,
    error: bslError,
    toggleBSL,
    clearRecognizedText,
    sendRecognizedText,
  } = useBSLRecognition(videoRef, {
    confidenceThreshold: 0.6,
    detectionInterval: 100,
    signHoldTime: 500,
  });

  // Handle BSL text send
  const handleBSLSend = useCallback((text: string) => {
    if (onBSLInput && text.trim()) {
      onBSLInput(text);
    }
  }, [onBSLInput]);

  // Get user initials for placeholder
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initCamera = useCallback(async () => {
    if (!isCameraOn) {
      setHasVideo(false);
      setStreamActive(false);
      return;
    }

    setIsRetrying(true);
    setError(null);

    try {
      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          setHasVideo(true);
          setStreamActive(true);
          setError(null);
          setIsRetrying(false);
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      
      // Provide helpful error messages
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera permission denied. Click below to retry.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is in use by another app.");
      } else {
        setError("Could not access camera.");
      }
      
      setHasVideo(false);
      setStreamActive(false);
      setIsRetrying(false);
    }
  }, [isCameraOn]);

  const handleRetryCamera = useCallback(() => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    initCamera();
  }, [initCamera]);

  useEffect(() => {
    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Camera track stopped");
        });
      }
    };
  }, [isCameraOn, initCamera]);

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
        
        {/* BSL Input Overlay */}
        <BSLInputOverlay
          isEnabled={isBSLInputEnabled}
          isLoading={isBSLLoading}
          isProcessing={isBSLProcessing}
          detectedSign={detectedSign}
          confidence={confidence}
          recognizedText={recognizedText}
          error={bslError}
          onSend={handleBSLSend}
          onClear={clearRecognizedText}
          onClose={toggleBSL}
        />
        
        {/* Placeholder when no video */}
        {(!hasVideo || !isCameraOn) && (
          <div className="flex flex-col items-center justify-center gap-4 p-4">
            {/* User avatar circle */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {getInitials(userName)}
            </div>
            
            {/* Status message */}
            <div className="text-white/60 text-sm text-center">
              {error ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="flex items-center gap-2">
                    <VideoOff className="w-4 h-4" />
                    {error}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryCamera}
                    disabled={isRetrying}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        Enable Camera
                      </>
                    )}
                  </Button>
                </div>
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
          
          <div className="flex items-center gap-2">
            {/* BSL Input toggle button */}
            {hasVideo && isCameraOn && !isBSLInputEnabled && (
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white"
                onClick={toggleBSL}
                title="Enable BSL Input"
              >
                <Hand className="w-5 h-5" />
              </Button>
            )}
            
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
    </div>
  );
};

export default VideoPanel;