

# Fix: Session Timeout at 3 Minutes

## Problem Analysis

The session is automatically ending after approximately 3 minutes and 18 seconds. This is caused by **Supabase Edge Function wall-clock limits**:

| Plan | Maximum Duration |
|------|-----------------|
| Free | 150 seconds (2.5 min) |
| Paid | 400 seconds (6.67 min) |

The OpenAI Realtime API itself supports up to **60 minutes**, but the Supabase Edge Function proxy that connects your app to OpenAI has a hard timeout limit.

---

## Solution Strategy

Since we cannot extend Supabase's hard limit, we need a **seamless automatic reconnection system** that:

1. Detects when the connection drops (due to timeout or any reason)
2. Automatically reconnects without user intervention
3. Preserves conversation history across reconnections
4. Shows a brief status indicator during reconnection
5. Optionally warns the user before timeout to save context

---

## Implementation Plan

### Part 1: Configure Edge Runtime for WebSockets

**File: `supabase/config.toml`**

Add the `per_worker` policy to help WebSocket connections stay alive longer within the limits:

```toml
[edge_runtime]
policy = "per_worker"
```

This policy prevents the Edge Function from being terminated immediately after the WebSocket upgrade response is sent.

---

### Part 2: Implement Automatic Reconnection

**File: `src/hooks/useRealtimeChat.ts`**

Add the following features:

1. **Reconnection State Variables**:
   - `reconnectAttempts` counter
   - `isReconnecting` flag
   - `lastDisconnectTime` timestamp
   - `connectionSessionId` to track sessions

2. **Auto-Reconnect Logic**:
   - When `proxy.openai_closed` or WebSocket `onclose` is detected, trigger reconnection
   - Use exponential backoff: 1s, 2s, 4s (max 3 attempts)
   - Preserve messages array during reconnection

3. **Timeout Warning System**:
   - Track connection time with `connectionStartTime`
   - Warn user at 2 minutes ("Session will refresh in 30 seconds")
   - Auto-reconnect before timeout hits (proactive reconnection)

4. **Connection Health Monitor**:
   - Detect if heartbeats are failing
   - Trigger reconnection if connection becomes unhealthy

---

### Part 3: Update UI for Reconnection Status

**File: `src/pages/Index.tsx`**

Add:
- New `isReconnecting` state from the hook
- Update connection status indicator to show "Reconnecting..." 
- Brief overlay/toast during reconnection

**File: `src/components/ControlBar.tsx` (or status indicator)**

Update the connection status display to show three states:
- Connected (green)
- Connecting... (gray/pulsing)
- Reconnecting... (orange/pulsing)

---

## Technical Details

### Auto-Reconnect Flow

```text
Connection Timeline:
[0:00]     Connected, session starts
[2:00]     Warning toast: "Session refreshing soon..."
[2:20]     Proactive reconnection initiated (before 2:30 timeout)
           - Connection marked as "reconnecting"
           - New WebSocket opened
           - Old WebSocket closed
           - Messages preserved
[2:22]     New session connected
           - Status back to "connected"
           - User can continue seamlessly
[4:20]     Next proactive reconnection...
```

### useRealtimeChat.ts Changes

```typescript
// New state
const [isReconnecting, setIsReconnecting] = useState(false);
const reconnectAttemptsRef = useRef(0);
const connectionStartTimeRef = useRef<number | null>(null);
const proactiveReconnectTimeoutRef = useRef<number | null>(null);

// Connection time constants
const SESSION_WARNING_TIME = 120000; // 2 minutes - warn user
const PROACTIVE_RECONNECT_TIME = 140000; // 2:20 - reconnect before timeout
const MAX_RECONNECT_ATTEMPTS = 5;

// Schedule proactive reconnection (call after session.updated)
const scheduleProactiveReconnect = useCallback(() => {
  connectionStartTimeRef.current = Date.now();
  
  // Clear any existing timeout
  if (proactiveReconnectTimeoutRef.current) {
    clearTimeout(proactiveReconnectTimeoutRef.current);
  }
  
  // Warning at 2 minutes
  setTimeout(() => {
    toast({
      title: "Session refreshing soon",
      description: "Connection will seamlessly refresh in 20 seconds.",
    });
  }, SESSION_WARNING_TIME);
  
  // Proactive reconnect at 2:20
  proactiveReconnectTimeoutRef.current = window.setTimeout(() => {
    console.log("Proactive reconnection triggered");
    reconnect();
  }, PROACTIVE_RECONNECT_TIME);
}, []);

// Reconnect function (separate from connect)
const reconnect = useCallback(async () => {
  if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
    toast({
      title: "Connection Lost",
      description: "Unable to maintain connection. Please click 'Call' to reconnect.",
      variant: "destructive",
    });
    return;
  }

  setIsReconnecting(true);
  reconnectAttemptsRef.current++;

  // Close existing connection gracefully
  if (wsRef.current) {
    wsRef.current.close();
    wsRef.current = null;
  }

  // Brief delay before reconnecting
  await new Promise(resolve => setTimeout(resolve, 500));

  // Reconnect
  await connect();
  setIsReconnecting(false);
  reconnectAttemptsRef.current = 0;
  
  toast({
    title: "Connected",
    description: "Session refreshed successfully.",
  });
}, [connect]);

// Add to onclose handler
ws.onclose = (event) => {
  // ... existing code ...
  
  // Auto-reconnect if not a manual disconnect
  if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 8000);
    setTimeout(() => reconnect(), delay);
  }
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add `[edge_runtime]` with `policy = "per_worker"` |
| `src/hooks/useRealtimeChat.ts` | Add auto-reconnect logic, proactive reconnection, health monitoring |
| `src/pages/Index.tsx` | Add `isReconnecting` state handling, update connection status |

---

## Expected Behavior After Fix

1. **Session starts**: Timer begins, proactive reconnect scheduled for 2:20
2. **At 2 minutes**: Toast notification warns user of upcoming refresh
3. **At 2:20**: Automatic seamless reconnection (before 2:30 limit)
4. **User experience**: Nearly invisible - maybe a brief "Reconnecting..." indicator
5. **If unexpected disconnect**: Automatic retry with exponential backoff
6. **After 5 failed attempts**: Manual reconnect required (with clear message)

---

## Limitations

- There will be a brief (~1-2 second) gap during reconnection where messages cannot be sent
- If user is mid-speech during reconnection, that audio may be lost
- The 60-minute OpenAI limit still applies (but we'll be well under that)
- Conversation context on OpenAI side resets each reconnection (messages remain in UI)

---

## Alternative Approaches Considered

1. **WebRTC instead of WebSocket**: OpenAI Realtime API supports WebRTC which might have different timeout characteristics, but requires significant architecture change
2. **Different hosting for proxy**: Could host the relay server on a platform without timeout limits (e.g., dedicated server, Railway, Render), but adds complexity
3. **Accept limitation and just reconnect faster**: Current approach - work within Supabase limits with seamless auto-reconnect

