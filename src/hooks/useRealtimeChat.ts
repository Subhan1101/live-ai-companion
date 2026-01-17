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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    console.log("Connecting to realtime chat...");

    try {
      // Initialize audio context
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
              console.log("Session updated successfully");
              break;

            case "input_audio_buffer.speech_started":
              console.log("Speech started");
              setStatus("listening");
              setPartialTranscript("");
              break;

            case "input_audio_buffer.speech_stopped":
              console.log("Speech stopped");
              setStatus("processing");
              setIsProcessing(true);
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
              // Convert base64 to Uint8Array and queue for playback
              if (data.delta && audioQueueRef.current) {
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                audioQueueRef.current.addToQueue(bytes);
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

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        sessionCreatedRef.current = false;
      };
    } catch (error) {
      console.error("Connection error:", error);
    }
  }, []);

  const disconnect = useCallback(() => {
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

  const startRecording = useCallback(async () => {
    if (!wsRef.current || !isConnected) {
      console.log("Not connected, cannot start recording");
      return;
    }

    console.log("Starting recording...");
    setIsRecording(true);
    setStatus("listening");

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

      // Update audio level periodically
      audioLevelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setAudioLevel(recorderRef.current.getAudioLevel());
        }
      }, 100);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
      setStatus("idle");
    }
  }, [isConnected]);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");

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

    // Commit the audio buffer
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "input_audio_buffer.commit",
        })
      );
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
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
};