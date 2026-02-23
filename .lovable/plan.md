

## Plan: Switch Back to OpenAI Built-in TTS Voices

### Why

Your HR cannot purchase the ElevenLabs Pro plan, and you already have a paid OpenAI API. The good news is that each teacher already has a unique OpenAI voice assigned (shimmer, nova, echo, onyx, alloy) -- we just need to switch back to using them.

### What Changes

Switch the OpenAI Realtime session back from "text only" mode to "text + audio" mode, so OpenAI generates speech directly using each teacher's assigned voice. Remove the ElevenLabs TTS streaming code path.

### Teacher Voice Assignments (Already Configured)

| Teacher | OpenAI Voice |
|---------|-------------|
| Lina    | shimmer     |
| Zahra   | nova        |
| Hank    | echo        |
| Mark    | onyx        |
| Kate    | alloy       |

These are 5 distinct OpenAI voices -- they will sound different from each other.

### Technical Changes

**File: `src/hooks/useRealtimeChat.ts`**

1. Change session config back to audio mode:
   - `modalities: ["text", "audio"]` (was `["text"]`)
   - Add back `voice: teacherVoiceRef.current || "shimmer"`
   - Add back `output_audio_format: "pcm16"`

2. Re-enable `response.audio.delta` handler:
   - Decode base64 PCM audio from OpenAI
   - Resample 24kHz to 16kHz and send to Simli for lip-sync
   - Fall back to AudioQueue if Simli is unavailable

3. In `response.text.done`:
   - Keep whiteboard detection and transcript cleanup
   - Remove the ElevenLabs TTS call (`streamElevenLabsTTS`)

4. Re-enable `response.audio_transcript.delta` and `response.audio_transcript.done` as the primary transcript handlers (OpenAI sends these alongside audio)

5. The `streamElevenLabsTTS` function can stay but won't be called -- or we can remove it to keep things clean.

**No other files need changes** -- `Index.tsx` already passes `teacherVoice` (the OpenAI voice name) to the hook.

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Switch back to text+audio mode, re-enable audio.delta handler, remove ElevenLabs TTS call |

