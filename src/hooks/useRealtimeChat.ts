import { useState, useCallback, useRef, useEffect } from "react";
import { AudioRecorder, encodeAudioForAPI, AudioQueue } from "@/lib/audioUtils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseRealtimeChatReturn {
  messages: Message[];
  partialTranscript: string;
  isConnected: boolean;
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
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received message:", data.type);

          switch (data.type) {
            case "session.created":
              console.log("Session created, sending configuration...");
              sessionCreatedRef.current = true;
              // Send session configuration after session is created
              ws.send(
                JSON.stringify({
                  type: "session.update",
                  session: {
                    modalities: ["text", "audio"],
                    instructions:
                      "You are Aria, a friendly and empathetic AI assistant. You help users by listening to them and providing supportive, thoughtful responses. Keep your responses conversational and natural. Your knowledge cutoff is 2024.",
                    voice: "alloy",
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
                    },
                    temperature: 0.8,
                    max_response_output_tokens: "inf",
                  },
                })
              );
              break;

            case "session.updated":
              console.log("Session updated successfully - starting auto-listen mode");
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
              console.log("Speech stopped");
              setStatus("processing");
              setIsProcessing(true);
              // Trigger the assistant response after server VAD detects end-of-turn
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "response.create" }));
              }
              break;

            case "conversation.item.input_audio_transcription.delta":
              // Live partial transcription while the user is speaking
              if (typeof data.delta === "string") {
                setPartialTranscript((prev) => prev + data.delta);
              }
              break;

            case "conversation.item.input_audio_transcription.completed":
              console.log("User transcript:", data.transcript);
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

            case "response.created":
              console.log("Response started");
              setIsProcessing(true);
              setStatus("processing");
              break;

            case "response.audio.delta":
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
                
                // Also queue for audio playback (Simli handles its own audio)
                // Only use fallback if Simli is not available
                if (!simliSendAudioRef.current && audioQueueRef.current) {
                  audioQueueRef.current.addToQueue(bytes);
                }
              }
              break;

            case "response.audio_transcript.delta":
              // Accumulate assistant transcript
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

            case "response.audio.done":
              console.log("Audio response complete");
              break;

            case "response.done":
              console.log("Response complete");
              setIsSpeaking(false);
              setIsProcessing(false);
              setStatus("idle");
              break;

            case "error":
              console.error("API Error:", data.error);
              setIsProcessing(false);
              setIsSpeaking(false);
              setStatus("idle");
              break;
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

  return {
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
  };
};