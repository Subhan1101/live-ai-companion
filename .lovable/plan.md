

## Plan: Use ElevenLabs Voices for Each Teacher

### Problem

The current system uses OpenAI Realtime API's built-in TTS voices (alloy, echo, nova, onyx, shimmer). These are generic OpenAI voices -- not the custom ElevenLabs voices you provided for each teacher. The ElevenLabs voice IDs were added to the teacher config but are never actually used in the audio pipeline.

### Why Some Teachers Sound the Same

OpenAI only has ~10 built-in voices, and some (like alloy, nova, shimmer) can sound similar. The unique ElevenLabs voices you assigned to each teacher are never called during the realtime session.

### Solution

Switch the OpenAI Realtime session from "text + audio" mode to "text only" mode. Then, when the AI responds with text, stream that text through the ElevenLabs TTS streaming edge function to generate audio with the teacher's unique voice. Send that audio to Simli for lip-sync.

### How It Works Today vs After Fix

**Today:**
```text
User speaks --> OpenAI STT --> AI thinks --> OpenAI TTS (generic voice) --> Simli lip-sync
```

**After fix:**
```text
User speaks --> OpenAI STT --> AI thinks --> Text response --> ElevenLabs TTS (unique voice) --> Simli lip-sync
```

### Changes

**1. `src/hooks/useRealtimeChat.ts` -- Major changes**

- Accept `elevenLabsVoiceId` as a new parameter (alongside `teacherVoice` and `teacherInstructions`)
- Change `session.update` to use `modalities: ["text"]` instead of `["text", "audio"]` -- this tells OpenAI to only generate text, not audio
- Remove the `response.audio.delta` handler (OpenAI won't send audio anymore)
- Add a new handler for `response.text.delta` and `response.text.done` -- when the AI finishes a text response, stream it through ElevenLabs TTS
- Create a new function `streamElevenLabsTTS(text, voiceId)` that:
  - Calls the `elevenlabs-tts-stream` edge function with the teacher's voice ID
  - Reads the PCM audio stream in chunks
  - Sends each chunk to Simli for lip-sync (resampled from 24kHz to 16kHz)
  - Falls back to the AudioQueue if Simli isn't available
- Keep the `response.audio_transcript.delta` handler for showing text in the transcript (or switch to `response.text.delta`)

**2. `src/pages/Index.tsx` -- Pass ElevenLabs voice ID**

- Pass `selectedTeacher?.elevenLabsVoiceId` to `useRealtimeChat` as the third parameter

**3. `supabase/functions/elevenlabs-tts-stream/index.ts` -- Already updated**

- This function already accepts `voiceId` from the request body (updated in the previous plan). No changes needed.

### Technical Details

The key change in `useRealtimeChat.ts` session configuration:

```text
// BEFORE
session: {
  modalities: ["text", "audio"],
  voice: teacherVoiceRef.current || "shimmer",
  output_audio_format: "pcm16",
  ...
}

// AFTER
session: {
  modalities: ["text"],
  // No voice or output_audio_format needed -- OpenAI won't generate audio
  ...
}
```

New ElevenLabs streaming function:

```text
async function streamElevenLabsTTS(text: string, voiceId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/elevenlabs-tts-stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey, Authorization },
      body: JSON.stringify({ text, voiceId }),
    }
  );
  
  const reader = response.body.getReader();
  // Read chunks and send to Simli for lip-sync
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Resample 24kHz PCM to 16kHz and send to Simli
    const resampled = resampler.process(value);
    simliSendAudio(resampled);
  }
}
```

Response handling changes:

```text
// Replace response.audio.delta with response.text.delta / response.text.done
case "response.text.delta":
  // Accumulate text for transcript display (same as audio_transcript.delta)
  break;

case "response.text.done":
  // Full text received -- send to ElevenLabs for voice synthesis
  streamElevenLabsTTS(fullResponseText, elevenLabsVoiceIdRef.current);
  break;
```

### Important Considerations

- **Latency**: There will be a slight increase in latency since we now wait for the text response, then stream it to ElevenLabs, then to Simli. However, ElevenLabs turbo v2.5 is fast and streaming helps minimize perceived delay.
- **STT unchanged**: OpenAI Whisper-1 still handles speech-to-text -- only the TTS output changes.
- **Fallback**: If ElevenLabs fails, we can fall back to a simpler non-streaming TTS call or show a toast error.
- **Sentence-level streaming**: To reduce latency further, we can send text to ElevenLabs sentence-by-sentence as it arrives via `response.text.delta`, rather than waiting for the full response.

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Switch to text-only mode, add ElevenLabs TTS streaming, handle text events |
| `src/pages/Index.tsx` | Pass `elevenLabsVoiceId` to `useRealtimeChat` |
