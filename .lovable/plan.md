

## Plan: Remove Hume AI Voice, Use OpenAI Voices for All Teachers

### What's changing
Remove the non-working Hume AI voice integration entirely. All 5 teachers will use OpenAI's built-in Realtime voices (which already work with lip-sync). Each teacher already has a unique OpenAI voice assigned:

| Teacher | OpenAI Voice |
|---------|-------------|
| Lina | shimmer |
| Zahra | nova |
| Hank | echo |
| Mark | onyx |
| Kate | alloy |

### Changes

**1. `src/lib/teachers.ts`**
- Remove `humeVoiceId` field from the `Teacher` interface
- Remove `humeVoiceId` value from Mark's entry
- Remove `elevenLabsVoiceId` field if also unused (ElevenLabs appears unused in the active flow too — will verify)

**2. `src/hooks/useRealtimeChat.ts`**
- Remove the `humeVoiceId` parameter from the hook signature
- Remove `humeResamplerRef` (the 48kHz resampler)
- Remove the entire `streamHumeTTS` function
- Remove the Hume TTS trigger in `response.text.done` handler
- Remove the text-only mode branching in `session.created` — always use `["text", "audio"]` modalities with the teacher's OpenAI voice
- Remove `humeVoiceIdRef` and its effect
- Clean up `humeResamplerRef.reset()` calls

**3. `src/pages/Index.tsx`**
- Remove `humeVoiceId` from the `useRealtimeChat` call

**4. `supabase/functions/hume-tts-stream/index.ts`**
- Delete this edge function entirely (no longer needed)

**5. `src/components/AvatarPanel.tsx`**
- Revert `enableConsoleLogs` back to `false` (was only for Hume debugging)

### What stays
- OpenAI Realtime voice path (`response.audio.delta` → resample 24kHz→16kHz → Simli) — this already works
- ElevenLabs edge functions (kept as fallback infrastructure, not actively used in the main flow)
- The `elevenLabsVoiceId` field stays in teachers for potential future use

