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
  whiteboardContent: string;
  showWhiteboard: boolean;
  openWhiteboard: (content: string) => void;
  closeWhiteboard: () => void;
}

const WEBSOCKET_URL = "wss://jvfvwysvhqpiosvhzhkf.functions.supabase.co/functions/v1/realtime-chat";

// Auto-reconnect constants
const SESSION_WARNING_TIME = 120000; // 2 minutes - warn user
const PROACTIVE_RECONNECT_TIME = 140000; // 2:20 - reconnect before timeout
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second base delay for exponential backoff

export const useRealtimeChat = (): UseRealtimeChatReturn => {
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

  // Whiteboard repair: sometimes the model emits placeholder tokens like "$1" instead of real formulas.
  const pendingWhiteboardRepairRef = useRef(false);

  // Auto-reconnect state
  const manualDisconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const connectionStartTimeRef = useRef<number | null>(null);
  const proactiveReconnectTimeoutRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);

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

  // Schedule proactive reconnection to prevent timeout
  const scheduleProactiveReconnect = useCallback(() => {
    connectionStartTimeRef.current = Date.now();
    
    // Clear any existing timers
    clearReconnectTimers();
    
    // Warning at 2 minutes
    warningTimeoutRef.current = window.setTimeout(() => {
      console.log("Session warning: will refresh in 20 seconds");
      toast({
        title: "Session refreshing soon",
        description: "Connection will seamlessly refresh in 20 seconds.",
      });
    }, SESSION_WARNING_TIME);
    
    // Proactive reconnect at 2:20
    proactiveReconnectTimeoutRef.current = window.setTimeout(() => {
      console.log("Proactive reconnection triggered");
      performReconnect();
    }, PROACTIVE_RECONNECT_TIME);
    
    console.log("Proactive reconnect scheduled for", PROACTIVE_RECONNECT_TIME / 1000, "seconds");
  }, []);

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
      setIsConnected(false);
      return;
    }

    console.log("Performing reconnect, attempt:", reconnectAttemptsRef.current + 1);
    setIsReconnecting(true);
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

    // Reconnect
    try {
      await connectInternal();
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      
      toast({
        title: "Connected",
        description: "Session refreshed successfully.",
      });
    } catch (error) {
      console.error("Reconnect failed:", error);
      
      // Exponential backoff for retry
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
      console.log("Retrying in", delay, "ms");
      
      setTimeout(() => performReconnect(), delay);
    }
  }, []);

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

                // Don't show error toast if we're doing a proactive reconnect
                if (!isReconnecting) {
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
                }

                setIsConnected(false);
                setIsProcessing(false);
                setIsSpeaking(false);
                setStatus("idle");
                
                // Auto-reconnect if not a manual disconnect
                if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                  performReconnect();
                }
                break;
              }

              case "session.created":
                console.log("Session created, sending configuration with Whisper-1 STT...");
                sessionCreatedRef.current = true;
                // Send session configuration after session is created
                // Using OpenAI Realtime API with Whisper-1 for STT and selected voice for TTS
                ws.send(
                  JSON.stringify({
                    type: "session.update",
                    session: {
                      modalities: ["text", "audio"],
                      instructions: `You are EduGuide, the world's most dedicated and effective AI teacher, inspired by the greatest educators who work tirelessly to inspire lifelong learning. Your sole mission is to teach students of all ages—children, teens, adults, or seniors—exclusively on educational topics like math, science, language arts, history, languages, revision strategies, homework help, exam prep (e.g., GCSE, SAT), and core academic skills. You adapt perfectly to each student based on their language, tone, vocabulary, sentence structure, and any self-described age or context.

CORE PRINCIPLES:

1. STUDENT ADAPTATION - Detect Age/Level Instantly:
- Simple words, short sentences, misspellings, baby talk = Child (5-12): Use super simple words, fun stories, games, short bursts, lots of praise like "You're a superstar!" Repeat key points playfully.
- Casual teen slang, GCSE mentions = Teen (13-18): Be friendly, relatable, use cool examples from pop culture/anime/games, step-by-step with visual descriptions.
- Mature vocab, complex questions = Adult/Senior: Professional yet warm, deep dives, real-world applications, structured outlines.
- Always confirm/adjust: Start with "Got it! You sound like a [age/group] learner—I'll teach at your perfect level. Ready?"

2. STRICT EDUCATION-ONLY BOUNDARY:
- ONLY respond to academic/educational queries (subjects, homework, skills, revision, concepts).
- If off-topic (jokes, personal advice, non-academic topics): Politely refuse with: "I'm your dedicated education teacher, so I only cover school subjects and learning skills. For other topics, please contact our support team. What educational topic can I help with today?"
- Never engage, summarize, or pivot off-topic queries—redirect immediately.

3. TEACHING EXCELLENCE:
- Structure Every Lesson: Break topics into clear, sequential sections. Use headers, numbered steps, bullets. Progress one-by-one: Explain → Example → Practice → Review.
- Step-by-Step for Problems: Restate the problem clearly, outline steps verbally, solve slowly showing work, explain why each step matters, give 1-2 similar practice problems, ask "Try this one—what's your answer?"
- Revision/Topic Overviews (e.g., GCSE English): List all topics first, then teach one-by-one: "GCSE English has 5 key topics. Let's master them step-by-step: 1. Poetry Analysis [full explanation] → Ready for Topic 2?"
- Engagement & Motivation: Always encourage: "Amazing effort! You're getting it!" Use questions to check understanding: "Does that make sense? What part should we review?"
- Inclusivity: Be patient, positive, never criticize. Repeat/rephrase if confused. End lessons with summary + next steps.

4. FORMAT FOR CLARITY:
- Short paragraphs (2-4 sentences)
- Bold key terms
- Lists/tables for organization
- Warm, encouraging tone for all ages

CRITICAL - WHITEBOARD FOR ALL EDUCATIONAL QUESTIONS:
You MUST use the whiteboard format for ANY question that involves learning, explanation, studying, or academic help across ALL subjects. This includes:
- Math problems and equations
- English Literature (essay structure, themes, character analysis, revision tips)
- History (timelines, key events, cause and effect)
- Science (processes, experiments, concepts)
- Languages (grammar rules, vocabulary, sentence structures)
- Geography (maps, climate, processes)
- Any study tips, revision strategies, or exam preparation
- Step-by-step explanations of ANY topic

When a user asks for help with studying, revision, understanding concepts, or any educational topic, you MUST format your response using these special markers:

[WHITEBOARD_START]
## Title: <Short descriptive title>

### Overview
Briefly state what the student is trying to learn or the question being addressed.

### Key Points
List the main concepts, themes, or steps in a clear organized way:
1. **Point One**: Explanation
2. **Point Two**: Explanation
3. **Point Three**: Explanation

### Tips / Strategy
Provide practical advice, memory tricks, or study strategies.

### Summary
Wrap up with a concise takeaway or answer.
[WHITEBOARD_END]

For MATH specifically, use this structure:
[WHITEBOARD_START]
## Title: <Short descriptive title in plain text>

### Problem
State the original problem. If the user asks to "solve" and provides only an expression (e.g. x^2 - x + 9), treat it as an equation set to zero:
$$x^2 - x + 9 = 0$$

### Solution
Write numbered steps with real formulas (never placeholders):
$$D = b^2 - 4ac$$
$$x = \\frac{-b \\pm \\sqrt{D}}{2a}$$

### Answer
Give the final answer.
[WHITEBOARD_END]

LaTeX notation (for math):
- Fractions: \\frac{numerator}{denominator}
- Square roots: \\sqrt{expression}
- Powers: x^{2} or x^{n}
- Greek letters: \\alpha, \\beta, \\pi
- Subscripts: x_{1}, a_{n}

CRITICAL LATEX RULES:
1. NEVER use nested dollar signs. Write $$x^2 + 1$$, NOT $$$x^2 + 1$$$
2. NEVER use $1 or $2 as placeholders. Always write the actual expression.
3. Inside $$...$$ blocks, put ONLY raw LaTeX without any additional $ signs.
4. For inline math, use $...$ with just one $ on each side.

RESPONSE RULES:
- Greet warmly: "Hi student! I'm EduGuide, here to make learning fun and easy. What's your question?"
- Keep responses concise yet thorough (under 800 words unless deep dive).
- End with: "What else can we tackle? Or practice this?"
- No chit-chat; dive into teaching.
- If unclear: "Tell me more about the topic or your grade level so I can help perfectly!"

ONLY respond WITHOUT the whiteboard for simple greetings or casual conversation that doesn't involve teaching, explaining, or academic content.`,
                      voice: "shimmer",
                      input_audio_format: "pcm16",
                      output_audio_format: "pcm16",
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
                console.log("Session configured with Whisper-1 STT - starting auto-listen mode");
                // Automatically start listening after session is configured
                if (!isListeningRef.current) {
                  startAutoListening();
                }
                
                // Schedule proactive reconnection to prevent timeout
                scheduleProactiveReconnect();
                
                // Start heartbeat to keep connection alive (every 15 seconds)
                // More frequent heartbeats help prevent session timeouts around 3 minutes
                if (heartbeatIntervalRef.current) {
                  clearInterval(heartbeatIntervalRef.current);
                }
                heartbeatIntervalRef.current = window.setInterval(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    // Send a minimal audio buffer to keep connection alive
                    // This is a lightweight ping that OpenAI accepts
                    wsRef.current.send(JSON.stringify({
                      type: "input_audio_buffer.append",
                      // Send a tiny chunk of silence (1 sample) to avoid some servers closing on empty payloads.
                      audio: "AA=="
                    }));
                    console.log("Heartbeat sent to keep connection alive");
                  }
                }, 15000); // Every 15 seconds (reduced from 25s)
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

              case "response.audio.delta":
                // TTS audio from OpenAI Realtime API (shimmer voice)
                setIsSpeaking(true);
                setStatus("speaking");
                setIsProcessing(false);
                
                // Convert base64 to Uint8Array (24kHz PCM16)
                if (data.delta) {
                  const binaryString = atob(data.delta);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  
                  // Send to Simli for lip-sync (primary) - resample 24kHz -> 16kHz
                  if (simliSendAudioRef.current) {
                    const resampled = resamplerRef.current.process(bytes);
                    simliSendAudioRef.current(resampled);
                  }
                  
                  // Use fallback audio queue if Simli is not available (keep at 24kHz)
                  if (!simliSendAudioRef.current && audioQueueRef.current) {
                    audioQueueRef.current.addToQueue(bytes);
                  }
                }
                break;

              case "response.audio_transcript.delta":
                // Live TTS transcript from OpenAI
                if (data.delta) {
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    const newContent = last?.role === "assistant" 
                      ? last.content + data.delta 
                      : data.delta;
                    
                    // Note: Whiteboard content is now shown on-demand via button click
                    // No auto-popup - user controls when to view whiteboard
                    
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
                console.log("TTS transcript complete");
                // Clean up the chat message by removing whiteboard markers (but keep original for detection)
                setMessages((prev) => {
                  const lastAssistant = [...prev].reverse().find((m) => m.role === "assistant");
                  if (lastAssistant) {
                    const { hasWhiteboard } = extractWhiteboardContent(lastAssistant.content);
                    // Clean up the chat message by removing whiteboard markers
                    const cleanedContent = removeWhiteboardMarkers(lastAssistant.content);
                    if (cleanedContent !== lastAssistant.content) {
                      return prev.map((m) =>
                        m.id === lastAssistant.id 
                          ? { 
                              ...m, 
                              originalContent: lastAssistant.content, // Keep original for whiteboard button detection
                              content: cleanedContent || (hasWhiteboard ? "I've prepared a detailed explanation. Click 'Whiteboard' to view." : lastAssistant.content)
                            } 
                          : m
                      );
                    }
                  }
                  return prev;
                });
                break;

              case "response.audio.done":
                console.log("TTS audio stream complete");
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
          setIsConnected(false);
          sessionCreatedRef.current = false;
          isListeningRef.current = false;
          setIsRecording(false);
          setStatus("idle");
          
          // Auto-reconnect if not a manual disconnect
          if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), 8000);
            console.log("WebSocket closed unexpectedly, reconnecting in", delay, "ms");
            setTimeout(() => performReconnect(), delay);
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
  };
};
