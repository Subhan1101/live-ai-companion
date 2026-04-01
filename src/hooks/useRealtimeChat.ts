import { useState, useCallback, useRef, useEffect } from "react";
import { AudioRecorder, encodeAudioForAPI, AudioQueue } from "@/lib/audioUtils";
import { toast } from "@/hooks/use-toast";
import { extractWhiteboardContent, removeWhiteboardMarkers } from "@/lib/whiteboardParser";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string;
  rawTranscription?: string;
  timestamp: Date;
}

interface UseRealtimeChatReturn {
  messages: Message[];
  partialTranscript: string;
  isConnected: boolean;
  isReconnecting: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  status: "idle" | "listening" | "speaking" | "processing";
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  setSimliAudioHandler: (listenToTrack: (track: MediaStreamTrack) => void, clearBuffer: () => void) => void;
  sendImage: (base64: string, mimeType: string, prompt?: string) => void;
  sendTextContent: (text: string, fileName?: string) => void;
  sendBSLModeChange: (enabled: boolean) => void;
  sendGreeting: () => void;
  whiteboardContent: string;
  showWhiteboard: boolean;
  openWhiteboard: (content: string) => void;
  closeWhiteboard: () => void;
}

const WEBSOCKET_URL = "wss://xjdgrrlmwulqvamupvpc.functions.supabase.co/functions/v1/realtime-chat";

const GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// Reconnect constants
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

// Helper to reliably strip internal thoughts and system blocks from being displayed to the user
const cleanDisplayContent = (text: string) => {
  if (!text) return "";

  // Simply return the transcribed text, stripping out whiteboard metadata blocks
  // to prevent raw LaTeX/markdown leaking into the chat bubble
  return removeWhiteboardMarkers(text);
};

