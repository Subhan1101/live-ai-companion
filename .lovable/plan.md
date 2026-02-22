

## Plan: ElevenLabs Voices, Auto-Greeting, and BSL Output Fix

### 1. Add ElevenLabs Voice IDs to Teacher Config

**File: `src/lib/teachers.ts`**

- Add `elevenLabsVoiceId` field to the `Teacher` interface
- Set each teacher's voice ID:
  - Lina: `9BWtsMINqrJLrRacOk9x`
  - Zahra: `OYTbf65OHHFELVut7v2H`
  - Hank: `ewxUvnyvvOehYjKjUVKC`
  - Mark: `qy3uP381xz2uje6kNLCG`
  - Kate: `EIsgvJT3rwoPvRFG6c4n`

### 2. Update ElevenLabs TTS Edge Functions to Accept Dynamic Voice ID

**Files: `supabase/functions/elevenlabs-tts/index.ts` and `supabase/functions/elevenlabs-tts-stream/index.ts`**

- Currently both functions hardcode the Lily voice ID (`pFZP5JQG7iQjIQuC4Bku`)
- Change to accept `voiceId` from the request body, falling back to Lily if not provided
- This allows each teacher to speak with their own ElevenLabs voice

### 3. Auto-Greeting When Session Connects

**File: `src/hooks/useRealtimeChat.ts`**

- After `session.updated` is received (session is fully configured), automatically send a greeting prompt to the AI
- Send a `conversation.item.create` with a hidden user message like: "You just connected with a student. Give a brief, warm greeting introducing yourself by name and asking how you can help today. Keep it to 2-3 sentences."
- Follow with `response.create` to trigger the AI to speak the greeting
- This ensures each teacher introduces themselves naturally on connection

### 4. Fix BSL Output Overlay (Currently Only Showing Input)

**File: `src/components/VideoPanel.tsx`**

- Currently the BSL toggle on the ControlBar enables BSL mode, which shows the BSL input overlay (camera hand tracking) on the VideoPanel
- The BSL output overlay (`BSLOverlay` component) should also be shown, displaying sign-by-sign translation of the teacher's responses
- The `BSLOverlay` is already imported and rendered in `VideoPanel.tsx` but may be hidden when input mode takes over
- Ensure both overlays can coexist: the BSL output overlay shows the teacher's response signs, while the BSL input overlay handles camera-based sign detection
- Check the conditional rendering logic to make sure `BSLOverlay` (output) is visible when `isBSLEnabled` is true and there is `bslText` content

### 5. Fix Remaining "Aria" References

**File: `src/pages/Index.tsx`**

- Lines 185, 193, 211, etc. still reference "Aria" in toast messages for screen sharing and file upload
- Replace all "Aria" references with the dynamic teacher name (`selectedTeacher.name`)

---

### Technical Details

**Teacher config change:**
```text
// New field in Teacher interface
elevenLabsVoiceId: string;
```

**Edge function change (both TTS functions):**
```text
// Accept voiceId from request body
const { text, voiceId } = await req.json();
const VOICE_ID = voiceId || "pFZP5JQG7iQjIQuC4Bku"; // fallback to Lily
```

**Auto-greeting (useRealtimeChat.ts):**
After `session.updated` case, send a conversation item to trigger the teacher's self-introduction. The teacher's system prompt already contains their greeting text, so a simple nudge message will make them greet naturally.

**BSL output fix (VideoPanel.tsx):**
Verify that `BSLOverlay` renders when `isBSLEnabled && bslText` is present, ensuring the output signs are displayed alongside (not replaced by) the input overlay.

### Files to Change

| File | Change |
|------|--------|
| `src/lib/teachers.ts` | Add `elevenLabsVoiceId` to interface and all 5 teachers |
| `supabase/functions/elevenlabs-tts/index.ts` | Accept dynamic `voiceId` from request |
| `supabase/functions/elevenlabs-tts-stream/index.ts` | Accept dynamic `voiceId` from request |
| `src/hooks/useRealtimeChat.ts` | Auto-send greeting after session.updated |
| `src/components/VideoPanel.tsx` | Fix BSL output overlay visibility |
| `src/pages/Index.tsx` | Replace remaining "Aria" references with teacher name |
