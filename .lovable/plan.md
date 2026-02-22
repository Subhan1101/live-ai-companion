

## Plan: Delay Auto-Greeting Until Avatar is Visible

### Problem

When the session connects, the auto-greeting fires immediately after `session.updated`. But the Simli avatar takes several more seconds to initialize (fetch token, start LiveKit session, connect). The result: the teacher's voice greeting plays while the yellow "Teacher is coming..." loading screen is still showing -- no avatar, no lip sync.

### Solution

Defer the auto-greeting until the Simli avatar signals it's ready. The avatar already calls `onSimliReady` when it's fully loaded. We'll use this signal to trigger the greeting.

### Changes

**1. `src/hooks/useRealtimeChat.ts`**

- Add a new function `sendGreeting()` that sends the greeting prompt (the same `conversation.item.create` + `response.create` that currently fires in `session.updated`)
- Remove the greeting logic from inside the `session.updated` handler
- Export `sendGreeting` so the parent component can call it when the avatar is ready
- Add a guard (`hasGreetedRef`) to prevent double-greetings on reconnects

**2. `src/pages/Index.tsx`**

- Import and use the new `sendGreeting` from `useRealtimeChat`
- In `handleSimliReady`, after setting the audio handler, call `sendGreeting()` to trigger the teacher's introduction
- This ensures the greeting only plays after the avatar is visible and lip-syncing

### Sequence After Fix

```text
1. User selects teacher --> connect() called
2. WebSocket opens --> session.update sent
3. session.updated received --> connection ready (NO greeting yet)
4. Simli avatar initializes in parallel (fetch token, start session)
5. Simli avatar ready --> onSimliReady fires --> handleSimliReady called
6. handleSimliReady calls sendGreeting() --> teacher introduces with lip sync
```

### Technical Details

In `useRealtimeChat.ts`, the greeting code currently at lines 463-480 will be moved into a new exported `sendGreeting` function:

```text
const sendGreeting = useCallback(() => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
  if (hasGreetedRef.current) return;
  hasGreetedRef.current = true;

  // Same conversation.item.create + response.create logic
}, []);
```

The `hasGreetedRef` is reset to `false` when a new connection starts (not on reconnect).

In `Index.tsx`, `handleSimliReady` becomes:

```text
const handleSimliReady = useCallback((...) => {
  setSimliAudioHandler(sendAudio, clearBuffer);
  sendGreeting();  // Trigger greeting now that avatar is visible
}, [setSimliAudioHandler, sendGreeting]);
```

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Extract greeting into `sendGreeting()`, export it, remove from `session.updated` |
| `src/pages/Index.tsx` | Call `sendGreeting()` in `handleSimliReady` |
