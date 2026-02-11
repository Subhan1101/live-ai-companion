

# Plan: Fix Avatar Disappearing During Session Refresh

## Root Cause Analysis

After examining the edge function logs and the reconnection code, I identified a **timing race condition**:

### What's Happening

1. The backend function has a wall-clock timeout of approximately **120 seconds** (Supabase limit)
2. Your proactive reconnect timer is set to **140 seconds** (2 minutes 20 seconds)
3. The backend dies BEFORE your proactive reconnect fires
4. This causes an **unplanned disconnect** that resets `isConnected` to `false`, which tears down the avatar

### Timeline of the Bug

```text
0s        Connect to backend
~12s      Keepalive pings start (every 12s in edge function)
~100s     Still connected, pings working
~110-120s Backend function killed by platform timeout
          --> proxy.openai_closed message sent to client
          --> Client sees isReconnectingRef = false (proactive reconnect hasn't fired yet!)
          --> Client sets isConnected = false
          --> Avatar unmounts, shows "Teacher is coming..."
          --> "Reconnecting..." badge appears
140s      Proactive reconnect timer fires (TOO LATE - connection already dead)
```

### Evidence from Logs

The edge function logs show connections lasting only about 90-120 seconds before "shutdown" and "OpenAI connection closed: 1005" appear, well before the 140-second proactive reconnect.

---

## The Fix (3 Changes)

### 1. Reduce Proactive Reconnect Time

Change `PROACTIVE_RECONNECT_TIME` from 140 seconds to **90 seconds**, and the warning time to **70 seconds**. This ensures the client reconnects well BEFORE the backend times out.

**File:** `src/hooks/useRealtimeChat.ts`

| Constant | Current | New |
|----------|---------|-----|
| `SESSION_WARNING_TIME` | 120,000ms (2 min) | 70,000ms (1 min 10s) |
| `PROACTIVE_RECONNECT_TIME` | 140,000ms (2 min 20s) | 90,000ms (1 min 30s) |

### 2. Set Reconnecting Flag Earlier

Currently `isReconnectingRef.current` is only set to `true` inside `performReconnect()`. If the backend dies before that function runs, the `proxy.openai_closed` handler sees it as `false` and tears everything down.

The fix: set `isReconnectingRef.current = true` at the **warning time** (70s), so that if the backend dies between 70-90 seconds, the handler knows a reconnect is planned and won't reset the connection state.

### 3. Guard Against Race in proxy.openai_closed

Add an additional safety check: if a proactive reconnect timer is still pending (not null), treat the close as a planned event even if `isReconnectingRef.current` hasn't been set yet. This double-guards against the race condition.

---

## Expected Behavior After Fix

```text
0s     Connect
70s    Warning: "Session refreshing soon" + set isReconnecting = true
90s    Proactive reconnect fires (backend still alive at this point)
       --> Old connection closed gracefully
       --> New connection opened
       --> Avatar stays visible throughout
       --> isReconnecting reset to false
90s+   New session starts, timer resets
```

The avatar will remain visible at all times because the reconnect happens while the backend is still alive, not after it dies.

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useRealtimeChat.ts` | Reduce timeout constants, set reconnecting flag earlier, add race-condition guard |

### No Edge Function Changes Needed

The edge function itself is working correctly - it's the Supabase platform that enforces the timeout. The fix is entirely on the client side by reconnecting sooner.

