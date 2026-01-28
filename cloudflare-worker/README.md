# EduGuide Realtime Proxy - Cloudflare Worker

This Cloudflare Worker acts as a WebSocket proxy between your React app and the OpenAI Realtime API, eliminating session timeout limits.

## Why Cloudflare Workers?

- **No WebSocket timeout** - Sessions can run up to 60 minutes (OpenAI's limit)
- **Global edge network** - Low latency from 200+ cities worldwide
- **Free tier** - 100,000 requests/day is plenty for educational apps
- **Secure** - API key stored as encrypted secret, never exposed to clients

## Setup Instructions

### 1. Create Cloudflare Account

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com)
2. Sign up for a free account

### 2. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This opens a browser window for authentication.

### 4. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 5. Add Your OpenAI API Key

```bash
wrangler secret put OPENAI_API_KEY
```

When prompted, paste your OpenAI API key (must have Realtime API access).

### 6. Deploy the Worker

```bash
npm run deploy
# or
wrangler deploy
```

After deployment, you'll see output like:

```
Published eduguide-realtime-proxy (1.23 sec)
  https://eduguide-realtime-proxy.YOUR_SUBDOMAIN.workers.dev
```

### 7. Update the React App

Copy your Worker URL and share it with me. I'll update `src/hooks/useRealtimeChat.ts` to use:

```
wss://eduguide-realtime-proxy.YOUR_SUBDOMAIN.workers.dev
```

## Local Development

Run the worker locally for testing:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`.

## Troubleshooting

### "API key not configured"
Run `wrangler secret put OPENAI_API_KEY` and redeploy.

### "insufficient_quota" error
Your OpenAI account needs active credits for the Realtime API.

### "invalid_api_key" error
Ensure your API key:
- Starts with `sk-`
- Has no extra spaces or quotes
- Has Realtime API access enabled

## Free Tier Limits

| Feature | Limit |
|---------|-------|
| Requests/day | 100,000 |
| WebSocket duration | Unlimited |
| CPU time | 10ms per request |
| Data transfer | Unlimited |

For educational apps, the free tier is more than sufficient.
