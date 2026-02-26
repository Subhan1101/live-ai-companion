

## Plan: Integrate Hume AI TTS for Mark (Test)

### Goal
Replace Mark's OpenAI built-in voice with a custom Hume AI cloned voice. Other teachers remain on OpenAI TTS. This is a pilot test -- if it works well, we'll extend to all teachers.

### How It Works

Currently, OpenAI Realtime generates audio directly (text+audio mode). For Mark, we need to:
1. Switch OpenAI to **text-only mode** (so it returns text, not audio)
2. Send that text to **Hume AI TTS** to generate speech with the custom voice
3. Stream the PCM audio to **Simli** for lip-sync

For all other teachers, OpenAI's built-in audio mode continues unchanged.

### What You Need to Provide
1. **Hume AI API Key** -- stored securely as a backend secret
2. **Hume AI Voice ID** -- the cloned voice ID for Mark

### Technical Changes

**1. New Edge Function: `supabase/functions/hume-tts-stream/index.ts`**
- Accepts `{ text, voiceId }` from the frontend
- Calls Hume AI's streaming JSON endpoint: `POST https://api.hume.ai/v0/tts/stream/json`
- Uses `X-Hume-Api-Key` header for auth
- Requests PCM format at 24kHz (to match existing Simli pipeline)
- Streams base64 PCM chunks back to the client as raw PCM bytes
- Follows same pattern as the existing ElevenLabs edge function

**2. Update `src/lib/teachers.ts`**
- Add a `humeVoiceId?: string` field to the `Teacher` interface
- Set it only for Mark (with the voice ID you provide)
- Other teachers: field remains `undefined`

**3. Update `src/hooks/useRealtimeChat.ts`**
- Accept new param: `humeVoiceId?: string`
- **Session config logic**: If `humeVoiceId` is set, use `modalities: ["text"]` (text-only mode, no OpenAI audio). Otherwise keep `["text", "audio"]` with OpenAI voice.
- **In `response.text.done`**: If `humeVoiceId` is set, call a new `streamHumeTTS()` function (similar to existing `streamElevenLabsTTS`) that hits the new edge function and pipes PCM to Simli.
- **Transcript handling**: When in text-only mode (Hume path), use `response.text.delta` for transcripts. When in audio mode (OpenAI path), use `response.audio_transcript.delta`.

**4. Update `src/pages/Index.tsx`**
- Pass `selectedTeacher?.humeVoiceId` to `useRealtimeChat`

**5. Update `supabase/config.toml`**
- Add `[functions.hume-tts-stream]` with `verify_jwt = false`

### Architecture Flow

```text
Mark (Hume AI):
  User speaks → OpenAI Realtime (text only) → response.text.done
    → Edge Function (hume-tts-stream) → Hume AI API (PCM stream)
    → Resample 24kHz→16kHz → Simli (lip-sync)

Other Teachers (OpenAI TTS):
  User speaks → OpenAI Realtime (text+audio) → response.audio.delta
    → Resample 24kHz→16kHz → Simli (lip-sync)
```

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/hume-tts-stream/index.ts` | New edge function for Hume AI TTS streaming |
| `supabase/config.toml` | Add `hume-tts-stream` function config |
| `src/lib/teachers.ts` | Add `humeVoiceId` field, set for Mark |
| `src/hooks/useRealtimeChat.ts` | Add Hume TTS path, conditional text/audio mode |
| `src/pages/Index.tsx` | Pass `humeVoiceId` to hook |

### Secrets Required
- `HUME_API_KEY` -- your Hume AI API key (will be stored securely as a backend secret)

### After Implementation
Select Mark as teacher, speak to him, and verify:
- You hear the custom cloned voice (not OpenAI's "onyx")
- Lip-sync works with Simli
- Transcript appears correctly in chat

