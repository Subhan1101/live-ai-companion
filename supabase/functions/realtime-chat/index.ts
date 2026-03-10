import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_MODEL = "gemini-2.0-flash-exp";

const getGeminiApiKey = () => {
  const raw = Deno.env.get("GEMINI_API_KEY") ?? "";
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
};

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  console.log("Gemini Live proxy starting", { keyLength: apiKey.length });

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let geminiSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    console.log("Client connected, establishing connection to Gemini Live API...");

    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    geminiSocket = new WebSocket(geminiUrl);

    geminiSocket.onopen = () => {
      console.log("Connected to Gemini Live API");
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: "proxy.gemini_connected" }));
      }
    };

    geminiSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        // Forward raw Gemini messages to client
        clientSocket.send(event.data);
      }
    };

    geminiSocket.onerror = (error) => {
      console.error("Gemini WebSocket error:", error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({
            type: "proxy.error",
            message: "Gemini websocket error",
          })
        );
      }
    };

    geminiSocket.onclose = (event) => {
      console.log("Gemini connection closed:", event.code, event.reason);

      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({
            type: "proxy.gemini_closed",
            code: event.code,
            reason: event.reason,
          })
        );
        clientSocket.close();
      }
    };
  };

  clientSocket.onmessage = (event) => {
    // Forward client messages to Gemini
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(event.data);
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  clientSocket.onclose = () => {
    console.log("Client disconnected");
    if (geminiSocket) {
      geminiSocket.close();
      geminiSocket = null;
    }
  };

  return response;
});
