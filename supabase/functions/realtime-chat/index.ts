import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Use a GA Realtime model by default (the old 2024-10-01 snapshot is deprecated)
const OPENAI_REALTIME_MODEL = Deno.env.get("OPENAI_REALTIME_MODEL") ?? "gpt-realtime";
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`;

serve(async (req) => {
  // Handle WebSocket upgrade
  const upgrade = req.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let openaiSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    console.log("Client connected, establishing connection to OpenAI...");

    // Connect to OpenAI Realtime API
    openaiSocket = new WebSocket(OPENAI_REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1",
    ]);

    openaiSocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API", { model: OPENAI_REALTIME_MODEL });
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({ type: "proxy.openai_connected", model: OPENAI_REALTIME_MODEL })
        );
      }
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
          JSON.stringify({ type: "proxy.error", message: "OpenAI websocket error" })
        );
      }
    };

    openaiSocket.onclose = (event) => {
      console.log("OpenAI connection closed:", event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({
            type: "proxy.openai_closed",
            code: event.code,
            reason: event.reason,
            model: OPENAI_REALTIME_MODEL,
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
    if (openaiSocket) {
      openaiSocket.close();
      openaiSocket = null;
    }
  };

  return response;
});