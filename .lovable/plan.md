
# Migration Plan: Supabase → Cloudflare Workers for WebSocket Proxy

## Overview

This plan migrates the WebSocket proxy from Supabase Edge Functions (with 150s timeout) to Cloudflare Workers (with **no WebSocket timeout limit**), enabling unlimited session duration for your BSL teaching application.

---

## What Changes

| Component | Current | After Migration |
|-----------|---------|-----------------|
| WebSocket Proxy | Supabase Edge Function | Cloudflare Worker |
| Session Limit | ~2.5 minutes (proactive reconnect) | Unlimited (up to OpenAI's 60 min) |
| Auto-reconnect | Required every 2:20 | Only on network issues |
| API Key Location | Supabase Secrets | Cloudflare Worker Secrets |
| Cost | Included in Lovable | Cloudflare Free Tier (100k req/day) |

---

## Architecture After Migration

```text
┌─────────────────┐    WebSocket    ┌────────────────────┐    WebSocket    ┌─────────────────┐
│                 │ ──────────────► │                    │ ──────────────► │                 │
│  React App      │                 │  Cloudflare Worker │                 │  OpenAI         │
│  (Browser)      │ ◄────────────── │  (Your Proxy)      │ ◄────────────── │  Realtime API   │
│                 │                 │                    │                 │                 │
└─────────────────┘                 └────────────────────┘                 └─────────────────┘
                                           │
                                    No timeout limit!
                                    Runs indefinitely
```

---

## Step-by-Step Implementation

### Step 1: Create Cloudflare Worker Project

You'll need to:
1. Create a free Cloudflare account at workers.cloudflare.com
2. Install Wrangler CLI: `npm install -g wrangler`
3. Login: `wrangler login`
4. Create new worker: `wrangler init openai-realtime-proxy`

### Step 2: Create Cloudflare Worker Code

Create a new file `cloudflare-worker/src/index.ts`:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response("API key not configured", { status: 500 });
    }

    // Create WebSocket pair for client
    const [client, server] = Object.values(new WebSocketPair());

    // Connect to OpenAI
    const openaiUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
    const openaiWs = new WebSocket(openaiUrl, [
      "realtime",
      `openai-insecure-api-key.${apiKey}`,
      "openai-beta.realtime-v1",
    ]);

    // Handle OpenAI connection
    server.accept();
    
    openaiWs.addEventListener("open", () => {
      server.send(JSON.stringify({ type: "proxy.openai_connected" }));
      
      // Keepalive every 25 seconds
      setInterval(() => {
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: "AA=="
          }));
        }
      }, 25000);
    });

    openaiWs.addEventListener("message", (event) => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(event.data);
      }
    });

    openaiWs.addEventListener("close", (event) => {
      server.send(JSON.stringify({
        type: "proxy.openai_closed",
        code: event.code,
        reason: event.reason,
      }));
      server.close();
    });

    openaiWs.addEventListener("error", () => {
      server.send(JSON.stringify({
        type: "proxy.error",
        message: "OpenAI connection error",
      }));
    });

    // Forward client messages to OpenAI
    server.addEventListener("message", (event) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(event.data);
      }
    });

    server.addEventListener("close", () => {
      openaiWs.close();
    });

    return new Response(null, { status: 101, webSocket: client });
  },
};

interface Env {
  OPENAI_API_KEY: string;
}
```

### Step 3: Configure Cloudflare Worker

Create `cloudflare-worker/wrangler.toml`:

```toml
name = "eduguide-realtime-proxy"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Enable Durable Objects for WebSocket handling
[durable_objects]
bindings = []
```

### Step 4: Add API Key to Cloudflare

Run this command to securely add your OpenAI API key:

```bash
wrangler secret put OPENAI_API_KEY
# Then paste your API key when prompted
```

### Step 5: Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

This gives you a URL like: `wss://eduguide-realtime-proxy.YOUR_SUBDOMAIN.workers.dev`

### Step 6: Update React App

Modify `src/hooks/useRealtimeChat.ts`:

```typescript
// Change line 50 from:
const WEBSOCKET_URL = "wss://jvfvwysvhqpiosvhzhkf.functions.supabase.co/functions/v1/realtime-chat";

// To:
const WEBSOCKET_URL = "wss://eduguide-realtime-proxy.YOUR_SUBDOMAIN.workers.dev";
```

### Step 7: Remove Auto-Reconnect (Simplify)

Since Cloudflare has no timeout, we can remove the proactive reconnection logic:

- Remove `SESSION_WARNING_TIME` constant
- Remove `PROACTIVE_RECONNECT_TIME` constant  
- Remove `scheduleProactiveReconnect` function
- Remove warning toast at 2 minutes
- Keep only the **unexpected disconnect** auto-reconnect (for network issues)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `cloudflare-worker/src/index.ts` | **Create** | Cloudflare Worker proxy code |
| `cloudflare-worker/wrangler.toml` | **Create** | Worker configuration |
| `cloudflare-worker/package.json` | **Create** | Worker dependencies |
| `src/hooks/useRealtimeChat.ts` | **Modify** | Update WebSocket URL, simplify reconnect |
| `supabase/functions/realtime-chat/` | **Optional Delete** | No longer needed |

---

## Cloudflare Free Tier Limits

| Feature | Free Limit |
|---------|------------|
| Requests/day | 100,000 |
| WebSocket connections | Unlimited duration |
| CPU time | 10ms per request (but WebSockets don't count) |
| Data transfer | Unlimited |

For your educational app, the free tier is more than sufficient.

---

## Setup Instructions for User

After I create the Cloudflare Worker code, you'll need to:

1. **Create Cloudflare Account**
   - Go to workers.cloudflare.com
   - Sign up for free

2. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Deploy the Worker**
   ```bash
   cd cloudflare-worker
   wrangler secret put OPENAI_API_KEY  # Enter your key
   wrangler deploy
   ```

4. **Copy Your Worker URL**
   - After deploy, you'll see a URL like `https://eduguide-realtime-proxy.xxx.workers.dev`
   - The WebSocket URL is `wss://` version of this

5. **Update the App**
   - I'll update the React code to use your new Worker URL

---

## Benefits After Migration

1. **No more 3-minute disconnects** - Sessions can run up to 60 minutes (OpenAI limit)
2. **Simpler code** - No proactive reconnection timers needed
3. **Better user experience** - No "Session refreshing..." interruptions
4. **Global edge network** - Cloudflare runs in 200+ cities worldwide
5. **Free** - 100,000 requests/day is plenty for education use

---

## Migration Approach

I recommend a **two-phase approach**:

**Phase 1 (Now)**: Create the Cloudflare Worker files in your project so you can deploy them

**Phase 2 (After you deploy)**: Update the React app to use the new Cloudflare URL

This way, you can test the Cloudflare Worker independently before switching the app.

---

## Summary

This migration eliminates the session timeout problem by moving to Cloudflare Workers, which has no WebSocket duration limits. Your students will be able to have continuous 60-minute learning sessions without any interruptions.
