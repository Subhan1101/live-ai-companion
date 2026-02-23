import { useState, useCallback, useRef, useEffect } from "react";
import { AudioRecorder, encodeAudioForAPI, AudioQueue } from "@/lib/audioUtils";
import { PCM16Resampler } from "@/lib/pcmResampler";
import { toast } from "@/hooks/use-toast";
import { extractWhiteboardContent, removeWhiteboardMarkers } from "@/lib/whiteboardParser";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string; // Stores raw content with whiteboard markers for detection
  timestamp: Date;
}

interface ImageContent {
  type: "image";
  base64: string;
  mimeType: string;
}

interface TextContent {
  type: "text";
  text: string;
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
  setSimliAudioHandler: (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => void;
  sendImage: (base64: string, mimeType: string, prompt?: string) => void;
  sendTextContent: (text: string, fileName?: string) => void;
  sendBSLModeChange: (enabled: boolean) => void;
  sendGreeting: () => void;
  whiteboardContent: string;
  showWhiteboard: boolean;
  openWhiteboard: (content: string) => void;
  closeWhiteboard: () => void;
}

const WEBSOCKET_URL = "wss://jvfvwysvhqpiosvhzhkf.functions.supabase.co/functions/v1/realtime-chat";

// Auto-reconnect constants
const SESSION_WARNING_TIME = 85000; // 1 min 25s - warn user
const PROACTIVE_RECONNECT_TIME = 110000; // 1 min 50s - reconnect before backend timeout (~120s)
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second base delay for exponential backoff

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
  const heartbeatIntervalRef = useRef<number | null>(null);
  const sessionCreatedRef = useRef(false);
  const isListeningRef = useRef(false);
  // Placeholder message IDs created on speech end, waiting to be associated with an OpenAI user item
  const pendingUserMessageIdsRef = useRef<string[]>([]);
  // Map OpenAI user item_id -> local message.id so we can update the correct bubble later
  const userItemToMessageIdRef = useRef<Map<string, string>>(new Map());
  
  // Simli audio handlers
  const simliSendAudioRef = useRef<((data: Uint8Array) => void) | null>(null);
  const simliClearBufferRef = useRef<(() => void) | null>(null);
  
  // PCM16 resampler for Simli (24kHz -> 16kHz)
  const resamplerRef = useRef<PCM16Resampler>(new PCM16Resampler(24000, 16000));

  // Refs to avoid stale closures in connectInternal/performReconnect
  const teacherVoiceRef = useRef(teacherVoice);
  const teacherInstructionsRef = useRef(teacherInstructions);
  const elevenLabsVoiceIdRef = useRef(elevenLabsVoiceId);

  // Whiteboard repair: sometimes the model emits placeholder tokens like "$1" instead of real formulas.
  const pendingWhiteboardRepairRef = useRef(false);

