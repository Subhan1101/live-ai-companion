export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

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

    // Connect to OpenAI Realtime API
    const openaiUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
    const openaiWs = new WebSocket(openaiUrl, [
      "realtime",
      `openai-insecure-api-key.${apiKey}`,
      "openai-beta.realtime-v1",
    ]);

    // Accept client connection
    server.accept();

    let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

    openaiWs.addEventListener("open", () => {
      console.log("Connected to OpenAI Realtime API");
      
      if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({ type: "proxy.openai_connected" }));
      }

      // Keepalive ping every 25 seconds to prevent idle disconnect
      keepaliveInterval = setInterval(() => {
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: "AA==", // 1 sample of silence
            })
          );
        }
      }, 25000);
    });

    openaiWs.addEventListener("message", (event) => {
      // Forward OpenAI messages to client
      if (server.readyState === WebSocket.OPEN) {
        server.send(event.data);
      }
    });

    openaiWs.addEventListener("close", (event) => {
      console.log("OpenAI connection closed:", event.code, event.reason);

      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }

      if (server.readyState === WebSocket.OPEN) {
        // Surface auth failures explicitly
        const reason = String(event.reason ?? "");
        const looksLikeInvalidKey =
          event.code === 3000 && reason.toLowerCase().includes("invalid_api_key");

        if (looksLikeInvalidKey) {
          server.send(
            JSON.stringify({
              type: "proxy.error",
              message: "OpenAI rejected the API key (invalid or missing Realtime access)",
              code: event.code,
              reason: event.reason,
            })
          );
        }

        server.send(
          JSON.stringify({
            type: "proxy.openai_closed",
            code: event.code,
            reason: event.reason,
          })
        );
        server.close();
      }
    });

    openaiWs.addEventListener("error", () => {
      console.error("OpenAI WebSocket error");
      if (server.readyState === WebSocket.OPEN) {
        server.send(
          JSON.stringify({
            type: "proxy.error",
            message: "OpenAI connection error",
          })
        );
      }
    });

    // Forward client messages to OpenAI
    server.addEventListener("message", (event) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(event.data);
      }
    });

    server.addEventListener("close", () => {
      console.log("Client disconnected");
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
      openaiWs.close();
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

interface Env {
  OPENAI_API_KEY: string;
}
