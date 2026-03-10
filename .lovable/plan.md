

## Plan: Voice-Controlled Teacher Selection + Fix Whiteboard Chat Duplication

### Problem 1: Whiteboard Content Floods the Chat

**Root cause identified**: When OpenAI sends audio responses, the transcript arrives via `response.audio_transcript.delta` events, which stream the FULL text (including `[WHITEBOARD_START]...[WHITEBOARD_END]` content) into the chat bubble character-by-character. The whiteboard cleanup code only runs in `response.text.done` (text-only mode), but audio mode uses `response.audio_transcript.done` which currently does nothing. So the entire explanation stays in chat, then appears again on the whiteboard.

**Fix in `src/hooks/useRealtimeChat.ts`**:
- In `response.audio_transcript.delta`: detect when whiteboard markers start appearing and suppress that content from the chat message. Only show the pre-marker text in the chat bubble.
- In `response.audio_transcript.done`: add the same whiteboard extraction + cleanup logic that exists in `response.text.done` — strip markers from chat, store `originalContent`, and set a short summary like "I've prepared a detailed explanation. Click 'Whiteboard' to view."

### Problem 2: Voice-Controlled Teacher Selection

Add voice navigation to the `TeacherSelect` screen so visually impaired or hands-free users can choose a teacher by speaking.

**New file: `src/hooks/useVoiceNavigation.ts`**
- Use the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for browser-native speech-to-text (no API key needed)
- Listen continuously on the teacher selection screen
- Match recognized text against teacher names ("Lina", "Zahra", "Hank", "Mark", "Kate")
- Return: `{ isListening, transcript, startListening, stopListening }`

**Updated: `src/components/TeacherSelect.tsx`**
- On mount, play a TTS announcement using `SpeechSynthesis` API: "Welcome. You can choose a teacher by saying their name. Available teachers are: Lina for primary foundations, Zahra for English and ethics, Hank for STEM, Mark for business and tech, Kate for humanities and creative arts."
- Use the `useVoiceNavigation` hook to listen for teacher name mentions
- When a name is matched, highlight the card and auto-select after a short delay
- Show a small "Listening..." indicator and the recognized transcript on screen
- Add a microphone button to toggle voice control on/off

### Problem 3: More Natural Teacher Personality

**Updated: `src/lib/teachers.ts`**
- Revise the greeting lines to be warmer and more conversational (e.g., "Hi there! I'm Lina, lovely to meet you! What would you like to learn today?")
- Add to `SHARED_TEACHING_FRAMEWORK`: instructions to ask the student's name at the start and use it naturally throughout the conversation, making interactions feel personal rather than robotic

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Fix whiteboard content in `audio_transcript.delta` and `audio_transcript.done` |
| `src/hooks/useVoiceNavigation.ts` | New hook for Web Speech API voice recognition |
| `src/components/TeacherSelect.tsx` | Add voice-controlled teacher selection with TTS announcement |
| `src/lib/teachers.ts` | Make greetings more natural, add "ask student's name" instruction |

