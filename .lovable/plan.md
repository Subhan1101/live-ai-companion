

# Fix Plan: Avatar Not Loading & Voice Commands Not Working

## Problem Analysis

Based on my investigation of console logs, edge function logs, and code analysis, I've identified **three interconnected issues**:

### Issue 1: Microphone Permission Denied
The console logs show repeated errors:
```
NotAllowedError: Permission denied
Error accessing microphone
Failed to start auto-listening
```

**Root Cause:** The app tries to auto-start the microphone immediately after WebSocket connection, but browsers require a user gesture (click) before granting microphone permissions. The current flow violates this browser security policy.

### Issue 2: Avatar Loading Successfully (NOT broken)
Looking at the network logs, the Simli avatar is actually initializing correctly:
- `POST /simli-token` → 200 OK
- `POST /startAudioToVideoSession` → 200 OK with valid session token

The avatar itself is loading fine. The issue is that without microphone access, there's no audio flowing to the system, making it appear broken.

### Issue 3: WebSocket Connections Are Working
Edge function logs show successful connections to OpenAI:
```
Client connected, establishing connection to OpenAI...
Connected to OpenAI Realtime API
Keepalive ping sent to OpenAI (repeating every 6-12 seconds)
```

The WebSocket proxy is functioning correctly. The problem is purely on the client-side microphone initialization.

---

## Root Cause Summary

The system works in this order:
1. Page loads → Auto-connects WebSocket (OK)
2. WebSocket connects → Sends session configuration (OK)
3. Session configured → **Auto-starts microphone WITHOUT user click** (FAILS)
4. Microphone denied → No audio sent → Avatar sits idle

---

## Solution

Remove the automatic microphone start and require a user gesture (button click) to enable the microphone. This follows browser security requirements and provides a better user experience.

### Technical Details

**File: `src/hooks/useRealtimeChat.ts`**

1. **Remove auto-listen trigger after session.updated**
   - Currently, when the session is configured, it immediately calls `startAutoListening()`
   - Change: Wait for user to click the microphone button instead

2. **Update session.updated handler** (around lines 490-510)
   - Remove the automatic call to `startAutoListening()` and `scheduleProactiveReconnect()`
   - Only schedule the proactive reconnect timer

**File: `src/pages/Index.tsx`**

3. **Show a clear "Click to enable microphone" indicator**
   - When connected but not recording, show a prompt to click the mic button
   - The existing `handleToggleMic` function already handles starting the recording on click

4. **Add toast notification on connection**
   - Inform user they need to click the microphone button to start speaking

---

## Step-by-Step Changes

### Step 1: Stop Auto-Starting Microphone
In `useRealtimeChat.ts`, locate the `session.updated` case handler and remove the call to `startAutoListening()`.

**Current code (around line 500):**
```typescript
case "session.updated":
  console.log("Session updated with our configuration");
  // Schedule proactive reconnect after session is configured
  scheduleProactiveReconnect();
  // Start heartbeat
  heartbeatIntervalRef.current = window.setInterval(...);
  // Auto-start listening after session configured
  startAutoListening(); // ← REMOVE THIS
  break;
```

**New code:**
```typescript
case "session.updated":
  console.log("Session updated with our configuration");
  // Schedule proactive reconnect after session is configured
  scheduleProactiveReconnect();
  // Start heartbeat
  heartbeatIntervalRef.current = window.setInterval(...);
  // Note: Microphone will be started when user clicks the mic button
  // This is required by browser security policies
  console.log("Ready for voice input - user must click microphone to enable");
  break;
```

### Step 2: Update Connection Success Toast
In `Index.tsx`, update the toast shown when connecting to prompt user action.

**Current code:**
```typescript
connect();
toast({
  title: "Calling...",
  description: "Connecting to Aria.",
});
```

**Enhanced:** After successful connection, show a toast prompting microphone action. This can be done by adding an effect that watches `isConnected` state.

### Step 3: Add Visual Microphone Prompt
In `Index.tsx`, when connected but not recording, display a visual indicator near the control bar or overlay prompting the user to click the microphone.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Remove `startAutoListening()` call from `session.updated` handler |
| `src/pages/Index.tsx` | Add effect to show toast prompting user to click microphone after connection |
| `src/pages/Index.tsx` | Add visual "Click mic to talk" indicator when connected but not recording |

---

## Expected Behavior After Fix

1. User opens page → WebSocket connects automatically
2. Avatar loads and displays "Say something!" status
3. Toast appears: "Connected! Click the microphone to start talking"
4. User clicks microphone button → Browser shows permission prompt
5. User grants permission → Microphone activates, voice commands work
6. User speaks → AI responds with voice and avatar lip-sync

---

## Why This Will Work

- Browsers universally require user gestures for microphone access
- The existing `handleToggleMic()` in Index.tsx is already designed to handle this flow
- The existing `startRecording()` function works correctly when called from a click handler
- The WebSocket and Simli avatar systems are already working correctly

