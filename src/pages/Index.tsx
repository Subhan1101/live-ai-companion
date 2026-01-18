import { useState, useEffect, useCallback, useRef } from "react";
import AvatarPanel from "@/components/AvatarPanel";
import VideoPanel from "@/components/VideoPanel";
import TranscriptPanel from "@/components/TranscriptPanel";
import ControlBar from "@/components/ControlBar";
import FileUpload from "@/components/FileUpload";
import VoiceSelector from "@/components/VoiceSelector";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useScreenShare } from "@/hooks/useScreenShare";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const {
    messages,
    partialTranscript,
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    audioLevel,
    status,
    currentVoice,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    setSimliAudioHandler,
    sendImage,
    sendTextContent,
    changeVoice,
  } = useRealtimeChat();

  const {
    isSharing,
    startScreenShare,
    stopScreenShare,
    captureScreenshot,
  } = useScreenShare();

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const screenCaptureIntervalRef = useRef<number | null>(null);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Recording timer
  useEffect(() => {
    let interval: number | null = null;
    if (isConnected) {
      interval = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const handleSimliReady = useCallback(
    (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => {
      setSimliAudioHandler(sendAudio, clearBuffer);
      toast({
        title: "Avatar Ready",
        description: "Simli avatar is now active and ready for conversation.",
      });
    },
    [setSimliAudioHandler]
  );

  const handleMicPress = useCallback(() => {
    // Auto-listen mode is now always active after connection
    // This button no longer needed for push-to-talk
  }, []);

  const handleMicRelease = useCallback(() => {
    // Auto-listen mode handles this automatically
  }, []);

  const handleToggleCamera = () => {
    setIsCameraOn((prev) => !prev);
  };

  const handleToggleMic = () => {
    // If the UI says mic is ON but we're not actually recording (common when the browser
    // blocked the initial mic permission because it wasn't triggered by a click),
    // treat this click as "try to enable mic".
    if (isMicOn && !isRecording) {
      if (!isConnected) {
        toast({
          title: "Not connected",
          description: "Please wait for the connection to be established.",
          variant: "destructive",
        });
        return;
      }

      startRecording();
      toast({ title: "Microphone on", description: "Listening enabled." });
      return;
    }

    setIsMicOn((prev) => {
      const next = !prev;

      if (!isConnected) {
        toast({
          title: "Not connected",
          description: "Please wait for the connection to be established.",
          variant: "destructive",
        });
        return prev;
      }

      if (next) {
        startRecording();
        toast({ title: "Microphone on", description: "Listening enabled." });
      } else {
        stopRecording();
        toast({ title: "Microphone off", description: "Listening paused." });
      }

      return next;
    });
  };

  const handleShare = async () => {
    if (isSharing) {
      // Stop sharing
      if (screenCaptureIntervalRef.current) {
        clearInterval(screenCaptureIntervalRef.current);
        screenCaptureIntervalRef.current = null;
      }
      stopScreenShare();
      toast({
        title: "Screen sharing stopped",
        description: "Aria can no longer see your screen.",
      });
    } else {
      try {
        await startScreenShare();
        toast({
          title: "Screen sharing started",
          description: "Aria can now see your screen. Just ask about what's on screen!",
        });
        
        // Note: Screenshots are sent on-demand when user asks about screen
        // Not continuously, to avoid overwhelming the API
      } catch (error) {
        toast({
          title: "Screen sharing failed",
          description: "Could not start screen sharing. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Function to capture and send screen to AI
  const handleCaptureScreen = useCallback(async () => {
    if (!isSharing) {
      toast({
        title: "No screen shared",
        description: "Start screen sharing first to let Aria see your screen.",
        variant: "destructive",
      });
      return;
    }

    const screenshot = await captureScreenshot();
    if (screenshot) {
      sendImage(screenshot, "image/jpeg", "Look at my screen and help me with what you see. If there's a problem or question visible, help me solve it.");
      toast({
        title: "Screen captured",
        description: "Aria is analyzing your screen...",
      });
    }
  }, [isSharing, captureScreenshot, sendImage]);

  // Handle file upload
  const handleFileProcessed = useCallback((file: { name: string; type: string; content?: string; base64?: string }) => {
    if (file.type.startsWith("image/") && file.base64) {
      sendImage(file.base64, file.type, `I've uploaded an image called "${file.name}". Please analyze it and help me with any questions.`);
      toast({
        title: "Image uploaded",
        description: `Aria is analyzing ${file.name}...`,
      });
    } else if (file.content) {
      sendTextContent(file.content, file.name);
      toast({
        title: "File uploaded",
        description: `Aria is reading ${file.name}...`,
      });
    } else if (file.base64) {
      // PDF - tell user it's uploaded but we can describe what kind of help they need
      sendTextContent(`[PDF file uploaded: ${file.name}] Please ask me about what you need help with from this document.`, file.name);
      toast({
        title: "PDF uploaded",
        description: "Ask Aria about the contents of your PDF.",
      });
    }
    setShowFileUpload(false);
  }, [sendImage, sendTextContent]);

  const handleToggleCall = () => {
    if (isConnected) {
      disconnect();
      setRecordingTime(0);
      toast({
        title: "Call ended",
        description: "You have ended the conversation.",
      });
    } else {
      connect();
      toast({
        title: "Calling...",
        description: "Connecting to Aria.",
      });
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 p-4 lg:p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-full max-w-[1800px] mx-auto overflow-hidden">
          {/* Avatar Panel - Left */}
          <div className="lg:col-span-4 h-full min-h-0 overflow-hidden">
            <AvatarPanel
              status={status}
              isRecording={isRecording}
              onMicPress={handleMicPress}
              onMicRelease={handleMicRelease}
              audioLevel={audioLevel}
              onSimliReady={handleSimliReady}
            />
          </div>

          {/* Video Panel - Center */}
          <div className="lg:col-span-4 h-full min-h-0 overflow-hidden">
            <VideoPanel
              userName="Jack Jackson"
              isSpeaking={isRecording}
              isMuted={!isMicOn}
              isCameraOn={isCameraOn}
            />
          </div>

          {/* Transcript Panel - Right */}
          <div className="lg:col-span-4 h-full min-h-0 overflow-hidden">
            <TranscriptPanel
              messages={messages}
              partialTranscript={partialTranscript}
              isProcessing={isProcessing}
              onUploadClick={() => setShowFileUpload(true)}
            />
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFileUpload(false)}>
          <div className="bg-card p-6 rounded-2xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Upload a File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload images, PDFs, or text files for Aria to analyze.
            </p>
            <FileUpload onFileProcessed={handleFileProcessed} disabled={!isConnected} />
            <button
              onClick={() => setShowFileUpload(false)}
              className="mt-4 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <ControlBar
        isCameraOn={isCameraOn}
        isMicOn={isMicOn}
        isRecording={isRecording}
        isCallActive={isConnected}
        isScreenSharing={isSharing}
        recordingTime={recordingTime}
        onToggleCamera={handleToggleCamera}
        onToggleMic={handleToggleMic}
        onShare={handleShare}
        onCaptureScreen={handleCaptureScreen}
        onToggleCall={handleToggleCall}
      />

      {/* Screen sharing indicator */}
      {isSharing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-full text-sm font-medium flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white" />
            Screen sharing active - Click "Capture" to send to Aria
          </div>
        </div>
      )}

      {/* Connection status and voice selector */}
      <div className="fixed bottom-24 left-6 flex items-center gap-4">
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
          isConnected 
            ? "bg-status-speaking/20 text-status-speaking" 
            : "bg-muted text-muted-foreground"
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-status-speaking" : "bg-muted-foreground"}`} />
          {isConnected ? "Connected" : "Connecting..."}
        </div>
        <VoiceSelector
          currentVoice={currentVoice}
          onVoiceChange={(voice) => {
            changeVoice(voice);
            toast({
              title: "Voice changed",
              description: `Aria will now speak with the ${voice} voice.`,
            });
          }}
          disabled={!isConnected}
        />
      </div>
    </div>
  );
};

export default Index;