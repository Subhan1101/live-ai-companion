import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId } = await req.json();
    const HUME_API_KEY = Deno.env.get("HUME_API_KEY");

    if (!HUME_API_KEY) {
      console.error("HUME_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Hume API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "No voiceId provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Streaming Hume TTS:", { voiceId, textLength: text.length });

    // Call Hume AI streaming JSON endpoint
    const response = await fetch("https://api.hume.ai/v0/tts/stream/json", {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": HUME_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "2",
        utterances: [
          {
            text,
            voice: { id: voiceId },
          },
        ],
        format: { type: "pcm", sample_rate: 48000 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hume API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Hume error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "No response body from Hume" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hume streams newline-delimited JSON objects, each with an "audio" field (base64 PCM).
    // We decode and forward raw PCM bytes to the client.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining buffer
            if (buffer.trim().length > 0) {
              try {
                const json = JSON.parse(buffer.trim());
                if (json.audio) {
                  const raw = Uint8Array.from(atob(json.audio), (c) => c.charCodeAt(0));
                  controller.enqueue(raw);
                }
              } catch {
                // ignore partial JSON
              }
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // Split on newlines - each line is a JSON object
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;
            try {
              const json = JSON.parse(trimmed);
              if (json.audio) {
                const raw = Uint8Array.from(atob(json.audio), (c) => c.charCodeAt(0));
                controller.enqueue(raw);
              }
            } catch {
              console.warn("Failed to parse Hume JSON chunk:", trimmed.substring(0, 100));
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/pcm",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: unknown) {
    console.error("Hume TTS stream error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
