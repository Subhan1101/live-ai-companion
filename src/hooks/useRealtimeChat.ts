import { useState, useCallback, useRef, useEffect } from "react";
import { AudioRecorder, encodeAudioForAPI, AudioQueue } from "@/lib/audioUtils";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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

type VoiceOption = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

interface UseRealtimeChatReturn {
  messages: Message[];
  partialTranscript: string;
  isConnected: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  status: "idle" | "listening" | "speaking" | "processing";
  currentVoice: VoiceOption;
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  setSimliAudioHandler: (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => void;
  sendImage: (base64: string, mimeType: string, prompt?: string) => void;
  sendTextContent: (text: string, fileName?: string) => void;
  changeVoice: (voice: VoiceOption) => void;
}

const WEBSOCKET_URL = "wss://jvfvwysvhqpiosvhzhkf.functions.supabase.co/functions/v1/realtime-chat";

export const useRealtimeChat = (): UseRealtimeChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<"idle" | "listening" | "speaking" | "processing">("idle");
  const [currentVoice, setCurrentVoice] = useState<VoiceOption>("nova");
  
  const currentVoiceRef = useRef<VoiceOption>("nova");

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioLevelIntervalRef = useRef<number | null>(null);
  const sessionCreatedRef = useRef(false);
  const isListeningRef = useRef(false);
  
  // Simli audio handlers
  const simliSendAudioRef = useRef<((data: Uint8Array) => void) | null>(null);
  const simliClearBufferRef = useRef<(() => void) | null>(null);

  // Set Simli audio handler from AvatarPanel
  const setSimliAudioHandler = useCallback(
    (sendAudio: (data: Uint8Array) => void, clearBuffer: () => void) => {
      console.log("Simli audio handler set");
      simliSendAudioRef.current = sendAudio;
      simliClearBufferRef.current = clearBuffer;
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    console.log("Connecting to realtime chat...");

    try {
      // Initialize audio context for fallback playback
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioQueueRef.current = new AudioQueue(audioContextRef.current);

      // Connect WebSocket
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

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
              setIsConnected(true);
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

              const description =
                typeof data.reason === "string" && data.reason.length > 0
                  ? `Code ${data.code}: ${data.reason}`
                  : typeof data.code === "number"
                    ? `Code ${data.code}`
                    : "Connection closed";

              toast({
                title: "Voice connection closed",
                description,
                variant: "destructive",
              });

              setIsConnected(false);
              setIsProcessing(false);
              setIsSpeaking(false);
              setStatus("idle");
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
                    instructions:
                      "You are Aria, a friendly, warm, and caring woman. Your name is Aria – when anyone asks your name, always say 'My name is Aria.' You speak with a gentle, feminine voice full of warmth and empathy. You help users by listening to them and providing supportive, thoughtful responses. Keep your responses conversational, natural, and expressive. You are kind, patient, and understanding. Your knowledge cutoff is 2024.",
                    voice: currentVoiceRef.current,
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
              break;

            case "input_audio_buffer.speech_started":
              console.log("Speech started");
              setStatus("listening");
              setPartialTranscript("");
              // Clear Simli buffer when user starts speaking (interruption)
              if (simliClearBufferRef.current) {
                simliClearBufferRef.current();
              }
              break;

            case "input_audio_buffer.speech_stopped":
              console.log("Speech stopped - server VAD detected end of speech");
              setStatus("processing");
              setIsProcessing(true);
              // With server_vad, OpenAI automatically commits the buffer and creates a response
              // No need to manually send response.create
              break;

            case "input_audio_buffer.committed":
              console.log("Audio buffer committed - waiting for transcription");
              break;

            case "conversation.item.created":
              console.log("Conversation item created:", data.item?.type);
              break;

            case "conversation.item.input_audio_transcription.delta":
              // Live partial transcription while the user is speaking (Whisper-1 STT)
              console.log("Live STT delta:", data.delta);
              if (typeof data.delta === "string") {
                setPartialTranscript((prev) => prev + data.delta);
              }
              break;

            case "conversation.item.input_audio_transcription.completed":
              console.log("Whisper-1 STT complete:", data.transcript);
              if (data.transcript) {
                const userMessage: Message = {
                  id: crypto.randomUUID(),
                  role: "user",
                  content: data.transcript,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setPartialTranscript("");
              }
              break;

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
              
              // Convert base64 to Uint8Array
              if (data.delta) {
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Send to Simli for lip-sync (primary)
                if (simliSendAudioRef.current) {
                  simliSendAudioRef.current(bytes);
                }
                
                // Use fallback audio queue if Simli is not available
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
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setIsConnected(false);
        sessionCreatedRef.current = false;
        isListeningRef.current = false;
        setIsRecording(false);
        setStatus("idle");
      };
    } catch (error) {
      console.error("Connection error:", error);
    }
  }, []);

  const disconnect = useCallback(() => {
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
    sessionCreatedRef.current = false;
    setIsConnected(false);
    setIsRecording(false);
    setStatus("idle");
  }, []);

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

  // Change voice dynamically by updating the session
  const changeVoice = useCallback((voice: VoiceOption) => {
    console.log("Changing voice to:", voice);
    currentVoiceRef.current = voice;
    setCurrentVoice(voice);
    
    // If connected, send a session update to change the voice
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionCreatedRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: voice,
          },
        })
      );
      console.log("Session update sent for voice change");
    }
  }, []);

  return {
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
  };
};