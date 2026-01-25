/**
 * BSL Gesture Definitions
 * 
 * Defines landmark patterns for British Sign Language recognition.
 * Uses MediaPipe Hand landmarks (21 points per hand).
 * 
 * Landmark indices:
 * 0: Wrist
 * 1-4: Thumb (CMC, MCP, IP, TIP)
 * 5-8: Index (MCP, PIP, DIP, TIP)
 * 9-12: Middle (MCP, PIP, DIP, TIP)
 * 13-16: Ring (MCP, PIP, DIP, TIP)
 * 17-20: Pinky (MCP, PIP, DIP, TIP)
 */

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface BSLSign {
  name: string;
  description: string;
  category: 'letter' | 'number' | 'word' | 'phrase';
  detector: (landmarks: HandLandmark[]) => number; // Returns confidence 0-1
}

// Helper functions for gesture detection
export const getDistance = (a: HandLandmark, b: HandLandmark): number => {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + 
    Math.pow(a.y - b.y, 2) + 
    Math.pow(a.z - b.z, 2)
  );
};

export const isFingerExtended = (
  landmarks: HandLandmark[], 
  fingerBase: number, 
  fingerTip: number
): boolean => {
  const base = landmarks[fingerBase];
  const tip = landmarks[fingerTip];
  const wrist = landmarks[0];
  
  // Finger is extended if tip is further from wrist than base
  const tipToWrist = getDistance(tip, wrist);
  const baseToWrist = getDistance(base, wrist);
  
  return tipToWrist > baseToWrist * 1.2;
};

export const isFingerCurled = (
  landmarks: HandLandmark[],
  fingerMcp: number,
  fingerTip: number
): boolean => {
  const mcp = landmarks[fingerMcp];
  const tip = landmarks[fingerTip];
  
  // Finger is curled if tip is close to palm/MCP
  const distance = getDistance(mcp, tip);
  return distance < 0.1;
};

export const areFingersTouching = (
  landmarks: HandLandmark[],
  finger1Tip: number,
  finger2Tip: number,
  threshold: number = 0.05
): boolean => {
  const tip1 = landmarks[finger1Tip];
  const tip2 = landmarks[finger2Tip];
  return getDistance(tip1, tip2) < threshold;
};

