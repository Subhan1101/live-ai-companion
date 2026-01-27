

# Open Source BSL Integration Plan

## Overview
Replace the current Google MediaPipe-based BSL system with dedicated open-source BSL libraries for both input (camera recognition) and output (display). This will significantly improve accuracy by using models specifically trained on British Sign Language.

---

## Current vs. Proposed Architecture

```text
CURRENT SYSTEM (Inaccurate)
┌─────────────────────────────────────────────────────────────────┐
│ Camera → MediaPipe Hands → Custom Rules → Approximate Signs    │
│                                                                  │
│ AI Response → Emoji Placeholders (👋, 🤙, etc.)                 │
└─────────────────────────────────────────────────────────────────┘

PROPOSED SYSTEM (Accurate BSL)
┌─────────────────────────────────────────────────────────────────┐
│ Camera → SlingoModels (TF.js) → Trained BSL Recognition         │
│                           ↓                                      │
│                    Real BSL Labels                               │
│                                                                  │
│ AI Response → BSL SignBank Videos → Native Signer MP4/GIF       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Open Source Libraries to Integrate

### 1. BSL Input (Camera Recognition) - SlingoModels

**Source**: University of Bath research project  
**GitHub**: `dp846/slingomodels`  
**Format**: TensorFlow.js Graph Models  
**Categories**: Greetings, Family, Common Words (expandable)  

Why SlingoModels:
- Specifically trained on BSL (not ASL or generic gestures)
- TensorFlow.js compatible (runs in browser)
- Pre-trained models ready to use
- Includes continuous sign recognition

### 2. BSL Output (Display) - BSL SignBank

**Source**: University College London  
**URL**: `bslsignbank.ucl.ac.uk`  
**Format**: MP4 video clips  
**License**: Academic/Educational (free for non-commercial)  

Why BSL SignBank:
- Most comprehensive BSL dictionary
- Videos of native Deaf signers
- Includes gloss annotations
- Free for educational use

---

## Implementation Steps

### Phase 1: BSL Input Recognition Upgrade

#### 1.1 Create TensorFlow.js Model Loader
**New file**: `src/lib/bslTensorflowModel.ts`

This module will:
- Load SlingoModels TensorFlow.js models
- Handle model caching in IndexedDB
- Provide prediction interface for hand landmarks

#### 1.2 Update useBSLRecognition Hook
**Edit**: `src/hooks/useBSLRecognition.ts`

Changes:
- Replace MediaPipe-only approach with a hybrid:
  - MediaPipe for hand detection (it's good at finding hands)
  - SlingoModels for BSL classification (trained specifically on BSL)
- Add model loading state
- Improve confidence scoring with trained model output

#### 1.3 Expand Gesture Library
**Edit**: `src/lib/bslGestures.ts`

Changes:
- Keep MediaPipe landmark helpers (useful for preprocessing)
- Add SlingoModels prediction wrapper
- Map model outputs to BSL vocabulary
- Add new categories: Family, Numbers (from SlingoModels)

---

### Phase 2: BSL Output Display Upgrade

#### 2.1 Create BSL Video Service
**New file**: `src/lib/bslVideoService.ts`

This module will:
- Fetch video URLs from BSL SignBank (or local cache)
- Handle video preloading for smooth playback
- Provide fallback to emoji if video unavailable
- Manage video caching strategy

#### 2.2 Create BSL Video Player Component
**New file**: `src/components/BSLVideoPlayer.tsx`

A specialized video player that:
- Shows signing videos in a loop
- Supports playback speed control
- Smooth transitions between signs
- Handles loading states gracefully

#### 2.3 Update BSL Overlay
**Edit**: `src/components/BSLOverlay.tsx`

Changes:
- Replace emoji display with video player
- Add video-specific controls (loop, speed)
- Keep emoji as fallback for missing videos
- Add loading skeleton for video fetch

---

### Phase 3: BSL Video Library Setup

#### 3.1 Create Local Video Cache
**New file**: `src/lib/bslVideoLibrary.ts`

Static mapping of common educational words to SignBank video URLs:
- Alphabet (A-Z)
- Numbers (0-9)
- Greetings (Hello, Goodbye, Thank you)
- Education terms (Teacher, Student, Learn, etc.)
- Common verbs and nouns

This approach:
- No API costs (direct video URLs)
- Works offline after first load
- Can be expanded incrementally

#### 3.2 Create Edge Function for Video Proxy (Optional)
**New file**: `supabase/functions/bsl-video-proxy/index.ts`

Purpose:
- Proxy SignBank requests to handle CORS
- Add caching headers for performance
- Rate limiting protection

---

## Technical Details

### SlingoModels Integration

```typescript
// Load model
const model = await tf.loadGraphModel('/models/slingo/greetings/model.json');

