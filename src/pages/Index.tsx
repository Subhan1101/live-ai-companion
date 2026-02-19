import { useState, useEffect, useCallback, useRef } from "react";
import AvatarPanel from "@/components/AvatarPanel";
import VideoPanel from "@/components/VideoPanel";
import TranscriptPanel from "@/components/TranscriptPanel";
import ControlBar from "@/components/ControlBar";
import FileUpload from "@/components/FileUpload";
import WhiteboardModal from "@/components/WhiteboardModal";
import TeacherSelect from "@/components/TeacherSelect";
import { type BSLSettingsState } from "@/components/BSLSettings";
import { type Teacher } from "@/lib/teachers";

import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useScreenShare } from "@/hooks/useScreenShare";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const {
    messages,
    partialTranscript,
    isConnected,
    isReconnecting,
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
    sendImage,
    sendTextContent,
    sendBSLModeChange,
    whiteboardContent,
    showWhiteboard,
    openWhiteboard,
    closeWhiteboard,
  } = useRealtimeChat(selectedTeacher?.openaiVoice, selectedTeacher?.systemPrompt);

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
  const [isBSLEnabled, setIsBSLEnabled] = useState(false);
  const [isBSLLoading, setIsBSLLoading] = useState(false);
  const [bslResponseText, setBslResponseText] = useState('');
  const [bslSettings, setBslSettings] = useState<BSLSettingsState>({
    speed: 1,
    position: 'bottom-left',
    isCompact: false,
    autoPlay: true,
  });
  const screenCaptureIntervalRef = useRef<number | null>(null);
  const bslTogglePendingRef = useRef(false);
  const lastBSLAssistantMessageIdRef = useRef<string | null>(null);
  const lastBSLContentLengthRef = useRef<number>(0);

  // Only close when the dialog requests to close.
  // (Radix may call onOpenChange(true) in controlled mode in some cases;
  // we must not immediately close on open.)
  const handleWhiteboardOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeWhiteboard();
    },
    [closeWhiteboard]
  );

  // Auto-connect after teacher is selected
  useEffect(() => {
    if (!selectedTeacher) return;
    connect();
    return () => disconnect();
  }, [selectedTeacher]);

  // Prompt user to click microphone after connection is established
  useEffect(() => {
    if (isConnected && !isRecording) {
      toast({
        title: "Connected!",
        description: `Click the microphone button to start talking to ${selectedTeacher?.name || 'your teacher'}.`,
      });
    }
  }, [isConnected]);

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
        description: "Connecting to your teacher.",
      });
    }
  };

  const handleGoBack = () => {
    if (isConnected) disconnect();
    setRecordingTime(0);
    setSelectedTeacher(null);
  };

  const handleToggleBSL = useCallback(() => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please wait for the connection to be established.",
        variant: "destructive",
      });
      return;
    }

    // Avoid side-effects inside setState updater (prevents React warnings).
    bslTogglePendingRef.current = true;
    setIsBSLLoading(true);
    setIsBSLEnabled((prev) => !prev);
  }, [isConnected]);

  // Perform BSL toggle side-effects after state update
  useEffect(() => {
    if (!bslTogglePendingRef.current) return;
    bslTogglePendingRef.current = false;

    sendBSLModeChange(isBSLEnabled);

    toast({
      title: isBSLEnabled ? "BSL Mode Enabled" : "BSL Mode Disabled",
      description: isBSLEnabled
        ? "The teacher will respond with short, clear sentences for better sign output."
        : "Switched back to voice-only mode.",
    });

    setIsBSLLoading(false);
  }, [isBSLEnabled, sendBSLModeChange]);

  // Auto-capture screen every 15 seconds while sharing
  useEffect(() => {
    if (!isSharing || !isConnected) return;

    // Capture immediately when sharing starts
    handleCaptureScreen();

    const interval = window.setInterval(() => {
      handleCaptureScreen();
    }, 15000);

    return () => clearInterval(interval);
  }, [isSharing, isConnected, handleCaptureScreen]);

  // Global keyboard shortcut: Ctrl+Shift+S / Cmd+Shift+S for instant capture
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isSharing) {
          handleCaptureScreen();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSharing, handleCaptureScreen]);

  // Update BSL response text continuously during streaming.
  // - When a NEW message ID appears, reset and start signing from beginning.
  // - When the same message grows (streaming), update text so BSLPanel can extend signs.
  useEffect(() => {
    if (!isBSLEnabled) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const isNewMessage = lastBSLAssistantMessageIdRef.current !== lastAssistant.id;
    
    if (isNewMessage) {
      // New message started - reset tracking and start fresh
      lastBSLAssistantMessageIdRef.current = lastAssistant.id;
      lastBSLContentLengthRef.current = lastAssistant.content.length;
      setBslResponseText(lastAssistant.content);
    } else {
      // Same message - only update if content has grown (streaming)
      const currentLength = lastAssistant.content.length;
      if (currentLength > lastBSLContentLengthRef.current) {
        lastBSLContentLengthRef.current = currentLength;
        setBslResponseText(lastAssistant.content);
      }
    }
  }, [messages, isBSLEnabled]);

  // Handle BSL input from camera (sign language to text)
  const handleBSLInput = useCallback((text: string) => {
    if (!isConnected || !text.trim()) return;
    
    sendTextContent(text, "BSL Input");
    toast({
      title: "BSL Input Sent",
      description: `Sent: "${text}"`,
    });
  }, [isConnected, sendTextContent]);

  // Handle BSL close from overlay
  const handleBSLClose = useCallback(() => {
    setIsBSLEnabled(false);
    sendBSLModeChange(false);
    toast({
      title: "BSL Mode Disabled",
      description: "Switched back to voice-only mode.",
    });
  }, [sendBSLModeChange]);

  // Handle text message from TranscriptPanel
  const handleSendText = useCallback((text: string) => {
    if (!isConnected || !text.trim()) return;
    sendTextContent(text, "Text Message");
    toast({
      title: "Message sent",
      description: `Sent: "${text}"`,
    });
  }, [isConnected, sendTextContent]);

  // Show teacher selection if no teacher chosen yet
  if (!selectedTeacher) {
    return <TeacherSelect onSelect={setSelectedTeacher} />;
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Go Back button */}
      <button
        onClick={handleGoBack}
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card text-muted-foreground hover:text-foreground text-sm font-medium shadow-md hover:shadow-lg transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Change Teacher
      </button>
      {/* Main content area */}
      <div className="flex-1 p-4 lg:p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-full max-w-[1800px] mx-auto overflow-hidden">
          {/* Avatar Panel - Left */}
          <div className="h-full min-h-0 overflow-hidden lg:col-span-4">
            <AvatarPanel
              faceId={selectedTeacher.faceId}
              teacherName={selectedTeacher.name}
              status={status}
              isRecording={isRecording}
              onMicPress={handleMicPress}
              onMicRelease={handleMicRelease}
              audioLevel={audioLevel}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              onSimliReady={handleSimliReady}
            />
          </div>

          {/* Video Panel - Center */}
          <div className="h-full min-h-0 overflow-hidden lg:col-span-4">
            <VideoPanel
              userName="Jack Jackson"
              isSpeaking={isRecording}
              isMuted={!isMicOn}
              isCameraOn={isCameraOn}
              onBSLInput={handleBSLInput}
              isBSLEnabled={isBSLEnabled}
              bslText={bslResponseText}
              bslSettings={bslSettings}
              onBSLSettingsChange={setBslSettings}
              onBSLClose={handleBSLClose}
            />
          </div>

          {/* Transcript Panel */}
          <div className="h-full min-h-0 overflow-hidden lg:col-span-4">
            <TranscriptPanel
              messages={messages}
              partialTranscript={partialTranscript}
              isProcessing={isProcessing}
              teacherName={selectedTeacher?.name}
              onUploadClick={() => setShowFileUpload(true)}
              onShowWhiteboard={openWhiteboard}
              onSendText={handleSendText}
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

      {/* Whiteboard Modal */}
      <WhiteboardModal
        open={showWhiteboard}
        onOpenChange={handleWhiteboardOpenChange}
        content={whiteboardContent}
      />

      {/* Control Bar */}
      <ControlBar
        isCameraOn={isCameraOn}
        isMicOn={isMicOn}
        isRecording={isRecording}
        isCallActive={isConnected}
        isScreenSharing={isSharing}
        isBSLEnabled={isBSLEnabled}
        isBSLLoading={isBSLLoading}
        recordingTime={recordingTime}
        onToggleCamera={handleToggleCamera}
        onToggleMic={handleToggleMic}
        onShare={handleShare}
        onCaptureScreen={handleCaptureScreen}
        onToggleCall={handleToggleCall}
        onToggleBSL={handleToggleBSL}
      />

      {/* Screen sharing indicator */}
      {isSharing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-full text-sm font-medium flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white" />
            Screen sharing active — auto-capturing every 15s (⌘/Ctrl+Shift+S for instant)
          </div>
        </div>
      )}

      {/* Connection status */}
      <div className="fixed bottom-24 left-6">
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
          isReconnecting
            ? "bg-yellow-500/20 text-yellow-600"
            : isConnected 
              ? "bg-status-speaking/20 text-status-speaking" 
              : "bg-muted text-muted-foreground"
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isReconnecting 
              ? "bg-yellow-500 animate-pulse" 
              : isConnected 
                ? "bg-status-speaking" 
                : "bg-muted-foreground"
          }`} />
          {isReconnecting ? "Reconnecting..." : isConnected ? "Connected" : "Connecting..."}
        </div>
      </div>

      {/* Microphone prompt - shown when connected but not recording */}
      {isConnected && !isRecording && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-pulse">
          <div className="px-4 py-2 bg-primary/90 text-primary-foreground rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
            Click the microphone to start talking
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;