// Fingerspelling alphabet (A-Z)
export const fingerspellingAlphabet: BSLSign[] = [
  {
    name: 'A',
    description: 'Fist with thumb to side',
    category: 'letter',
    detector: (landmarks) => {
      // All fingers curled, thumb extended to side
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      
      const score = [indexCurled, middleCurled, ringCurled, pinkyCurled, thumbExtended]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: 'B',
    description: 'Flat hand, fingers together, thumb across palm',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      const thumbCurled = isFingerCurled(landmarks, 1, 4);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended, thumbCurled]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: 'C',
    description: 'Curved hand like holding a cup',
    category: 'letter',
    detector: (landmarks) => {
      // Fingers slightly curved forming C shape
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const pinkyTip = landmarks[20];
      
      // Check for C-curve shape
      const openGap = getDistance(thumbTip, indexTip) > 0.1;
      const curvedShape = getDistance(thumbTip, pinkyTip) > 0.15;
      
      return (openGap && curvedShape) ? 0.8 : 0.2;
    }
  },
  {
    name: 'D',
    description: 'Index finger up, other fingers touching thumb',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      const thumbTouchingMiddle = areFingersTouching(landmarks, 4, 12, 0.08);
      
      const score = [indexExtended, middleCurled, ringCurled, pinkyCurled, thumbTouchingMiddle]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: 'E',
    description: 'Fingers curled, thumb across fingers',
    category: 'letter',
    detector: (landmarks) => {
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexCurled, middleCurled, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: 'F',
    description: 'Index and thumb touch, other fingers extended',
    category: 'letter',
    detector: (landmarks) => {
      const thumbIndexTouch = areFingersTouching(landmarks, 4, 8, 0.06);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      
      const score = [thumbIndexTouch, middleExtended, ringExtended, pinkyExtended]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: 'G',
    description: 'Pointing sideways with index and thumb',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      // Check horizontal orientation
      const indexTip = landmarks[8];
      const wrist = landmarks[0];
      const isHorizontal = Math.abs(indexTip.y - wrist.y) < 0.15;
      
      const score = [indexExtended, thumbExtended, middleCurled, ringCurled, pinkyCurled, isHorizontal]
        .filter(Boolean).length / 6;
      return score;
    }
  },
  {
    name: 'H',
    description: 'Index and middle fingers extended horizontally',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexExtended, middleExtended, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: 'I',
    description: 'Pinky finger extended only',
    category: 'letter',
    detector: (landmarks) => {
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      
      const score = [pinkyExtended, indexCurled, middleCurled, ringCurled]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: 'K',
    description: 'Index and middle up, thumb between them',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      
      const score = [indexExtended, middleExtended, ringCurled, pinkyCurled, thumbExtended]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: 'L',
    description: 'L-shape with index and thumb',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      // Check perpendicular angle between thumb and index
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const wrist = landmarks[0];
      const isLShape = Math.abs(thumbTip.x - wrist.x) > 0.1 && 
                       Math.abs(indexTip.y - wrist.y) > 0.1;
      
      const score = [indexExtended, thumbExtended, middleCurled, ringCurled, pinkyCurled, isLShape]
        .filter(Boolean).length / 6;
      return score;
    }
  },
  {
    name: 'O',
    description: 'Fingers and thumb form O shape',
    category: 'letter',
    detector: (landmarks) => {
      const thumbIndexTouch = areFingersTouching(landmarks, 4, 8, 0.08);
      
      const score = thumbIndexTouch ? 0.85 : 0.2;
      return score;
    }
  },
  {
    name: 'V',
    description: 'Peace sign - index and middle extended',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      const thumbCurled = isFingerCurled(landmarks, 1, 4);
      
      // Check fingers are spread apart
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const fingerSpread = getDistance(indexTip, middleTip) > 0.05;
      
      const score = [indexExtended, middleExtended, ringCurled, pinkyCurled, thumbCurled, fingerSpread]
        .filter(Boolean).length / 6;
      return score;
    }
  },
  {
    name: 'W',
    description: 'Index, middle, ring extended',
    category: 'letter',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      const thumbCurled = isFingerCurled(landmarks, 1, 4);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyCurled, thumbCurled]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: 'Y',
    description: 'Thumb and pinky extended (hang loose)',
    category: 'letter',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      
      const score = [thumbExtended, pinkyExtended, indexCurled, middleCurled, ringCurled]
        .filter(Boolean).length / 5;
      return score;
    }
  }
];

