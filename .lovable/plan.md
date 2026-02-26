

## Diagnosis: Hume AI Audio Not Playing

### Analysis

From the logs, the data pipeline works end-to-end:
- Hume TTS edge function returns 200 with binary PCM data
- Client receives and processes all chunks ("Hume TTS stream complete")
- No errors thrown

The most likely causes (in order of probability):

1. **Byte alignment issue in streaming**: `reader.read()` from fetch may split PCM samples across chunks. The `PCM16Resampler` creates `Int16Array` views that require 2-byte alignment. Odd-length chunks would silently lose a byte, causing all subsequent audio to be misaligned/garbled.

2. **Missing debug visibility**: Simli's `enableConsoleLogs` is `false`, so if Simli silently drops audio (e.g., session not initialized), we'd never know.

3. **Hume PCM might not be 48kHz**: While Pipecat defaults to 48kHz, the actual Hume API doesn't document PCM sample rate explicitly for streaming. If it's 24kHz, the 48k→16k resampler would produce audio at half the expected rate.

### Plan

**File: `src/hooks/useRealtimeChat.ts`** — Fix `streamHumeTTS`:
- Add a byte accumulator buffer to handle uneven chunk boundaries (ensure only even-byte-count data reaches the resampler, carrying over any leftover byte to the next chunk)
- Add debug logging: log chunk sizes, resampled output sizes, and whether `simliSendAudioRef.current` is set
- Log total bytes sent to Simli at stream end

**File: `supabase/functions/hume-tts-stream/index.ts`** — Explicit sample rate:
- Add `sample_rate: 48000` to the Hume API format parameter to be explicit about the expected output rate

**File: `src/components/AvatarPanel.tsx`** — Enable Simli debug logs:
- Set `enableConsoleLogs: true` in Simli's `Initialize()` config so we can see if Simli is dropping audio

These changes will either fix the issue (byte alignment) or provide the debug output needed to identify the exact failure point.

