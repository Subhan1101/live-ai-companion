import { useState, useEffect, useCallback } from "react";
import AvatarPanel from "@/components/AvatarPanel";
import VideoPanel from "@/components/VideoPanel";
import TranscriptPanel from "@/components/TranscriptPanel";
import ControlBar from "@/components/ControlBar";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
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
    connect,
    disconnect,
    startRecording,
    stopRecording,
    setSimliAudioHandler,
  } = useRealtimeChat();

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);

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

  const handleShare = () => {
    toast({
      title: "Screen sharing",
      description: "Screen sharing is not available in this demo.",
    });
  };

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-full max-w-[1800px] mx-auto">
          {/* Avatar Panel - Left */}
          <div className="lg:col-span-4 min-h-[400px] lg:min-h-[600px]">
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
          <div className="lg:col-span-4 min-h-[400px] lg:min-h-[600px]">
            <VideoPanel
              userName="Jack Jackson"
              isSpeaking={isRecording}
              isMuted={!isMicOn}
              isCameraOn={isCameraOn}
            />
          </div>

          {/* Transcript Panel - Right */}
          <div className="lg:col-span-4 min-h-[400px] lg:min-h-[600px]">
            <TranscriptPanel
              messages={messages}
              partialTranscript={partialTranscript}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <ControlBar
        isCameraOn={isCameraOn}
        isMicOn={isMicOn}
        isRecording={isRecording}
        isCallActive={isConnected}
        recordingTime={recordingTime}
        onToggleCamera={handleToggleCamera}
        onToggleMic={handleToggleMic}
        onShare={handleShare}
        onToggleCall={handleToggleCall}
      />

      {/* Connection status indicator */}
      <div className="fixed bottom-24 left-6">
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
          isConnected 
            ? "bg-status-speaking/20 text-status-speaking" 
            : "bg-muted text-muted-foreground"
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-status-speaking" : "bg-muted-foreground"}`} />
          {isConnected ? "Connected" : "Connecting..."}
        </div>
      </div>
    </div>
  );
};

export default Index;