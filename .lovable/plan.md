

## Fix: Hume AI Audio Not Playing

### Root Cause
Hume AI's TTS API outputs PCM audio at **48kHz** by default, but the code resamples it using a 24kHz→16kHz resampler. This produces incorrectly pitched/silent audio when sent to Simli.

### Solution
Create a separate resampler for the Hume TTS path that converts from 48kHz to 16kHz instead of 24kHz to 16kHz.

### Changes

**1. `src/hooks/useRealtimeChat.ts`**
- Add a dedicated `humeResamplerRef` initialized as `new PCM16Resampler(48000, 16000)`
- Update `streamHumeTTS` to use this resampler instead of the shared one
- Reset `humeResamplerRef` in the same places `resamplerRef` is reset

### Technical Detail
- The existing `resamplerRef` (24kHz→16kHz) continues to serve OpenAI and ElevenLabs audio paths unchanged
- Hume's default PCM output is 48kHz (confirmed by Hume documentation and their Pipecat integration which defaults to `sample_rate=48000`)
- The PCM16Resampler class already accepts custom rates in its constructor, so no changes to `pcmResampler.ts` are needed

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Add `humeResamplerRef` (48kHz→16kHz), use it in `streamHumeTTS` |

