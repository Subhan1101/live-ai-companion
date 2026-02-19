import { useState, useEffect, useCallback, useRef } from 'react';
import { detectSign, HandLandmark } from '@/lib/bslGestures';

interface BSLRecognitionResult {
  sign: string;
  confidence: number;
  timestamp: number;
}

interface UseBSLRecognitionOptions {
  confidenceThreshold?: number;
  detectionInterval?: number; // ms between detections
  signHoldTime?: number; // ms a sign must be held to be recognized
}

export const useBSLRecognition = (
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseBSLRecognitionOptions = {}
) => {
  const {
    confidenceThreshold = 0.65,
    detectionInterval = 100, // 10 FPS
    signHoldTime = 500 // Hold sign for 500ms to confirm
  } = options;

  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedSign, setDetectedSign] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');

  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const lastSignRef = useRef<BSLRecognitionResult | null>(null);
  const signBufferRef = useRef<string[]>([]);
  const lastDetectionRef = useRef<number>(0);
  const isEnabledRef = useRef(false); // Track enabled state for frame loop

  // CDN sources for MediaPipe Hands script
  const cdnScripts = useRef([
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js',
    'https://unpkg.com/@mediapipe/hands@0.4.1675469240/hands.js',
  ]);

  // Load a script tag and return a promise
  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      // If script tag exists AND global is available, we're good
      if (existingScript && (window as any).Hands) {
        resolve();
        return;
      }
      // Remove stale script tag that didn't produce the global
      if (existingScript) {
        console.log('[BSL] Removing stale script tag:', src);
        existingScript.remove();
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        // Verify global was actually created (some browsers delay assignment)
        const checkGlobal = (attempts = 0) => {
          if ((window as any).Hands) {
            resolve();
          } else if (attempts < 10) {
            setTimeout(() => checkGlobal(attempts + 1), 100);
          } else {
            reject(new Error('Hands constructor not available after script load'));
          }
        };
        checkGlobal();
      };
      script.onerror = () => reject(new Error(`Script load error: ${src}`));
      document.head.appendChild(script);
    });
  }, []);

  // Load MediaPipe Hands via script tag (not import)
  const loadMediaPipe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try each CDN until one works
      let loaded = false;
      let cdnBase = '';
      for (const src of cdnScripts.current) {
        try {
          console.log(`[BSL] Loading script: ${src}`);
          await loadScript(src);
          cdnBase = src.replace(/hands\.js$/, '');
          loaded = true;
          console.log(`[BSL] Script loaded from: ${src}`);
          break;
        } catch (err: any) {
          console.warn(`[BSL] CDN failed: ${src}`, err?.message);
        }
      }

      if (!loaded) {
        throw new Error('All CDN sources failed to load MediaPipe script');
      }

      const Hands = (window as any).Hands;
      if (!Hands || typeof Hands !== 'function') {
        throw new Error('MediaPipe Hands constructor not found on window after script load');
      }

      console.log('[BSL] Hands constructor found on window, initializing...');

      const hands = new Hands({
        locateFile: (file: string) => {
          const url = `${cdnBase}${file}`;
          console.log(`[BSL] Loading MediaPipe file: ${url}`);
          return url;
        },
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Initialize with timeout
      if (hands.initialize) {
        await Promise.race([
          hands.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('MediaPipe init timeout after 30s')), 30000))
        ]);
      }

      hands.onResults((results: any) => {
        processHandResults(results);
      });

      handsRef.current = hands;
      console.log('[BSL] MediaPipe Hands ready!');
      setIsLoading(false);
      return hands;
    } catch (err: any) {
      console.error('[BSL] Failed to load MediaPipe Hands:', err);
      setError(`Hand tracking failed to load: ${err?.message || 'Unknown error'}. Tap Retry.`);
      setIsLoading(false);
      return null;
    }
  }, [loadScript]);

  // Process hand detection results
  const processHandResults = useCallback((results: any) => {
    const now = Date.now();
    
    // Rate limit processing
    if (now - lastDetectionRef.current < detectionInterval) {
      return;
    }
    lastDetectionRef.current = now;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setDetectedSign(null);
      setConfidence(0);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);

    // Process first detected hand
    const landmarks: HandLandmark[] = results.multiHandLandmarks[0].map((lm: any) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z
    }));

    const result = detectSign(landmarks);

    if (result && result.confidence >= confidenceThreshold) {
      setDetectedSign(result.sign);
      setConfidence(result.confidence);

      // Check if sign is held long enough
      if (lastSignRef.current?.sign === result.sign) {
        const holdDuration = now - lastSignRef.current.timestamp;
        
        if (holdDuration >= signHoldTime) {
          // Sign confirmed! Add to buffer
          if (signBufferRef.current[signBufferRef.current.length - 1] !== result.sign) {
            signBufferRef.current.push(result.sign);
            
            // Build recognized text
            const newText = signBufferRef.current.join('');
            setRecognizedText(newText);
          }
          
          // Reset for next sign
          lastSignRef.current = { ...result, timestamp: now };
        }
      } else {
        // New sign detected, start timing
        lastSignRef.current = { ...result, timestamp: now };
      }
    } else {
      setDetectedSign(null);
      setConfidence(0);
    }

    setIsProcessing(false);
  }, [confidenceThreshold, detectionInterval, signHoldTime]);

  // Start camera processing
  const startDetection = useCallback(async () => {
    if (!videoRef.current) {
      setError('Video element not found');
      return;
    }

    console.log('Starting BSL detection...');
    setIsLoading(true);

    let hands = handsRef.current;
    
    if (!hands) {
      hands = await loadMediaPipe();
      if (!hands) {
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
    const video = videoRef.current;
    
    const processFrame = async () => {
      // Use ref to check enabled state (avoids stale closure)
      if (!isEnabledRef.current) {
        return; // Stop loop when disabled
      }
      
      if (!video || video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      try {
        await hands.send({ image: video });
      } catch (err) {
        console.error('Error processing frame:', err);
      }

      animationRef.current = requestAnimationFrame(processFrame);
    };

    animationRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, loadMediaPipe]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setDetectedSign(null);
    setConfidence(0);
    setIsProcessing(false);
  }, []);

  // Toggle BSL mode
  const toggleBSL = useCallback(() => {
    setIsEnabled(prev => {
      const next = !prev;
      isEnabledRef.current = next; // Keep ref in sync
      console.log('BSL mode toggled:', next);
      if (!next) {
        stopDetection();
      }
      return next;
    });
  }, [stopDetection]);

  // Clear recognized text
  const clearRecognizedText = useCallback(() => {
    setRecognizedText('');
    signBufferRef.current = [];
  }, []);

  // Send recognized text (returns the text and clears buffer)
  const sendRecognizedText = useCallback(() => {
    const text = recognizedText;
    clearRecognizedText();
    return text;
  }, [recognizedText, clearRecognizedText]);

  // Start/stop detection when enabled changes
  useEffect(() => {
    isEnabledRef.current = isEnabled; // Keep ref in sync
    if (isEnabled) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      stopDetection();
    };
  }, [isEnabled, startDetection, stopDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      if (handsRef.current) {
        handsRef.current.close?.();
      }
    };
  }, [stopDetection]);

  // Retry loading
  const retryLoad = useCallback(() => {
    handsRef.current = null;
    setError(null);
    if (isEnabled) {
      startDetection();
    }
  }, [isEnabled, startDetection]);

  return {
    isEnabled,
    isLoading,
    isProcessing,
    detectedSign,
    confidence,
    recognizedText,
    error,
    toggleBSL,
    clearRecognizedText,
    sendRecognizedText,
    setIsEnabled,
    retryLoad,
  };
};

export default useBSLRecognition;
