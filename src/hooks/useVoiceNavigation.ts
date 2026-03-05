import { useState, useEffect, useRef, useCallback } from "react";

interface UseVoiceNavigationOptions {
  keywords: string[];
  enabled: boolean;
  onMatch: (keyword: string) => void;
}

interface UseVoiceNavigationReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
}

export const useVoiceNavigation = ({
  keywords,
  enabled,
  onMatch,
}: UseVoiceNavigationOptions): UseVoiceNavigationReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onMatchRef = useRef(onMatch);
  const keywordsRef = useRef(keywords);

  useEffect(() => { onMatchRef.current = onMatch; }, [onMatch]);
  useEffect(() => { keywordsRef.current = keywords; }, [keywords]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      const combined = (finalTranscript + " " + interimTranscript).toLowerCase().trim();
      setTranscript(combined);

      // Check for keyword matches
      for (const keyword of keywordsRef.current) {
        if (combined.includes(keyword.toLowerCase())) {
          onMatchRef.current(keyword);
          recognition.stop();
          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Restart if still enabled
      if (isListening) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setTranscript("");
  }, []);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && isSupported && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [enabled, isSupported]);

  return { isListening, transcript, startListening, stopListening, isSupported };
};
