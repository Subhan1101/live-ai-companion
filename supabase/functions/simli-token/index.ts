import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SIMLI_API_KEY = Deno.env.get("SIMLI_API_KEY");

    if (!SIMLI_API_KEY) {
      console.error("SIMLI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "SIMLI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the API key to the client for SimliClient initialization
    // In a production app, you might want to create a session token instead
    return new Response(
      JSON.stringify({ apiKey: SIMLI_API_KEY }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});