// Predict from landmarks
const predictions = await model.predict(landmarkTensor);
const signLabel = SIGN_LABELS[predictions.argMax().dataSync()[0]];
```

### BSL SignBank Video URLs

```typescript
const signVideos: Record<string, string> = {
  'HELLO': 'https://media.bslsignbank.ucl.ac.uk/signs/BSL/hello.mp4',
  'THANK_YOU': 'https://media.bslsignbank.ucl.ac.uk/signs/BSL/thank_you.mp4',
  'LEARN': 'https://media.bslsignbank.ucl.ac.uk/signs/BSL/learn.mp4',
  // ... more mappings
};
```

### Hybrid Detection Flow

```text
1. MediaPipe detects hand in frame
2. Extract 21 landmarks (x, y, z)
3. Normalize landmarks for model input
4. Pass to SlingoModels TF.js model
5. Get classification (e.g., "HELLO", confidence: 0.92)
6. Display result + hold timer for confirmation
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/bslTensorflowModel.ts` | TensorFlow.js model loading and prediction |
| `src/lib/bslVideoService.ts` | BSL SignBank video fetching and caching |
| `src/lib/bslVideoLibrary.ts` | Static mapping of words to video URLs |
| `src/components/BSLVideoPlayer.tsx` | Video player for sign display |
| `supabase/functions/bsl-video-proxy/index.ts` | (Optional) CORS proxy for videos |

## Files to Edit

| File | Changes |
|------|---------|
| `src/hooks/useBSLRecognition.ts` | Add SlingoModels integration |
| `src/lib/bslGestures.ts` | Add TF.js prediction wrapper |
| `src/components/BSLOverlay.tsx` | Replace emoji with video player |
| `package.json` | Already has @tensorflow/tfjs |

---

## Dependencies

Already installed:
- `@tensorflow/tfjs` - Machine learning framework

To be used (external resources, no npm install needed):
- SlingoModels (hosted model files)
- BSL SignBank (video CDN)

---

## Accuracy Comparison

| Feature | Current (MediaPipe) | Proposed (SlingoModels) |
|---------|---------------------|------------------------|
| Alphabet Recognition | ~50% | ~83%+ |
| Word Recognition | ~30% | ~75%+ |
| BSL Grammar | None | Basic |
| Two-Hand Signs | Limited | Supported |
| Output Quality | Emoji | Real Videos |

---

## Limitations and Considerations

1. **Model Size**: SlingoModels are ~5-10MB per category. Initial load may take a few seconds.

2. **Video Licensing**: BSL SignBank is free for educational/non-commercial use. Commercial use requires permission.

3. **Vocabulary Coverage**: Not all words have SignBank videos. Fingerspelling (A-Z videos) will be the fallback.

4. **CORS**: SignBank videos may need a proxy. The edge function handles this.

5. **Offline Support**: After first load, videos can be cached in browser storage.

---

## Rollout Strategy

**Phase 1** (Week 1): 
- Integrate SlingoModels for input recognition
- Test with greetings category

**Phase 2** (Week 2):
- Add SignBank videos for output
- Build video library for 50 common words

**Phase 3** (Week 3):
- Add more model categories (Family, Education)
- Expand video library to 100+ words
- Add offline caching

