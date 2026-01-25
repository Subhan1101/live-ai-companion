import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const getOpenAIApiKey = () => {
  const raw = Deno.env.get("OPENAI_API_KEY") ?? "";
  let key = raw.trim();

  // Common copy/paste mistakes: quotes or "Bearer " prefix
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice("bearer ".length).trim();
  }

  return key;
};

// IMPORTANT: Use the exact Realtime endpoint required by the app
const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";

serve(async (req) => {
  // Handle WebSocket upgrade
  const upgrade = req.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured (or empty after trimming)");
    return new Response("Server configuration error", { status: 500 });
  }

  // Don't log secrets; log only safe metadata
  console.log("Realtime proxy starting", {
    keyLength: apiKey.length,
    looksLikeSk: apiKey.startsWith("sk-"),
  });

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let openaiSocket: WebSocket | null = null;

  let keepaliveInterval: number | null = null;

  clientSocket.onopen = () => {
    console.log("Client connected, establishing connection to OpenAI...");

    // Connect to OpenAI Realtime API
    openaiSocket = new WebSocket(OPENAI_REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${apiKey}`,
      "openai-beta.realtime-v1",
    ]);

    openaiSocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API", { url: OPENAI_REALTIME_URL });
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: "proxy.openai_connected" }));
      }
      
      // Start keepalive ping to OpenAI every 20 seconds
      keepaliveInterval = setInterval(() => {
        if (openaiSocket?.readyState === WebSocket.OPEN) {
          // Send empty audio buffer as keepalive
          openaiSocket.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: ""
          }));
          console.log("Keepalive ping sent to OpenAI");
        }
      }, 20000);
    };

    openaiSocket.onmessage = (event) => {
      // Forward OpenAI messages to client
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    openaiSocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({
            type: "proxy.error",
            message: "OpenAI websocket error",
          })
        );
      }
    };

    openaiSocket.onclose = (event) => {
      console.log("OpenAI connection closed:", event.code, event.reason);

      // Clear keepalive interval
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }

      // Surface common auth failures explicitly to the client
      const reason = String(event.reason ?? "");
      const looksLikeInvalidKey =
        event.code === 3000 && reason.toLowerCase().includes("invalid_api_key");

      if (clientSocket.readyState === WebSocket.OPEN) {
        if (looksLikeInvalidKey) {
          clientSocket.send(
            JSON.stringify({
              type: "proxy.error",
              message: "OpenAI rejected the API key (invalid or missing Realtime access)",
              code: event.code,
              reason: event.reason,
            })
          );
        }

        clientSocket.send(
          JSON.stringify({
            type: "proxy.openai_closed",
            code: event.code,
            reason: event.reason,
          })
        );
        clientSocket.close();
      }
    };
  };

  clientSocket.onmessage = (event) => {
    // Forward client messages to OpenAI
    if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.send(event.data);
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  clientSocket.onclose = () => {
    console.log("Client disconnected");
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
      keepaliveInterval = null;
    }
    if (openaiSocket) {
      openaiSocket.close();
      openaiSocket = null;
    }
  };

  return response;
});