  // Auto-reconnect state
  const manualDisconnectRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const connectionStartTimeRef = useRef<number | null>(null);
  const proactiveReconnectTimeoutRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);

  // Keep refs in sync with props
  useEffect(() => { teacherVoiceRef.current = teacherVoice; }, [teacherVoice]);
  useEffect(() => { teacherInstructionsRef.current = teacherInstructions; }, [teacherInstructions]);
  useEffect(() => { elevenLabsVoiceIdRef.current = elevenLabsVoiceId; }, [elevenLabsVoiceId]);

  const countPlaceholderTokens = useCallback((text: string) => {
    // Match standalone "$<digit>" but avoid currency like $10 or $1.50
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

      const itemId = crypto.randomUUID();
      wsRef.current.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            id: itemId,
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "The following WHITEBOARD response is malformed because it contains placeholder tokens like $1 instead of real formulas/expressions. " +
                  "Rewrite it properly.\n\n" +
                  "Rules:\n" +
                  "- Output ONLY a corrected [WHITEBOARD_START] ... [WHITEBOARD_END] block (include both markers).\n" +
                  "- Do NOT use $1/$2 placeholders. Always write the actual formulas (e.g., D = b^2 - 4ac, quadratic formula, etc.).\n" +
                  "- Do NOT nest dollar signs. Inside $$...$$ blocks, include only raw LaTeX with no extra $ signs.\n" +
                  "- Put the equation in the Problem section as display math (use $$...$$), not in the Title.\n\n" +
                  "MALFORMED WHITEBOARD:\n" +
                  rawWhiteboardBlock,
              },
            ],
          },
        })
      );
      wsRef.current.send(JSON.stringify({ type: "response.create" }));
    },
    []
  );

  // If we requested a repair, auto-open the next valid whiteboard response (only for repairs).
  useEffect(() => {
    if (!pendingWhiteboardRepairRef.current) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const source = lastAssistant?.originalContent || lastAssistant?.content;
    if (!source) return;

    const extracted = extractWhiteboardContent(source);
    if (!extracted.hasWhiteboard) return;

    // Only open when placeholders are gone
    if (!needsWhiteboardRepair(extracted.content)) {
      pendingWhiteboardRepairRef.current = false;
      setWhiteboardContent(extracted.content);
      setShowWhiteboard(true);
    }
  }, [messages, needsWhiteboardRepair]);

  // Set Simli audio handler from AvatarPanel
  const setSimliAudioHandler = useCallback(
    (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => {
      console.log("Simli audio handler set");
      simliSendAudioRef.current = sendAudio;
      simliClearBufferRef.current = clearBuffer;
    },
    []
  );

  // Stream text to ElevenLabs TTS and pipe audio to Simli for lip-sync
  const streamElevenLabsTTS = useCallback(async (text: string, voiceId: string) => {
    if (!text || text.trim().length === 0) return;

    console.log("Streaming ElevenLabs TTS:", { voiceId, textLength: text.length });
    setIsSpeaking(true);
    setStatus("speaking");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/elevenlabs-tts-stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ text, voiceId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs TTS error:", response.status, errorText);
        toast({
          title: "Voice synthesis failed",
          description: `ElevenLabs error: ${response.status}`,
          variant: "destructive",
        });
        setIsSpeaking(false);
        setStatus("idle");
        return;
      }

      if (!response.body) {
        console.error("No response body from ElevenLabs TTS");
        setIsSpeaking(false);
        setStatus("idle");
        return;
      }

      const reader = response.body.getReader();
      
      // Reset resampler for clean start
      resamplerRef.current.reset();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value && value.length > 0) {
          // Send to Simli for lip-sync (resample 24kHz PCM16 -> 16kHz)
          if (simliSendAudioRef.current) {
            const resampled = resamplerRef.current.process(value);
            simliSendAudioRef.current(resampled);
          }
          
          // Fallback: use AudioQueue if Simli is not available
          if (!simliSendAudioRef.current && audioQueueRef.current) {
            audioQueueRef.current.addToQueue(value);
          }
        }
      }

      console.log("ElevenLabs TTS stream complete");
    } catch (error) {
      console.error("ElevenLabs TTS streaming error:", error);
      toast({
        title: "Voice synthesis error",
        description: "Failed to stream audio from ElevenLabs.",
        variant: "destructive",
      });
    } finally {
      setIsSpeaking(false);
      setStatus("idle");
    }
  }, []);

  // Clear proactive reconnect timers
  const clearReconnectTimers = useCallback(() => {
    if (proactiveReconnectTimeoutRef.current) {
      clearTimeout(proactiveReconnectTimeoutRef.current);
      proactiveReconnectTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  // Refs to break circular stale closure chain between scheduleProactiveReconnect <-> performReconnect <-> connectInternal <-> startAutoListening
  const connectInternalRef = useRef<(() => Promise<void>) | null>(null);
  const performReconnectRef = useRef<(() => Promise<void>) | null>(null);
  const startAutoListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Schedule proactive reconnection to prevent timeout
  const scheduleProactiveReconnect = useCallback(() => {
    connectionStartTimeRef.current = Date.now();
    
    // Clear any existing timers
    clearReconnectTimers();
    
    // Warning at 85s - also set reconnecting flag early to guard against race condition
    warningTimeoutRef.current = window.setTimeout(() => {
      console.log("Session warning: will refresh in 25 seconds, setting isReconnecting flag");
      isReconnectingRef.current = true;
      setIsReconnecting(true);
      toast({
        title: "Session refreshing soon",
        description: "Connection will seamlessly refresh in 25 seconds.",
      });
    }, SESSION_WARNING_TIME);
    
    // Proactive reconnect at 110s
    proactiveReconnectTimeoutRef.current = window.setTimeout(() => {
      console.log("Proactive reconnection triggered");
      performReconnectRef.current?.();
    }, PROACTIVE_RECONNECT_TIME);
    
    console.log("Proactive reconnect scheduled for", PROACTIVE_RECONNECT_TIME / 1000, "seconds");
  }, [clearReconnectTimers]);

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

    // Stop recording during reconnect
    const wasListening = isListeningRef.current;
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    isListeningRef.current = false;

    // Clear timers
    clearReconnectTimers();
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    // Close existing connection gracefully
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent onclose from triggering another reconnect
      wsRef.current.close();
      wsRef.current = null;
    }

    // Brief delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reconnect using ref to get latest connectInternal
    try {
      await connectInternalRef.current?.();
      setIsReconnecting(false);
      isReconnectingRef.current = false;
      reconnectAttemptsRef.current = 0;
      
      // Restart mic if it was active before reconnect - use ref for latest version
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
      
      // Exponential backoff for retry
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
      console.log("Retrying in", delay, "ms");
      
      setTimeout(() => performReconnectRef.current?.(), delay);
    }
  }, [clearReconnectTimers]);

  // Core connection logic (extracted for reuse)
  const connectInternal = useCallback(async () => {
    console.log("Connecting to realtime chat...");

    try {
      // Initialize audio context for fallback playback
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      audioQueueRef.current = new AudioQueue(audioContextRef.current);

      // Connect WebSocket
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
          ws.close();
        }, 10000);

        ws.onopen = () => {
          console.log("WebSocket connected (backend proxy)");
          // NOTE: don't mark connected until OpenAI confirms via proxy.openai_connected
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Log all message types for debugging
            if (data.type !== "response.audio.delta") {
              console.log("Received:", data.type, data);
            }

            switch (data.type) {
              case "proxy.openai_connected":
                console.log("Proxy connected to OpenAI Realtime");
                clearTimeout(timeout);
                setIsConnected(true);
                resolve();
                break;

              case "proxy.error": {
                console.error("Proxy error:", data);

                const title = "Voice connection failed";
                const description =
                  typeof data.reason === "string" && data.reason.length > 0
                    ? data.reason
                    : typeof data.message === "string" && data.message.length > 0
                      ? data.message
                      : "Backend proxy error";

                toast({
                  title,
                  description,
                  variant: "destructive",
                });

                setIsConnected(false);
                setIsProcessing(false);
                setIsSpeaking(false);
                setStatus("idle");
                break;
              }

              case "proxy.openai_closed": {
                console.error("OpenAI connection closed (via proxy):", data);

                // Don't tear down state if we're doing a proactive reconnect OR one is scheduled
                const reconnectPending = isReconnectingRef.current || proactiveReconnectTimeoutRef.current !== null;
                if (!reconnectPending) {
                  const isKeepaliveTimeout = data.code === 1005 || data.code === 1011;
                  
                  const description =
                    isKeepaliveTimeout
                      ? "Reconnecting automatically..."
                      : typeof data.reason === "string" && data.reason.length > 0
                        ? `Code ${data.code}: ${data.reason}`
                        : typeof data.code === "number"
                          ? `Code ${data.code}`
                          : "Connection closed";

                  if (!manualDisconnectRef.current) {
                    toast({
                      title: isKeepaliveTimeout ? "Session refreshing..." : "Voice connection closed",
                      description,
                    });
                  }

                  setIsConnected(false);
                  setIsProcessing(false);
                  setIsSpeaking(false);
                  setStatus("idle");
                  
                  // Auto-reconnect if not a manual disconnect
                  if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    performReconnectRef.current?.();
                  }
                } else {
                  console.log("Ignoring proxy.openai_closed during proactive reconnect");
                }
                break;
              }

              case "session.created":
                console.log("Session created, sending configuration with Whisper-1 STT + OpenAI TTS...");
                sessionCreatedRef.current = true;
                // Text+audio mode: OpenAI generates both text and speech using built-in voices
                ws.send(
                  JSON.stringify({
                    type: "session.update",
                    session: {
                      modalities: ["text", "audio"],
                      voice: teacherVoiceRef.current || "shimmer",
                      output_audio_format: "pcm16",
                      instructions: teacherInstructionsRef.current || "You are EduGuide, a helpful AI teacher. Answer educational questions clearly and concisely.",
                      input_audio_format: "pcm16",
                      input_audio_transcription: {
                        model: "whisper-1",
                      },
                      turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 800,
                        create_response: true,
                      },
                      temperature: 0.8,
                      max_response_output_tokens: "inf",
                    },
                  })
                );
                break;

              case "session.updated":
                console.log("Session configured with Whisper-1 STT - ready for voice input");
                // NOTE: Microphone is NOT auto-started due to browser security policies
                // User must click the microphone button to grant permission (requires user gesture)
                console.log("Ready for voice input - user must click microphone button to enable");
                
                // Schedule proactive reconnection to prevent timeout
                scheduleProactiveReconnect();
                
                // Auto-greeting is now triggered by sendGreeting() when avatar is ready
                // This prevents the greeting from playing before the avatar has loaded
                
                // Start heartbeat to keep connection alive (every 15 seconds)
                // More frequent heartbeats help prevent session timeouts around 3 minutes
                if (heartbeatIntervalRef.current) {
                  clearInterval(heartbeatIntervalRef.current);
                }
                heartbeatIntervalRef.current = window.setInterval(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    // Send a minimal valid PCM16 audio buffer to keep connection alive
                    // PCM16 requires 2 bytes per sample - "AAAA" = 3 bytes still invalid
                    // Using 480 samples of silence (20ms at 24kHz) = 960 bytes
                    // This is the minimum recommended by OpenAI for audio chunks
                    const silenceBuffer = new Uint8Array(960); // 480 samples * 2 bytes = 20ms of silence
                    const base64Silence = btoa(String.fromCharCode(...silenceBuffer));
                    wsRef.current.send(JSON.stringify({
                      type: "input_audio_buffer.append",
                      audio: base64Silence
                    }));
                    console.log("Heartbeat sent to keep connection alive");
                  }
                }, 15000); // Every 15 seconds
                break;

              case "input_audio_buffer.speech_started":
                console.log("Speech started");
                setStatus("listening");
                setPartialTranscript("");
                // Clear Simli buffer when user starts speaking (interruption)
                if (simliClearBufferRef.current) {
                  simliClearBufferRef.current();
                }
                // Reset resampler state on interruption
                resamplerRef.current.reset();
                break;

              case "input_audio_buffer.speech_stopped":
                console.log("Speech stopped - server VAD detected end of speech");
                setStatus("processing");
                setIsProcessing(true);
                
                // Create placeholder user message immediately to ensure correct order
                const pendingId = crypto.randomUUID();
                // Push to queue (FIFO) - will be popped when transcription completes
                pendingUserMessageIdsRef.current.push(pendingId);
                console.log("Added pending message ID to queue:", pendingId, "Queue length:", pendingUserMessageIdsRef.current.length);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: pendingId,
                    role: "user",
                    content: "...", // Placeholder until transcription completes
                    timestamp: new Date(),
                  },
                ]);
                setPartialTranscript("");
                break;

              case "input_audio_buffer.committed":
                console.log("Audio buffer committed - waiting for transcription");
                break;

              case "conversation.item.created": {
                const item = data.item;
                console.log("Conversation item created:", item?.type, item?.role);

                // When OpenAI creates the USER message item, associate it with the oldest placeholder
                if (item?.role === "user" && typeof item?.id === "string") {
                  const pendingMsgId = pendingUserMessageIdsRef.current.shift();
                  console.log(
                    "Associating user item to placeholder:",
                    item.id,
                    "->",
                    pendingMsgId,
                    "Remaining placeholders:",
                    pendingUserMessageIdsRef.current.length
                  );

                  if (pendingMsgId) {
                    userItemToMessageIdRef.current.set(item.id, pendingMsgId);

                    // Some Realtime payloads include transcript on the item itself
                    const maybeTranscript =
                      item?.content?.find?.((c: any) => typeof c?.transcript === "string")?.transcript ??
                      item?.content?.find?.((c: any) => typeof c?.text === "string")?.text;

                      if (typeof maybeTranscript === "string" && maybeTranscript.trim().length > 0) {
                        setMessages((prev) =>
                          prev.map((m) => (m.id === pendingMsgId ? { ...m, content: maybeTranscript } : m))
                        );
                        userItemToMessageIdRef.current.delete(item.id);
                      }
                    }
                  }
                  break;
                }

                case "conversation.item.updated": {
                  const item = data.item;
                  // Some Realtime variants deliver the transcript on a later item.updated event
                  if (item?.role === "user" && typeof item?.id === "string") {
                    const maybeTranscript =
                      item?.content?.find?.((c: any) => typeof c?.transcript === "string")?.transcript ??
                      item?.content?.find?.((c: any) => typeof c?.text === "string")?.text;

                    const msgId = userItemToMessageIdRef.current.get(item.id);

                    if (msgId && typeof maybeTranscript === "string" && maybeTranscript.trim().length > 0) {
                      console.log("User item updated with transcript; updating message", item.id, "->", msgId);
                      setMessages((prev) =>
                        prev.map((m) => (m.id === msgId ? { ...m, content: maybeTranscript } : m))
                      );
                      userItemToMessageIdRef.current.delete(item.id);
                    }
                  }
                  break;
                }

                case "conversation.item.input_audio_transcription.delta":
                // Live partial transcription while the user is speaking (Whisper-1 STT)
                console.log("Live STT delta:", data.delta);
                if (typeof data.delta === "string") {
                  setPartialTranscript((prev) => prev + data.delta);
                }
                break;

              case "conversation.item.input_audio_transcription.completed": {
                console.log("Whisper-1 STT complete:", data.transcript, "item_id:", data.item_id);
                if (typeof data.transcript === "string" && data.transcript.trim().length > 0) {
                  const itemId = typeof data.item_id === "string" ? data.item_id : null;
                  const mappedMsgId = itemId ? userItemToMessageIdRef.current.get(itemId) : undefined;

                  // Fallback to FIFO placeholder if we don't have an item_id mapping
                  const msgIdToUpdate = mappedMsgId ?? pendingUserMessageIdsRef.current.shift();

                  console.log(
                    "Updating user message:",
                    { itemId, mappedMsgId, msgIdToUpdate },
                    "Remaining placeholders:",
                    pendingUserMessageIdsRef.current.length
                  );

                  if (msgIdToUpdate) {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === msgIdToUpdate ? { ...m, content: data.transcript } : m))
                    );

                    if (itemId) userItemToMessageIdRef.current.delete(itemId);
                  } else {
                    // Last-resort fallback
                    const userMessage: Message = {
                      id: crypto.randomUUID(),
                      role: "user",
                      content: data.transcript,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, userMessage]);
                  }

                  setPartialTranscript("");
                }
                break;
              }

              case "conversation.item.input_audio_transcription.failed":
                console.error("STT transcription failed:", data.error);
                setPartialTranscript("");
                break;

              case "response.created":
                console.log("AI response started - TTS will follow");
                setIsProcessing(true);
                setStatus("processing");
                break;

              case "response.output_item.added":
                console.log("Response output item added:", data.item?.type);
                break;

              case "response.audio.delta": {
                // OpenAI TTS audio - decode base64 PCM16, resample 24kHz→16kHz, send to Simli
                if (data.delta) {
                  setIsSpeaking(true);
                  setStatus("speaking");
                  try {
                    const binaryString = atob(data.delta);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    // Send to Simli for lip-sync (resample 24kHz → 16kHz)
                    if (simliSendAudioRef.current) {
                      const resampled = resamplerRef.current.process(bytes);
                      simliSendAudioRef.current(resampled);
                    }
                    
                    // Fallback: use AudioQueue if Simli is not available
                    if (!simliSendAudioRef.current && audioQueueRef.current) {
                      audioQueueRef.current.addToQueue(bytes);
                    }
                  } catch (e) {
                    console.error("Error processing audio delta:", e);
                  }
                }
                break;
              }

              case "response.text.delta":
                // Live text streaming from OpenAI (text-only mode)
                if (data.delta) {
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    
                    if (last?.role === "assistant") {
                      return prev.map((m, i) =>
                        i === prev.length - 1 ? { ...m, content: m.content + data.delta } : m
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: data.delta,
                        timestamp: new Date(),
                      },
                    ];
                  });
                }
                break;

              case "response.text.done": {
                console.log("Text response complete (audio handled by OpenAI TTS)");
                setIsProcessing(false);
                
                // Get the full text from the response for whiteboard detection
                const fullText = data.text;
                if (fullText && fullText.trim().length > 0) {
                  // Clean up whiteboard markers in the chat message
                  const { hasWhiteboard, content: wbContent } = extractWhiteboardContent(fullText);
                  console.log("[Whiteboard] Detection:", { hasWhiteboard, contentLength: fullText.length });
                  const cleanedContent = removeWhiteboardMarkers(fullText);
                  
                  setMessages((prev) => {
                    const lastAssistant = [...prev].reverse().find((m) => m.role === "assistant");
                    if (lastAssistant) {
                      return prev.map((m) =>
                        m.id === lastAssistant.id 
                          ? { 
                              ...m, 
                              originalContent: fullText,
                              content: cleanedContent || (hasWhiteboard ? "I've prepared a detailed explanation. Click 'Whiteboard' to view." : fullText)
                            } 
                          : m
                      );
                    }
                    return prev;
                  });
                }
                break;
              }

              case "response.audio_transcript.delta":
                // Primary transcript path: OpenAI sends text alongside audio
                if (data.delta) {
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "assistant") {
                      return prev.map((m, i) =>
                        i === prev.length - 1 ? { ...m, content: m.content + data.delta } : m
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: data.delta,
                        timestamp: new Date(),
                      },
                    ];
                  });
                }
                break;

              case "response.audio_transcript.done":
                console.log("Audio transcript complete");
                break;

              case "response.audio.done":
                console.log("Audio stream complete");
                break;

              case "response.output_item.done":
                console.log("Response output item complete");
                break;

              case "response.done":
                console.log("Full response complete");
                setIsSpeaking(false);
                setIsProcessing(false);
                setStatus("idle");
                break;

              case "rate_limits.updated":
                console.log("Rate limits:", data.rate_limits);
                break;

              case "error":
                console.error("OpenAI Realtime API Error:", data.error);
                setIsProcessing(false);
                setIsSpeaking(false);
                setStatus("idle");
                break;

              default:
                console.log("Unhandled event type:", data.type);
            }
          } catch (e) {
            console.error("Error parsing message:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log("WebSocket closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
          clearTimeout(timeout);
          sessionCreatedRef.current = false;
          isListeningRef.current = false;
          setIsRecording(false);
          
          // Don't set isConnected=false during proactive reconnects to keep avatar alive
          if (!isReconnectingRef.current) {
            setIsConnected(false);
            setStatus("idle");
            
            // Auto-reconnect if not a manual disconnect
            if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
              console.log("WebSocket closed unexpectedly, reconnecting in", delay, "ms");
              setTimeout(() => performReconnectRef.current?.(), delay);
            }
          } else {
            console.log("WebSocket closed during proactive reconnect - keeping avatar alive");
          }
        };
      });
    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  }, [scheduleProactiveReconnect]);

  // Public connect function
  const connect = useCallback(async () => {
    manualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    await connectInternal();
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    isListeningRef.current = false;

    // Clear pending state
    pendingUserMessageIdsRef.current = [];
    userItemToMessageIdRef.current.clear();
    
    // Clear reconnect timers
    clearReconnectTimers();
    
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
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
    sessionCreatedRef.current = false;
    reconnectAttemptsRef.current = 0;
    setIsConnected(false);
    setIsReconnecting(false);
    setIsRecording(false);
    setStatus("idle");
  }, [clearReconnectTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manualDisconnectRef.current = true;
      disconnect();
    };
  }, [disconnect]);

  // Auto-listen function that starts after session is configured
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
        wsRef.current.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          })
        );
      }
    });

    recorderRef.current = recorder;

    try {
      await recorder.start();
      console.log("Auto-listen mode active - speak anytime!");

      // Update audio level periodically
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

  // Keep refs in sync so reconnect logic always uses latest versions
  useEffect(() => { connectInternalRef.current = connectInternal; }, [connectInternal]);
  useEffect(() => { performReconnectRef.current = performReconnect; }, [performReconnect]);
  useEffect(() => { startAutoListeningRef.current = startAutoListening; }, [startAutoListening]);

  const startRecording = useCallback(async () => {
    // With auto-listen mode, this is already handled
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

  // Send image to AI for analysis (screen share or uploaded image)
  const sendImage = useCallback((base64: string, mimeType: string, prompt?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("Cannot send image: WebSocket not open");
      return;
    }

    console.log("Sending image to AI for analysis...", { mimeType, sizeKB: Math.round((base64.length * 3) / 4 / 1024) });

    // Create a conversation item with image content
    const itemId = crypto.randomUUID();
    wsRef.current.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          id: itemId,
          type: "message",
          role: "user",
          content: [
            {
              type: "input_image",
              image: base64,
            },
            {
              type: "input_text",
              text: prompt || "Please analyze this image and describe what you see. If it's a problem or question, help me solve it.",
            },
          ],
        },
      })
    );

    // Trigger response
    wsRef.current.send(
      JSON.stringify({
        type: "response.create",
      })
    );

    // Add user message to display
    setMessages((prev) => [
      ...prev,
      {
        id: itemId,
        role: "user",
        content: prompt || "[Shared image for analysis]",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Send text content (from uploaded file)
  const sendTextContent = useCallback((text: string, fileName?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("Cannot send text: WebSocket not open");
      return;
    }

    console.log("Sending text content to AI...", { fileName, length: text.length });

    const prompt = fileName
      ? `I've uploaded a file called "${fileName}". Here's its content:\n\n${text}\n\nPlease analyze this content and help me with any questions I have about it.`
      : text;

    // Create a conversation item with text
    const itemId = crypto.randomUUID();
    wsRef.current.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          id: itemId,
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      })
    );

    // Trigger response
    wsRef.current.send(
      JSON.stringify({
        type: "response.create",
      })
    );

    // Add user message to display
    setMessages((prev) => [
      ...prev,
      {
        id: itemId,
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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("Cannot send BSL mode change: WebSocket not open");
      return;
    }

    console.log("Notifying AI of BSL mode change:", enabled);

    const itemId = crypto.randomUUID();
    const message = enabled
      ? `[SYSTEM NOTE: BSL (British Sign Language) mode has been ENABLED. The student is deaf or hard-of-hearing and communicates using sign language. 

IMPORTANT INSTRUCTIONS FOR BSL MODE:
1. Keep your responses SHORT and SIMPLE - no more than 2-3 sentences at a time
2. Use clear, concrete vocabulary that translates well to sign language
3. Avoid idioms, metaphors, and complex sentence structures
4. Break down concepts into small, visual steps
5. When explaining topics, describe them in ways that can be shown with hand gestures
6. The BSL panel will convert your words to sign animations - shorter responses work better
7. Ask "Do you understand?" frequently and wait for student response
8. Focus on one concept at a time

Your text will be displayed alongside BSL hand sign animations. Please adapt your teaching style accordingly.]`
      : `[SYSTEM NOTE: BSL mode has been DISABLED. The student is now using voice communication. You can return to normal conversational teaching style with longer explanations if needed.]`;

    wsRef.current.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          id: itemId,
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      })
    );

    // Note: We don't trigger a response here - just inform the AI
    // The AI will use this context for future responses
  }, []);

  const hasGreetedRef = useRef(false);

  const sendGreeting = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (hasGreetedRef.current) return;
    if (isReconnectingRef.current) return;
    hasGreetedRef.current = true;

    console.log("Sending auto-greeting prompt to teacher (avatar ready)");
    const greetingItemId = crypto.randomUUID();
    wsRef.current.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        id: greetingItemId,
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: "You just connected with a student. Give a brief, warm greeting introducing yourself by name and asking how you can help today. Keep it to 2-3 sentences. Do NOT use whiteboard markers."
        }]
      }
    }));
    wsRef.current.send(JSON.stringify({ type: "response.create" }));
  }, []);

  // Reset greeting flag on fresh connections (not reconnects)
  const originalConnect = connect;
  const connectWithGreetingReset = useCallback(async () => {
    if (!isReconnectingRef.current) {
      hasGreetedRef.current = false;
    }
    return originalConnect();
  }, [originalConnect]);

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