// Common BSL words and phrases
export const commonSigns: BSLSign[] = [
  {
    name: 'Hello',
    description: 'Wave hand',
    category: 'word',
    detector: (landmarks) => {
      // Open hand, all fingers extended
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended]
        .filter(Boolean).length / 4;
      return score > 0.7 ? score : 0;
    }
  },
  {
    name: 'Thank you',
    description: 'Flat hand from chin forward',
    category: 'phrase',
    detector: (landmarks) => {
      // Flat hand gesture
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended]
        .filter(Boolean).length / 4;
      return score > 0.8 ? score * 0.9 : 0;
    }
  },
  {
    name: 'Yes',
    description: 'Fist nodding',
    category: 'word',
    detector: (landmarks) => {
      // Closed fist
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexCurled, middleCurled, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score > 0.7 ? score : 0;
    }
  },
  {
    name: 'No',
    description: 'Index finger wagging',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexExtended, middleCurled, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score > 0.7 ? score : 0;
    }
  },
  {
    name: 'Help',
    description: 'Thumbs up on flat palm',
    category: 'word',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      
      return (thumbExtended && indexCurled) ? 0.75 : 0.2;
    }
  },
  {
    name: 'Please',
    description: 'Flat hand circular on chest',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      
      return (indexExtended && middleExtended) ? 0.7 : 0.2;
    }
  },
  {
    name: 'Good',
    description: 'Thumbs up',
    category: 'word',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      // Thumb should be pointing up
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];
      const thumbPointingUp = thumbTip.y < wrist.y;
      
      const score = [thumbExtended, indexCurled, middleCurled, ringCurled, pinkyCurled, thumbPointingUp]
        .filter(Boolean).length / 6;
      return score;
    }
  },
  {
    name: 'Bad',
    description: 'Thumbs down',
    category: 'word',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      
      // Thumb should be pointing down
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];
      const thumbPointingDown = thumbTip.y > wrist.y;
      
      const score = [thumbExtended, indexCurled, middleCurled, thumbPointingDown]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: 'Question',
    description: 'Drawing question mark',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      
      return (indexExtended && middleCurled) ? 0.65 : 0.2;
    }
  },
  {
    name: 'Stop',
    description: 'Flat palm facing forward',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended, thumbExtended]
        .filter(Boolean).length / 5;
      return score > 0.8 ? score : 0;
    }
  },
  // === EDUCATION WORDS ===
  {
    name: 'Learn',
    description: 'Hand from head pulling knowledge out',
    category: 'word',
    detector: (landmarks) => {
      // Open hand near face
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const wrist = landmarks[0];
      const indexTip = landmarks[8];
      
      // Hand should be relatively high (near face)
      const handHigh = wrist.y < 0.5;
      
      const score = [indexExtended, middleExtended, handHigh]
        .filter(Boolean).length / 3;
      return score > 0.6 ? score : 0;
    }
  },
  {
    name: 'Think',
    description: 'Index finger pointing to temple',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      // Hand should be near head height
      const wrist = landmarks[0];
      const handHigh = wrist.y < 0.4;
      
      const score = [indexExtended, middleCurled, ringCurled, pinkyCurled, handHigh]
        .filter(Boolean).length / 5;
      return score > 0.7 ? score : 0;
    }
  },
  {
    name: 'Understand',
    description: 'Index finger flicking up from forehead',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const wrist = landmarks[0];
      const handHigh = wrist.y < 0.4;
      
      return (indexExtended && thumbExtended && handHigh) ? 0.75 : 0.2;
    }
  },
  {
    name: 'Computer',
    description: 'C-shape moving from side to side',
    category: 'word',
    detector: (landmarks) => {
      // C-shape hand
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const openGap = getDistance(thumbTip, indexTip) > 0.1;
      
      return openGap ? 0.7 : 0.2;
    }
  },
  {
    name: 'Science',
    description: 'Two hands alternating pouring motion',
    category: 'word',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      
      return (thumbExtended && indexExtended) ? 0.65 : 0.2;
    }
  },
  {
    name: 'Math',
    description: 'X-crossing motion with index fingers',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      
      const score = [indexExtended, middleExtended, ringCurled]
        .filter(Boolean).length / 3;
      return score > 0.6 ? score : 0;
    }
  },
  {
    name: 'Book',
    description: 'Palms together opening like a book',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      
      // Flat hand
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended]
        .filter(Boolean).length / 4;
      return score > 0.8 ? score * 0.85 : 0;
    }
  },
  {
    name: 'Write',
    description: 'Writing motion on palm',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      
      // Pinch grip for writing
      const thumbIndexClose = areFingersTouching(landmarks, 4, 8, 0.08);
      
      const score = [thumbIndexClose || (indexExtended && thumbExtended), middleCurled]
        .filter(Boolean).length / 2;
      return score > 0.5 ? 0.7 : 0.2;
    }
  },
  {
    name: 'Read',
    description: 'Two fingers scanning across palm',
    category: 'word',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexExtended, middleExtended, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score > 0.7 ? score : 0;
    }
  },
  // === TECHNOLOGY WORDS ===
  {
    name: 'AI',
    description: 'A then I fingerspelling',
    category: 'word',
    detector: (landmarks) => {
      // AI is often signed as A-I fingerspelling
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      
      const score = [indexCurled, middleCurled, thumbExtended]
        .filter(Boolean).length / 3;
      return score > 0.6 ? score : 0;
    }
  },
  {
    name: 'Technology',
    description: 'Middle finger tapping wrist',
    category: 'word',
    detector: (landmarks) => {
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const indexCurled = isFingerCurled(landmarks, 5, 8);
      
      return (middleExtended && indexCurled) ? 0.7 : 0.2;
    }
  },
  {
    name: 'Internet',
    description: 'Connected fingers web motion',
    category: 'word',
    detector: (landmarks) => {
      // All fingers touching each other at tips
      const indexMiddleTouch = areFingersTouching(landmarks, 8, 12, 0.06);
      const middleRingTouch = areFingersTouching(landmarks, 12, 16, 0.06);
      
      return (indexMiddleTouch || middleRingTouch) ? 0.7 : 0.2;
    }
  }
];

