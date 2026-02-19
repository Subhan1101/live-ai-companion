

## Problem: Why All Avatars Sound the Same

### Root Cause

Your app currently uses this audio pipeline:

1. User speaks -> **OpenAI Realtime API** transcribes speech (Whisper)
2. OpenAI generates a text response using a **hardcoded "EduGuide" system prompt** (same for all 5 teachers)
3. OpenAI generates audio using a **hardcoded voice called "shimmer"** (same for all 5 teachers)
4. That audio is sent to **Simli purely for lip-sync** -- Simli only moves the avatar's mouth to match the audio

Simli is NOT being used as a conversational AI here. It is only receiving audio and animating the face. The voices and system prompts you trained inside Simli's platform are never used because the app bypasses Simli's conversation engine entirely.

### The Fix

There are two possible approaches:

#### Option A: Use Simli's Built-in Conversational AI (Recommended)

Instead of routing everything through OpenAI Realtime + piping audio to Simli for lip-sync, use Simli's own conversation API which already has your trained voices and prompts.

This means:
- Remove the OpenAI Realtime WebSocket connection for voice
- Use Simli's conversational AI endpoint instead (the avatars will use their trained voices and system prompts automatically)
- Simli handles STT, LLM response, TTS, and lip-sync all in one

**Pros**: Uses the exact voices and prompts you trained. Simpler architecture.
**Cons**: Depends on what Simli's conversation API supports (may need to verify features like whiteboard, image input, etc.)

#### Option B: Keep OpenAI Realtime but Use Per-Teacher Voice and Prompt

Keep the current architecture (OpenAI for conversation, Simli for lip-sync only) but make the voice and system prompt dynamic per teacher.

Changes needed:

1. **`src/lib/teachers.ts`** -- Add `voice` and `systemPrompt` fields to each teacher:
   - Lina: voice "shimmer", her custom prompt
   - Zahra: voice "nova", her custom prompt
   - Hank: voice "echo", his custom prompt
   - Mark: voice "onyx", his custom prompt
   - Kate: voice "alloy", her custom prompt

2. **`src/hooks/useRealtimeChat.ts`** -- Accept a `teacher` parameter:
   - Change `connect()` to accept the selected teacher
   - In the `session.update` message (line ~409-568), use `teacher.voice` instead of hardcoded `"shimmer"`
   - Use `teacher.systemPrompt` instead of the hardcoded EduGuide prompt

3. **`src/pages/Index.tsx`** -- Pass the selected teacher to the chat hook

**Pros**: Keeps existing features (whiteboard, image upload, BSL). Full control over voices and prompts.
**Cons**: Uses OpenAI's voices (not the exact ones from Simli training). You would need to replicate your Simli-trained prompts into the teacher definitions.

### Recommendation

**Option A** is recommended if Simli's conversational AI supports all the features you need (whiteboard detection, image processing, etc.) -- since it will use the exact voices and prompts you already trained.

**Option B** is the safer fallback if you need to keep OpenAI features but want different voices per teacher. The voices will be OpenAI's built-in voices (shimmer, nova, echo, onyx, alloy, etc.), not the Simli-trained ones.

### Technical Details (Option B Implementation)

**File: `src/lib/teachers.ts`**
- Add `openaiVoice` field (one of: "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer")
- Add `systemPrompt` field with each teacher's unique personality and subject expertise

**File: `src/hooks/useRealtimeChat.ts`**
- Change the hook signature to accept a `Teacher` object or at minimum `voice` and `instructions` parameters
- Replace hardcoded `voice: "shimmer"` (line 551) with the teacher's voice
- Replace hardcoded instructions string (lines 414-550) with the teacher's system prompt
- Store the teacher reference so reconnects use the same config

**File: `src/pages/Index.tsx`**
- Pass `selectedTeacher` to `useRealtimeChat()` or to `connect()`

