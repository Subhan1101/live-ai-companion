import { useState, useRef, useCallback } from "react";

interface UseScreenShareReturn {
  isSharing: boolean;
  screenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  captureScreenshot: () => Promise<string | null>;
}

export const useScreenShare = (): UseScreenShareReturn => {
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setScreenStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    console.log("Screen sharing stopped");
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 5 }, // Lower frame rate for efficiency
        },
        audio: false,
      });

      streamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Create hidden video element for screenshot capture
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;

      console.log("Screen sharing started");
    } catch (error) {
      console.error("Failed to start screen sharing:", error);
      throw error;
    }
  }, [stopScreenShare]);

  const captureScreenshot = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !isSharing) {
      console.log("Cannot capture: no active screen share");
      return null;
    }

    const video = videoRef.current;
    
    // Wait for video to be ready
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });
    }

    const canvas = document.createElement("canvas");
    // Resize for efficiency - max 1280px width
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 JPEG (smaller than PNG)
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    
    console.log("Screenshot captured:", {
      width: canvas.width,
      height: canvas.height,
      sizeKB: Math.round((base64.length * 3) / 4 / 1024),
    });

    return base64;
  }, [isSharing]);

  return {
    isSharing,
    screenStream,
    startScreenShare,
    stopScreenShare,
    captureScreenshot,
  };
};