// Number signs (0-9)
export const numberSigns: BSLSign[] = [
  {
    name: '0',
    description: 'O shape with all fingers',
    category: 'number',
    detector: (landmarks) => {
      const thumbIndexTouch = areFingersTouching(landmarks, 4, 8, 0.08);
      return thumbIndexTouch ? 0.8 : 0.2;
    }
  },
  {
    name: '1',
    description: 'Index finger up',
    category: 'number',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleCurled = isFingerCurled(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexExtended, middleCurled, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: '2',
    description: 'Index and middle up (V sign)',
    category: 'number',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [indexExtended, middleExtended, ringCurled, pinkyCurled]
        .filter(Boolean).length / 4;
      return score;
    }
  },
  {
    name: '3',
    description: 'Thumb, index, middle extended',
    category: 'number',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringCurled = isFingerCurled(landmarks, 13, 16);
      const pinkyCurled = isFingerCurled(landmarks, 17, 20);
      
      const score = [thumbExtended, indexExtended, middleExtended, ringCurled, pinkyCurled]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: '4',
    description: 'Four fingers extended, thumb curled',
    category: 'number',
    detector: (landmarks) => {
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      const thumbCurled = isFingerCurled(landmarks, 1, 4);
      
      const score = [indexExtended, middleExtended, ringExtended, pinkyExtended, thumbCurled]
        .filter(Boolean).length / 5;
      return score;
    }
  },
  {
    name: '5',
    description: 'All five fingers extended',
    category: 'number',
    detector: (landmarks) => {
      const thumbExtended = isFingerExtended(landmarks, 1, 4);
      const indexExtended = isFingerExtended(landmarks, 5, 8);
      const middleExtended = isFingerExtended(landmarks, 9, 12);
      const ringExtended = isFingerExtended(landmarks, 13, 16);
      const pinkyExtended = isFingerExtended(landmarks, 17, 20);
      
      const score = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
        .filter(Boolean).length / 5;
      return score;
    }
  }
];

// Combine all signs
export const allSigns: BSLSign[] = [
  ...fingerspellingAlphabet,
  ...commonSigns,
  ...numberSigns
];

// Main detection function
export const detectSign = (landmarks: HandLandmark[]): { sign: string; confidence: number } | null => {
  if (!landmarks || landmarks.length !== 21) {
    return null;
  }
  
  let bestMatch: { sign: string; confidence: number } | null = null;
  
  for (const sign of allSigns) {
    const confidence = sign.detector(landmarks);
    
    if (confidence > 0.6 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { sign: sign.name, confidence };
    }
  }
  
  return bestMatch;
};

// Get sign info by name
export const getSignInfo = (name: string): BSLSign | undefined => {
  return allSigns.find(sign => sign.name.toLowerCase() === name.toLowerCase());
};
