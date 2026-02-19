

## Fix Plan: Connection Stability, Whiteboard Popup, and BSL Reliability

### Issue 1: Connection Lost After ~1.5 Minutes

**Root Cause**: The `performReconnect` and `connectInternal` functions have empty or incomplete dependency arrays in their `useCallback` hooks, which means they capture stale references. Specifically:

- `connectInternal` (line 786) depends only on `[scheduleProactiveReconnect]`
- `performReconnect` (line 310) has an empty dependency array `[]`
- `scheduleProactiveReconnect` (line 231) also has an empty dependency array `[]`

This creates a **circular stale closure chain**: when `performReconnect` calls `connectInternal()`, and then tries to call `startAutoListening()` (line 294), it references the **initial version** of `startAutoListening` from render #1 -- not the current one. The reconnected session may silently fail to restart the microphone.

Additionally, `performReconnect` references `connectInternal` but doesn't include it in its dependency array, so after React re-renders, `performReconnect` still calls the old `connectInternal`.

**Fix**:
- Convert `performReconnect` and `scheduleProactiveReconnect` to use refs for their cross-references, avoiding the circular dependency issue entirely
- Store `startAutoListening` in a ref so `performReconnect` always calls the latest version
- Keep the existing `teacherVoiceRef` and `teacherInstructionsRef` pattern (already implemented)

### Issue 2: Whiteboard Popup Not Working

**Root Cause**: The system prompt tells the AI to give a **brief answer first** and only use whiteboard markers **when the user explicitly asks** ("Would you like me to explain this in more detail on the whiteboard?"). This means:

1. The AI responds with a short 2-4 sentence answer
2. The short answer does NOT contain `[WHITEBOARD_START]` markers
3. `hasWhiteboardContent()` returns `false` because there are no markers, math+steps, or structured headers
4. The Whiteboard button never appears

Even when the user says "yes, show me on the whiteboard", the AI may not consistently use the exact `[WHITEBOARD_START]` marker format -- it might use markdown headers and math without the markers, which may or may not trigger the detection.

**Fix**:
- Update the system prompt to ALWAYS include `[WHITEBOARD_START]...[WHITEBOARD_END]` markers when the user asks for a detailed/whiteboard explanation (reinforce this instruction)
- Relax `hasWhiteboardContent()` detection to also match responses that have `##` headers combined with either math OR numbered steps (currently requires math AND steps together)
- Ensure `originalContent` is ALWAYS preserved on assistant messages (not just when markers are detected), so the whiteboard button can appear even for edge cases

### Issue 3: BSL Intermittent Failures

**Root Cause**: The script loading fix (checking `window.Hands`) is correct but incomplete. There's a race condition: if the script tag exists from a previous load but `window.Hands` is undefined (e.g., script failed silently, or page was hot-reloaded), the code creates a NEW script tag but doesn't remove the old one. The browser may skip executing the second script tag with the same `src`.

**Fix**:
- Before creating a new script tag, remove any existing script tag with the same `src` that didn't produce `window.Hands`
- Add a post-load verification: after script `onload` fires, check that `window.Hands` actually exists, and reject if not
- Add a retry with a small delay if `window.Hands` is not immediately available after script load (some browsers delay global assignment)

---

### Technical Changes

**File: `src/hooks/useRealtimeChat.ts`**

1. Add a ref for `startAutoListening`:
   ```
   const startAutoListeningRef = useRef(startAutoListening);
   useEffect(() => { startAutoListeningRef.current = startAutoListening; }, [startAutoListening]);
   ```

2. In `performReconnect`, replace `startAutoListening()` with `startAutoListeningRef.current()` to avoid stale closure

3. Store `connectInternal` in a ref and use it from `performReconnect`:
   ```
   const connectInternalRef = useRef(connectInternal);
   useEffect(() => { connectInternalRef.current = connectInternal; }, [connectInternal]);
   ```
   Then in `performReconnect`: `await connectInternalRef.current()`

4. Store `performReconnect` in a ref and use it from `scheduleProactiveReconnect`:
   ```
   const performReconnectRef = useRef(performReconnect);
   useEffect(() => { performReconnectRef.current = performReconnect; }, [performReconnect]);
   ```
   Then in `scheduleProactiveReconnect`: `performReconnectRef.current()`

**File: `src/lib/whiteboardParser.ts`**

1. Relax `hasWhiteboardContent` detection -- add a check for `##` headers combined with math OR steps (not requiring both):
   ```
   const hasStructuredContent = hasHeaders && (hasMath || hasSteps || hasNumberedList);
   return (hasMath && hasSteps) || hasKeyPoints || (hasNumberedList && hasHeaders) || hasStructuredContent;
   ```

**File: `src/hooks/useRealtimeChat.ts` (whiteboard fix)**

1. In the `response.audio_transcript.done` handler, always set `originalContent` on the last assistant message (remove the conditional). This ensures the whiteboard button can always check the raw content.

**File: `src/hooks/useBSLRecognition.ts`**

1. In `loadScript`, remove the old script tag if `window.Hands` is not defined:
   ```
   const existingScript = document.querySelector(`script[src="${src}"]`);
   if (existingScript && (window as any).Hands) {
     resolve();
     return;
   }
   if (existingScript) {
     existingScript.remove(); // Remove stale script tag
   }
   ```

2. After `script.onload`, add a verification with retry:
   ```
   script.onload = () => {
     // Verify global was created
     const checkGlobal = (attempts = 0) => {
       if ((window as any).Hands) {
         resolve();
       } else if (attempts < 10) {
         setTimeout(() => checkGlobal(attempts + 1), 100);
       } else {
         reject(new Error('Hands constructor not available after script load'));
       }
     };
     checkGlobal();
   };
   ```

