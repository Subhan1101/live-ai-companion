/**
 * BSL Video Proxy Edge Function
 * 
 * Proxies video requests to BSL SignBank to handle CORS.
 * Adds caching headers for better performance.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Allowed domains for proxying
const ALLOWED_DOMAINS = [
  'media.bslsignbank.ucl.ac.uk',
  'bslsignbank.ucl.ac.uk',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get('url');

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' parameter" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(videoUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if domain is allowed
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Domain not allowed" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Fetch the video
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'Accept': 'video/mp4,video/*,*/*',
        'User-Agent': 'BSL-Education-App/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Video not found: ${response.status}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'video/mp4';

    // Return the video with CORS headers and caching
    const videoBody = await response.arrayBuffer();
    
    return new Response(videoBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable", // Cache for 24 hours
        "Content-Length": videoBody.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error("BSL video proxy error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to proxy video",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
