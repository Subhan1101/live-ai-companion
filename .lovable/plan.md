

## Fix Plan: Connection Stability, Whiteboard Popup, and BSL Issues

### Issue 1: Connection Lost After ~1.5 Minutes

**Root Cause**: The proactive reconnect timer is set to 90 seconds (`PROACTIVE_RECONNECT_TIME = 90000`), and the `connectInternal` function has a **stale closure bug**. It's defined with `useCallback` but its dependency array only includes `[scheduleProactiveReconnect]` -- it does NOT include `teacherVoice` or `teacherInstructions`. This means:

1. When the 90-second proactive reconnect fires, it calls `connectInternal()` which creates a new WebSocket
2. The new session sends `session.update` with potentially stale/undefined voice and instructions values
3. During reconnect, the microphone recorder is destroyed but may not be properly restarted
4. The reconnect can fail silently, leaving the user disconnected

**Fix**:
- Add `teacherVoice` and `teacherInstructions` to the `connectInternal` dependency array (and cascading refs for `performReconnect`)
- Better approach: store `teacherVoice` and `teacherInstructions` in refs so the reconnect closure always has the latest values
- After successful reconnect, automatically restart the microphone recording if it was active before
- Increase `PROACTIVE_RECONNECT_TIME` slightly (e.g., 110 seconds) to give more usable time per session while still staying under the ~120s backend limit

### Issue 2: Duplicate Variable Declaration (Build Error)

**Root Cause**: Console shows `SyntaxError: Identifier 'selectedTeacher' has already been declared` in `Index.tsx`. Line 50 has a comment `// selectedTeacher state is declared above (before useRealtimeChat)` which suggests there was previously a duplicate declaration that may have been left behind. This needs to be verified and the duplicate removed if present. This error prevents the page from hot-reloading properly.

**Fix**:
- Remove line 50 (the stale comment about `selectedTeacher`) -- the actual state is on line 17
- Verify no duplicate `const selectedTeacher` exists

### Issue 3: Whiteboard Popup Not Working

**Root Cause**: The whiteboard button only appears when `hasWhiteboardContent(raw)` returns `true`, which requires the AI response to contain specific markers like `[WHITEBOARD_START]`, math expressions (`$$`), or step patterns. Two problems:

1. The `originalContent` field (which preserves whiteboard markers before they're stripped) is only set in the `response.audio_transcript.done` handler. If the response doesn't trigger that exact event flow, `originalContent` may never be set.
2. The AI system prompt instructs whiteboard usage, but after the per-teacher prompt change, the new teacher prompts may not include the whiteboard formatting instructions consistently.

**Fix**:
- Ensure all teacher system prompts include clear whiteboard formatting instructions (the shared teaching framework already has this, but verify it's being used)
- Add a fallback: also check the `content` field (not just `originalContent`) for whiteboard markers when the button visibility is determined -- this is already done (`message.originalContent ?? message.content`), so the issue is more likely that the AI is not generating whiteboard-formatted responses
- Add logging to debug whiteboard detection during streaming

### Issue 4: BSL Intermittent Failures

**Root Cause**: The BSL script loading uses `document.querySelector` to check if the script is already loaded. If the script tag exists but the global `window.Hands` is not yet defined (race condition), or if the script was removed during a hot-reload, the detection silently fails.

**Fix**:
- Change the "already loaded" check to also verify `window.Hands` exists, not just the script tag
- Add a retry mechanism if `window.Hands` is undefined even after the script tag is found

---

### Technical Changes

**File: `src/hooks/useRealtimeChat.ts`**
1. Add refs for `teacherVoice` and `teacherInstructions` to avoid stale closures:
   - `const teacherVoiceRef = useRef(teacherVoice)` 
   - `const teacherInstructionsRef = useRef(teacherInstructions)`
   - Update these refs in a `useEffect` whenever the props change
   - Use `teacherVoiceRef.current` and `teacherInstructionsRef.current` inside `connectInternal` instead of the raw parameters
2. After successful reconnect in `performReconnect`, restart recording if `wasListening` was true
3. Increase `PROACTIVE_RECONNECT_TIME` to 110000 (110 seconds)

**File: `src/pages/Index.tsx`**
1. Remove line 50 (stale comment about selectedTeacher)

**File: `src/hooks/useBSLRecognition.ts`**
1. Update `loadScript` to also check `(window as any).Hands` before skipping load:
   ```
   if (document.querySelector(`script[src="${src}"]`) && (window as any).Hands) {
     resolve();
     return;
   }
   ```

