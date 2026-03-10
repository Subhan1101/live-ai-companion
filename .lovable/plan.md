

## Plan: Migrate from OpenAI Realtime to Gemini Live API

### Overview

Complete replacement of OpenAI Realtime API with Google Gemini Multimodal Live API for all real-time voice, text, and audio functionality. This eliminates all OpenAI dependencies and uses Gemini's native bidirectional audio streaming, VAD (voice activity detection), TTS, and STT.

### Key Architectural Differences

```text
CURRENT (OpenAI Realtime)                    NEW (Gemini Live API)
─────────────────────────                    ─────────────────────
wss://api.openai.com/v1/realtime             wss://generativelanguage.googleapis.com/ws/...BidiGenerateContent
Auth: WebSocket subprotocol headers           Auth: ?key=API_KEY in URL
session.created → session.update              { setup: {...} } → setupComplete
input_audio_buffer.append (24kHz PCM16)       realtimeInput.audio (16kHz PCM16)
response.audio.delta (24kHz PCM16 out)        serverContent.modelTurn.parts[].inlineData (24kHz PCM16 out)
response.audio_transcript.delta               serverContent.outputTranscription.text
conversation.item.input_audio_transcription   serverContent.inputTranscription.text
server_vad (turn_detection)                   automaticActivityDetection (built-in)
Voices: shimmer, nova, echo, onyx, alloy      Voices: Kore, Aoede, Puck, Charon, Leda
```

### Secret Required

A **GEMINI_API_KEY** (Google AI API key from aistudio.google.com) must be added as a backend secret. The existing OPENAI_API_KEY will no longer be used by this function.

### Voice Mapping

| Teacher | OpenAI Voice | Gemini Voice | Rationale |
|---------|-------------|-------------|-----------|
| Lina    | shimmer     | Kore        | Warm, nurturing female |
| Zahra   | nova        | Aoede       | Articulate, professional female |
| Hank    | echo        | Puck        | Energetic male |
| Mark    | onyx        | Charon      | Deep, confident male |
| Kate    | alloy       | Leda        | Creative, empathetic female |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/realtime-chat/index.ts` | Complete rewrite: proxy to Gemini Live API instead of OpenAI. Auth via GEMINI_API_KEY. Different WebSocket URL, no subprotocol auth. Forward setup message with model/voice/instructions, relay audio/text bidirectionally. Handle `goAway` for graceful reconnect. |
| `src/hooks/useRealtimeChat.ts` | Complete rewrite of message handling. Replace all OpenAI event types (`session.created`, `response.audio.delta`, etc.) with Gemini events (`setupComplete`, `serverContent`, `inputTranscription`, `outputTranscription`, `turnComplete`, `interrupted`). Change audio input format from 24kHz to 16kHz. Send audio via `realtimeInput.audio` instead of `input_audio_buffer.append`. Send text via `clientContent.turns` instead of `conversation.item.create`. Images via `realtimeInput` or `clientContent`. Setup message includes model, voice, system instruction. |
| `src/lib/teachers.ts` | Replace `OpenAIVoice` type with `GeminiVoice`. Change voice values to Gemini voices (Kore, Aoede, Puck, Charon, Leda). Rename `openaiVoice` field to `geminiVoice`. |
| `src/lib/audioUtils.ts` | Change `TARGET_SAMPLE_RATE` from 24000 to 16000 (Gemini input is 16kHz). |
| `src/pages/Index.tsx` | Update `openaiVoice` references to `geminiVoice`. |
| `supabase/config.toml` | No change needed (realtime-chat already has verify_jwt = false). |

### Audio Pipeline Change

- **Input**: Mic → 16kHz PCM16 (was 24kHz) → base64 → `{ realtimeInput: { audio: { data, mimeType: "audio/pcm;rate=16000" } } }`
- **Output**: Gemini sends 24kHz PCM16 in `serverContent.modelTurn.parts[].inlineData.data` → decode base64 → resample 24kHz→16kHz → Simli lip-sync (same as before for output)

### What Gets Removed

- All OpenAI-specific event handling (30+ event types)
- OpenAI WebSocket subprotocol authentication
- Whisper-1 STT references (Gemini has built-in transcription)
- ElevenLabs TTS pipeline (Gemini provides native TTS audio; ElevenLabs edge function stays but won't be called)
- OpenAI heartbeat/keepalive logic (Gemini has different session management with `goAway`)

### Session Management

Gemini Live API sends a `goAway` message with `timeLeft` before disconnecting. This replaces the current proactive reconnect timer (85s warning, 110s reconnect). The proxy will forward `goAway` to the client, and the client will initiate reconnection based on that signal.

