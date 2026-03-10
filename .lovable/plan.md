

## Fix: Change Gemini WebSocket API Version from v1beta to v1alpha

### Root Cause

The error `models/gemini-live-2.5-flash-preview is not found for API version v1beta` is explicit — the model exists but is only available on `v1alpha`. Multiple sources confirm that the Gemini Live API's BidiGenerateContent endpoint with newer models requires `v1alpha`.

The WebSocket URL in `supabase/functions/realtime-chat/index.ts` line 38 currently uses:
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
```

It needs to be:
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent
```

### Changes

| File | Line | Change |
|------|------|--------|
| `supabase/functions/realtime-chat/index.ts` | 38 | Change `v1beta` → `v1alpha` in the WebSocket URL |

One-line change in one file. The model name `gemini-live-2.5-flash-preview` is correct — just the API version was wrong.

