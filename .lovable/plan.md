

## Fix: Gemini Live API Model Name

### Root Cause

The error `models/gemini-2.5-flash-live-preview is not found for API version v1beta, or is not supported for bidiGenerateContent` occurs because **`gemini-2.5-flash-live-preview` is not a valid model name** for the Gemini Live API.

From Google's documentation and model listings, the correct model name for the Live API's `BidiGenerateContent` endpoint is:

**`gemini-live-2.5-flash-preview`** (note: `live` comes after `gemini-`, not at the end)

### Changes

| File | Change |
|------|--------|
| `supabase/functions/realtime-chat/index.ts` (line 3) | Change `"gemini-2.5-flash-live-preview"` → `"gemini-live-2.5-flash-preview"` |
| `src/hooks/useRealtimeChat.ts` | Change the `GEMINI_MODEL` constant to `"gemini-live-2.5-flash-preview"` |

This is a one-line fix in two files. The model name format was simply reversed — Google uses `gemini-live-2.5-flash-preview` for the Live/BidiGenerateContent endpoint.

