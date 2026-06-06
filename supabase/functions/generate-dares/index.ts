// Supabase Edge Function: generate-dares
//
// Holds ANTHROPIC_API_KEY server-side and calls the Anthropic Messages API.
// The React Native client never sees the key.
//
// Deploy:
//   supabase functions deploy generate-dares
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Invoke from the client:
//   supabase.functions.invoke('generate-dares', { body: { description } })
//
// Returns: { dares: [{ title, description, category, suggested_difficulty }, ...] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a dare generator for a social challenge app called Provd.
Generate exactly 3 short, fun, achievable dares based on the
description of the target person. Each dare should be completable
within a day, require photo or video proof, and be appropriate
for all audiences. Respond only with a JSON array of 3 objects,
each with: title (max 80 chars), description (max 200 chars),
category, suggested_difficulty.`;

// Structured-outputs schema. Length constraints (max 80/200 chars) and array
// length (exactly 3) aren't supported in structured-outputs schemas, so they
// stay in the prompt. Enums lock category and suggested_difficulty to the
// values used elsewhere in the app.
const DARES_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      category: {
        type: "string",
        enum: ["fitness", "food", "social", "creative", "mental", "wildcard"],
      },
      suggested_difficulty: {
        type: "string",
        enum: ["easy", "medium", "hard", "insane"],
      },
    },
    required: ["title", "description", "category", "suggested_difficulty"],
    additionalProperties: false,
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "ANTHROPIC_API_KEY is not configured on the server." },
        500,
      );
    }

    let body: { description?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) {
      return jsonResponse({ error: "description is required" }, 400);
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Description of the target person: ${description}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: DARES_SCHEMA,
        },
      },
    });

    const textBlock = message.content.find(
      (b: { type: string }) => b.type === "text",
    ) as { type: "text"; text: string } | undefined;
    if (!textBlock) {
      return jsonResponse({ error: "Model returned no text content." }, 502);
    }

    let dares: unknown;
    try {
      dares = JSON.parse(textBlock.text);
    } catch {
      return jsonResponse(
        { error: "Model output was not valid JSON." },
        502,
      );
    }

    if (!Array.isArray(dares)) {
      return jsonResponse(
        { error: "Model output was not an array." },
        502,
      );
    }

    return jsonResponse({ dares });
  } catch (err) {
    console.error("generate-dares error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (err instanceof Anthropic.RateLimitError) {
      return jsonResponse(
        { error: "Rate limited. Please try again in a moment." },
        429,
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return jsonResponse(
        { error: "Server-side Anthropic API key is invalid." },
        500,
      );
    }
    return jsonResponse({ error: errorMessage }, 500);
  }
});