export const useRealtimeChat = (teacherVoice?: string, teacherInstructions?: string, elevenLabsVoiceId?: string): UseRealtimeChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<"idle" | "listening" | "speaking" | "processing">("idle");
  const [whiteboardContent, setWhiteboardContent] = useState("");
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioLevelIntervalRef = useRef<number | null>(null);
  const sessionReadyRef = useRef(false);
  const isListeningRef = useRef(false);

  // Simli audio handlers
  const simliListenToTrackRef = useRef<((track: MediaStreamTrack) => void) | null>(null);
  const simliClearBufferRef = useRef<(() => void) | null>(null);

  // Refs to avoid stale closures
  const teacherVoiceRef = useRef(teacherVoice);
  const teacherInstructionsRef = useRef(teacherInstructions);
  const elevenLabsVoiceIdRef = useRef(elevenLabsVoiceId);

  // Whiteboard repair
  const pendingWhiteboardRepairRef = useRef(false);

  // Auto-reconnect state
  const manualDisconnectRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Track current assistant message being streamed
  const currentAssistantIdRef = useRef<string | null>(null);
  const currentAssistantTextRef = useRef("");

  const lastActivityRef = useRef<number>(Date.now());
  const monitoringTimerRef = useRef<number | null>(null);

  // Keep refs in sync with props
  useEffect(() => { teacherVoiceRef.current = teacherVoice; }, [teacherVoice]);
  useEffect(() => { teacherInstructionsRef.current = teacherInstructions; }, [teacherInstructions]);
  useEffect(() => { elevenLabsVoiceIdRef.current = elevenLabsVoiceId; }, [elevenLabsVoiceId]);

  const countPlaceholderTokens = useCallback((text: string) => {
    const re = /(^|[\s:])\$([1-9])(?![0-9.])(?=[\s.,;:!?)]|$)/g;
    return (text.match(re) ?? []).length;
  }, []);

  const needsWhiteboardRepair = useCallback(
    (text: string) => countPlaceholderTokens(text) >= 2,
    [countPlaceholderTokens]
  );

  const requestWhiteboardRepair = useCallback(
    (rawWhiteboardBlock: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      pendingWhiteboardRepairRef.current = true;
      setShowWhiteboard(false);
      setWhiteboardContent("");

      toast({
        title: "Fixing formatting…",
        description: "Regenerating the whiteboard without placeholder tokens.",
      });

      // Send repair request via Gemini clientContent
      wsRef.current.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{
              text:
                "The following WHITEBOARD response is malformed because it contains placeholder tokens like $1 instead of real formulas/expressions. " +
                "Rewrite it properly.\n\n" +
                "Rules:\n" +
                "- Output ONLY a corrected [WHITEBOARD_START] ... [WHITEBOARD_END] block (include both markers).\n" +
                "- Do NOT use $1/$2 placeholders. Always write the actual formulas.\n" +
                "- Do NOT nest dollar signs. Inside $$...$$ blocks, include only raw LaTeX with no extra $ signs.\n" +
                "- Put the equation in the Problem section as display math (use $$...$$), not in the Title.\n\n" +
                "MALFORMED WHITEBOARD:\n" +
                rawWhiteboardBlock,
            }],
          }],
          turnComplete: true,
        },
      }));
    },
    []
  );

  // If we requested a repair, auto-open the next valid whiteboard response
  useEffect(() => {
    if (!pendingWhiteboardRepairRef.current) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const source = lastAssistant?.originalContent || lastAssistant?.content;
    if (!source) return;

    const extracted = extractWhiteboardContent(source);
    if (!extracted.hasWhiteboard) return;

    if (!needsWhiteboardRepair(extracted.content)) {
      pendingWhiteboardRepairRef.current = false;
      setWhiteboardContent(extracted.content);
      setShowWhiteboard(true);
    }
  }, [messages, needsWhiteboardRepair]);

  // Set Simli audio handler from AvatarPanel
  const setSimliAudioHandler = useCallback(
    (listenToTrack: (track: MediaStreamTrack) => void, clearBuffer: () => void) => {
      console.log("Simli audio handler set");
      simliListenToTrackRef.current = listenToTrack;
      simliClearBufferRef.current = clearBuffer;
      
      // If we are already connected and have the track ready, supply it immediately
      if (audioQueueRef.current && audioQueueRef.current.destination.stream.getAudioTracks().length > 0) {
        listenToTrack(audioQueueRef.current.destination.stream.getAudioTracks()[0]);
      }
    },
    []
  );

  // Refs to break circular stale closure chain
  const connectInternalRef = useRef<(() => Promise<void>) | null>(null);
  const performReconnectRef = useRef<(() => Promise<void>) | null>(null);
  const startAutoListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Internal reconnect function
  const performReconnect = useCallback(async () => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log("Max reconnect attempts reached");
      toast({
        title: "Connection Lost",
        description: "Unable to maintain connection. Please click 'Call' to reconnect.",
        variant: "destructive",
      });
      setIsReconnecting(false);
      isReconnectingRef.current = false;
      setIsConnected(false);
      return;
    }

    console.log("Performing reconnect, attempt:", reconnectAttemptsRef.current + 1);
    setIsReconnecting(true);
    isReconnectingRef.current = true;
    reconnectAttemptsRef.current++;

    const wasListening = isListeningRef.current;
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    isListeningRef.current = false;

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      await connectInternalRef.current?.();
      setIsReconnecting(false);
      isReconnectingRef.current = false;
      reconnectAttemptsRef.current = 0;

      if (wasListening) {
        console.log("Restarting microphone after reconnect...");
        startAutoListeningRef.current?.();
      }

      toast({
        title: "Connected",
        description: "Session refreshed successfully.",
      });
    } catch (error) {
      console.error("Reconnect failed:", error);
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
      console.log("Retrying in", delay, "ms");
      setTimeout(() => performReconnectRef.current?.(), delay);
    }
  }, []);

  const processWhiteboardFromText = useCallback((fullText: string) => {
    const { hasWhiteboard, content: wbContent } = extractWhiteboardContent(fullText);
    console.log("[Whiteboard] Detection:", { hasWhiteboard, contentLength: fullText.length });

    setMessages((prev) => {
      const lastAssistant = [...prev].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        return prev.map((m) =>
          m.id === lastAssistant.id
            ? {
                ...m,
                originalContent: fullText,
                content: hasWhiteboard && !m.content.trim()
                  ? "I've prepared a detailed explanation. Click 'Whiteboard' to view."
                  : m.content,
              }
            : m
        );
      }
      return prev;
    });
  }, []);

  // Core connection logic
  const connectInternal = useCallback(async () => {
    console.log("Connecting to Gemini Live via proxy...");

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      // Preserve the same AudioQueue across reconnects to maintain the unbroken 
      // MediaStream track that powers the Simli avatar's lip-sync video feed.
      if (!audioQueueRef.current) {
        audioQueueRef.current = new AudioQueue(audioContextRef.current);
      } else {
        audioQueueRef.current.clear(); // Clear old residual audio
      }

      // Give Simli the real-time audio track early if it's already listening
      if (simliListenToTrackRef.current && audioQueueRef.current.destination.stream.getAudioTracks().length > 0) {
        simliListenToTrackRef.current(audioQueueRef.current.destination.stream.getAudioTracks()[0]);
      }

      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
          ws.close();
        }, 15000);

        ws.onopen = () => {
          console.log("WebSocket connected to proxy");
        };

        ws.onmessage = async (event) => {
          try {
            let textData = event.data;
            if (event.data instanceof Blob) {
              textData = await event.data.text();
            }
            const data = JSON.parse(textData);

            // Handle proxy-level events
            if (data.type === "proxy.gemini_connected") {
              console.log("Proxy connected to Gemini Live API");
              clearTimeout(timeout);

              // Send setup message to Gemini
              const setupMessage = {
                setup: {
                  model: `models/${GEMINI_MODEL}`,
                  generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: teacherVoiceRef.current || "Kore",
                        },
                      },
                    },
                  },
                  // Enable transcription so we can display chat text alongside audio
                  outputAudioTranscription: {},
                  inputAudioTranscription: {},
                  systemInstruction: {
                    parts: [{
                      text: (teacherInstructionsRef.current || "You are EduGuide, a helpful AI teacher.") + 
                        "\n\nINTERACTIVITY RULES:\n" +
                        "1. You are in a LIVE voice session. Be proactive.\n" +
                        "2. If the student is silent, check in on them. Ask if they are stuck or if they need you to explain something in a different way.\n" +
                        "3. Use short, conversational phrases. Avoid long monologues unless asked.\n" +
                        "4. Always conclude your turns with a brief, encouraging question to keep the conversation moving.",
                    }],
                  },
                },
              };

              ws.send(JSON.stringify(setupMessage));
              console.log("Sent Gemini setup message with voice:", teacherVoiceRef.current);
              return;
            }

            if (data.type === "proxy.error") {
              console.error("Proxy error:", data);
              toast({
                title: "Voice connection failed",
                description: data.message || "Backend proxy error",
                variant: "destructive",
              });
              setIsConnected(false);
              setIsProcessing(false);
              setIsSpeaking(false);
              setStatus("idle");
              return;
            }

            if (data.type === "proxy.gemini_closed") {
              console.error("Gemini connection closed (via proxy):", data);

              if (!isReconnectingRef.current) {
                if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                  setIsReconnecting(true);
                  isReconnectingRef.current = true;
                  setIsConnected(false);
                  setIsProcessing(false);
                  setIsSpeaking(false);
                  setStatus("idle");
                  performReconnectRef.current?.();
                } else {
                  if (!manualDisconnectRef.current) {
                    toast({
                      title: "Voice connection closed",
                      description: data.reason || `Code ${data.code}`,
                    });
                  }
                  setIsConnected(false);
                  setIsProcessing(false);
                  setIsSpeaking(false);
                  setStatus("idle");
                }
              }
              return;
            }

            // Handle Gemini Live API events
            // setupComplete - session is ready
            if (data.setupComplete !== undefined) {
              console.log("Gemini session setup complete");
              sessionReadyRef.current = true;
              setIsConnected(true);
              resolve();
              return;
            }

            // goAway - Gemini is about to disconnect, reconnect proactively
            if (data.goAway !== undefined) {
              console.log("Gemini goAway received, timeLeft:", data.goAway?.timeLeft);
              toast({
                title: "Session refreshing soon",
                description: "Connection will seamlessly refresh.",
              });
              isReconnectingRef.current = true;
              setIsReconnecting(true);
              // Reconnect proactively
              setTimeout(() => performReconnectRef.current?.(), 2000);
              return;
            }

            // interrupted - user interrupted the model
            if (data.interrupted !== undefined) {
              console.log("Model output interrupted by user");
              setIsSpeaking(false);
              setIsProcessing(false);
              setStatus("idle");
              // Finalize current assistant message
              if (currentAssistantIdRef.current && currentAssistantTextRef.current) {
                processWhiteboardFromText(currentAssistantTextRef.current);
              }
              currentAssistantIdRef.current = null;
              currentAssistantTextRef.current = "";
              return;
            }

            // turnComplete - model finished its turn
            if (data.turnComplete !== undefined) {
              console.log("Gemini turn complete");
              setIsSpeaking(false);
              setIsProcessing(false);
              setStatus("idle");
              // Process whiteboard from accumulated text
              if (currentAssistantIdRef.current && currentAssistantTextRef.current) {
                processWhiteboardFromText(currentAssistantTextRef.current);
              }
              currentAssistantIdRef.current = null;
              currentAssistantTextRef.current = "";
              return;
            }

            // serverContent - model output (audio, text, transcription)
            if (data.serverContent) {
              // Reset silence timer on any server activity
              lastActivityRef.current = Date.now();
              const sc = data.serverContent;

              // Input transcription (what the user said)
              if (sc.inputTranscription) {
                const transcript = sc.inputTranscription.text;
                if (transcript && transcript.trim()) {
                  console.log("User transcription:", transcript);
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    // Append ongoing speech to the last user bubble
                    if (last && last.role === "user") {
                      return prev.map((m, i) =>
                        i === prev.length - 1 
                          ? { ...m, content: (m.content === "..." || !m.content) ? transcript : m.content + " " + transcript } 
                          : m
                      );
                    }
                    // Otherwise create a new user message
                    return [...prev, {
                      id: crypto.randomUUID(),
                      role: "user" as const,
                      content: transcript,
                      timestamp: new Date(),
                    }];
                  });
                  setPartialTranscript("");
                }
              }

              // Output transcription (what the model said - audio transcript)
              const outputTranscriptChunk = sc.outputTranscription?.text ?? sc.output_audio_transcription?.text;
              if (outputTranscriptChunk) {
                console.log("Model output transcript:", outputTranscriptChunk);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && currentAssistantIdRef.current === last.id) {
                     const currentTranscript = last.rawTranscription || "";
                     const newTranscript = currentTranscript + outputTranscriptChunk;
                     return prev.map((m, i) =>
                       i === prev.length - 1 ? { ...m, content: newTranscript, rawTranscription: newTranscript } : m
                     );
                  }
                  
                  const newId = crypto.randomUUID();
                  currentAssistantIdRef.current = newId;
                  return [...prev, {
                     id: newId,
                     role: "assistant",
                     content: outputTranscriptChunk,
                     rawTranscription: outputTranscriptChunk,
                     originalContent: "",
                     timestamp: new Date()
                  }];
                });
              }

              // Model turn - contains audio and/or text parts
              if (sc.modelTurn) {
                const parts = sc.modelTurn.parts || [];

                for (const part of parts) {
                  // Audio data
                  if (part.inlineData) {
                    const audioBase64 = part.inlineData.data;
                    if (audioBase64) {
                      setIsSpeaking(true);
                      setStatus("speaking");
                      try {
                        const binaryString = atob(audioBase64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                        }

                        // ALWAYS play audio locally ensuring voice playback even if Simli WebRTC drops
                        if (audioQueueRef.current) {
                          audioQueueRef.current.addToQueue(bytes);
                        }
                      } catch (e) {
                        console.error("Error processing Gemini audio:", e);
                      }
                    }
                  }

                  // Text part (non-audio text response or simultaneous text stream)
                  if (part.text) {
                    setMessages((prev) => {
                      const last = prev[prev.length - 1];
                      if (last?.role === "assistant" && currentAssistantIdRef.current === last.id) {
                        const rawContent = last.originalContent || "";
                        const newOriginalContent = rawContent + part.text;
                        currentAssistantTextRef.current = newOriginalContent;

                        return prev.map((m, i) =>
                          i === prev.length - 1 ? { 
                            ...m, 
                            originalContent: newOriginalContent,
                            // If we don't have a transcript yet, show thinking indicator so CoT doesn't bleed through
                            content: m.rawTranscription ? m.rawTranscription : "🔊 Speaking..."
                          } : m
                        );
                      }
                      
                      // For a text chunk that starts a new assistant turn
                      const newId = crypto.randomUUID();
                      currentAssistantIdRef.current = newId;
                      currentAssistantTextRef.current = part.text;
                      return [...prev, {
                        id: newId,
                        role: "assistant" as const,
                        content: "🔊 Speaking...",
                        originalContent: part.text,
                        rawTranscription: "",
                        timestamp: new Date(),
                      }];
                    });
                  }
                }
              }
            }

            // Log unhandled
            // console.log("Unhandled Gemini event:", JSON.stringify(data).substring(0, 200));

          } catch (e) {
            console.error("Error parsing Gemini message:", e);
            toast({
              title: "Gemini Parsing Error",
              description: e instanceof Error ? e.message : "Unknown error",
              variant: "destructive"
            });
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log("WebSocket closed", { code: event.code, reason: event.reason });
          clearTimeout(timeout);
          sessionReadyRef.current = false;
          isListeningRef.current = false;
          setIsRecording(false);

          if (!isReconnectingRef.current) {
            if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              isReconnectingRef.current = true;
              setIsReconnecting(true);
              setIsConnected(false);
              setStatus("idle");
              const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
              console.log("WebSocket closed unexpectedly, reconnecting in", delay, "ms");
              setTimeout(() => performReconnectRef.current?.(), delay);
            } else {
              setIsConnected(false);
              setStatus("idle");
            }
          }
        };
      });
    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  }, [processWhiteboardFromText]);

  // Keep refs in sync
  useEffect(() => { connectInternalRef.current = connectInternal; }, [connectInternal]);
  useEffect(() => { performReconnectRef.current = performReconnect; }, [performReconnect]);

  // Public connect function
  const connect = useCallback(async () => {
    manualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    await connectInternal();
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    isListeningRef.current = false;

    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioQueueRef.current = null;
    sessionReadyRef.current = false;
    reconnectAttemptsRef.current = 0;
    currentAssistantIdRef.current = null;
    currentAssistantTextRef.current = "";
    setIsConnected(false);
    setIsReconnecting(false);
    setIsRecording(false);
    setStatus("idle");
  }, []);

  // Silence Monitoring Effect
  useEffect(() => {
    if (!isConnected || isReconnecting) {
      if (monitoringTimerRef.current) {
        window.clearInterval(monitoringTimerRef.current);
        monitoringTimerRef.current = null;
      }
      return;
    }

    console.log("[Silence Monitor] Started");
    monitoringTimerRef.current = window.setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      
      // If user is silent for 45s, send a hidden nudge
      if (idleTime > 45000 && wsRef.current?.readyState === WebSocket.OPEN) {
        console.log("[Silence Monitor] User silent for 45s, nudging AI...");
        lastActivityRef.current = Date.now(); // Reset to prevent spamming
        
        wsRef.current.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: "user",
              parts: [{ text: "[SYSTEM: The student has been silent for a while. Please check in with them proactively, ask if they have questions about what you just said, or if they'd like to move to the next topic.]" }],
            }],
            turnComplete: true,
          },
        }));
      }
    }, 5000);

    return () => {
      if (monitoringTimerRef.current) {
        window.clearInterval(monitoringTimerRef.current);
      }
    };
  }, [isConnected, isReconnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manualDisconnectRef.current = true;
      disconnect();
    };
  }, [disconnect]);

  // Auto-listen function
  const startAutoListening = useCallback(async () => {
    if (isListeningRef.current) {
      console.log("Already listening");
      return;
    }

    console.log("Starting auto-listen mode...");
    isListeningRef.current = true;
    setIsRecording(true);
    setStatus("idle");

    const recorder = new AudioRecorder((audioData) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const base64Audio = encodeAudioForAPI(audioData);
        // Send audio in Gemini realtimeInput format
        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=16000",
              data: base64Audio,
            }],
          },
        }));
      }
    });

    recorderRef.current = recorder;

    try {
      await recorder.start();
      console.log("Auto-listen mode active - speak anytime!");

      audioLevelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setAudioLevel(recorderRef.current.getAudioLevel());
        }
      }, 100);
    } catch (error) {
      console.error("Failed to start auto-listening:", error);
      isListeningRef.current = false;
      setIsRecording(false);
      setStatus("idle");
    }
  }, []);

  useEffect(() => { startAutoListeningRef.current = startAutoListening; }, [startAutoListening]);

  const startRecording = useCallback(async () => {
    if (isListeningRef.current) {
      console.log("Already in auto-listen mode");
      return;
    }
    if (!wsRef.current || !isConnected) {
      console.log("Not connected, cannot start recording");
      return;
    }
    await startAutoListening();
  }, [isConnected, startAutoListening]);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");
    isListeningRef.current = false;

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  // Send image to AI
  const sendImage = useCallback((base64: string, mimeType: string, prompt?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    console.log("Sending image to Gemini...", { mimeType });

    // Send via clientContent with image and text
    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64,
              },
            },
            {
              text: prompt || "Please analyze this image and describe what you see. If it's a problem or question, help me solve it.",
            },
          ],
        }],
        turnComplete: true,
      },
    }));

    const msgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: "user",
        content: prompt || "[Shared image for analysis]",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Send text content
  const sendTextContent = useCallback((text: string, fileName?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    console.log("Sending text to Gemini...", { fileName, length: text.length });

    const prompt = fileName
      ? `I've uploaded a file called "${fileName}". Here's its content:\n\n${text}\n\nPlease analyze this content and help me with any questions I have about it.`
      : text;

    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: prompt }],
        }],
        turnComplete: true,
      },
    }));

    const msgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: "user",
        content: fileName ? `[Uploaded file: ${fileName}]` : text.slice(0, 100) + "...",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const openWhiteboard = useCallback((content: string) => {
    const { content: wbContent } = extractWhiteboardContent(content);
    setWhiteboardContent(wbContent || content);
    setShowWhiteboard(true);
  }, []);

  const closeWhiteboard = useCallback(() => {
    setShowWhiteboard(false);
  }, []);

  // Notify AI when BSL mode is toggled
  const sendBSLModeChange = useCallback((enabled: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    console.log("Notifying Gemini of BSL mode change:", enabled);

    const message = enabled
      ? `[SYSTEM NOTE: BSL (British Sign Language) mode has been ENABLED. The student is deaf or hard-of-hearing and communicates using sign language. \n\nIMPORTANT INSTRUCTIONS FOR BSL MODE:\n1. Keep your responses SHORT and SIMPLE - no more than 2-3 sentences at a time\n2. Use clear, concrete vocabulary that translates well to sign language\n3. Avoid idioms, metaphors, and complex sentence structures\n4. Break down concepts into small, visual steps\n5. When explaining topics, describe them in ways that can be shown with hand gestures\n6. The BSL panel will convert your words to sign animations - shorter responses work better\n7. Ask "Do you understand?" frequently and wait for student response\n8. Focus on one concept at a time\n\nYour text will be displayed alongside BSL hand sign animations. Please adapt your teaching style accordingly.]`
      : `[SYSTEM NOTE: BSL mode has been DISABLED. The student is now using voice communication. You can return to normal conversational teaching style with longer explanations if needed.]`;

    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: message }],
        }],
        turnComplete: false, // Don't trigger a response, just context
      },
    }));
  }, []);

  const hasGreetedRef = useRef(false);

  const sendGreeting = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (hasGreetedRef.current) return;
    if (isReconnectingRef.current) return;
    hasGreetedRef.current = true;

    console.log("Sending auto-greeting prompt to teacher (avatar ready)");
    wsRef.current.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{
            text: "Hi! I just joined the call. I'm ready to start.",
          }],
        }],
        turnComplete: true,
      },
    }));
  }, []);

  // Reset greeting flag on fresh connections
  const connectWithGreetingReset = useCallback(async () => {
    if (!isReconnectingRef.current) {
      hasGreetedRef.current = false;
    }
    return connect();
  }, [connect]);

  return {
    messages,
    partialTranscript,
    isConnected,
    isReconnecting,
    isRecording,
    isProcessing,
    isSpeaking,
    audioLevel,
    status,
    connect: connectWithGreetingReset,
    disconnect,
    startRecording,
    stopRecording,
    setSimliAudioHandler,
    sendImage,
    sendTextContent,
    sendBSLModeChange,
    sendGreeting,
    whiteboardContent,
    showWhiteboard,
    openWhiteboard,
    closeWhiteboard,
  };
};
