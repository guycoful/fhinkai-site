import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getExpectedToken(): string {
  return Deno.env.get("SYNC_BOARD_TOKEN") || Deno.env.get("ADMIN_TOKEN") || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const expected = getExpectedToken();
  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

  if (!expected) {
    return new Response(JSON.stringify({ error: "sync board token not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!isRecord(body)) {
    return new Response(JSON.stringify({ error: "body must be an object" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : "omri-pilot";
  const updatedBy = typeof body.updatedBy === "string" ? body.updatedBy.trim().slice(0, 120) : "";
  const payload = body.payload;

  if (!isRecord(payload)) {
    return new Response(JSON.stringify({ error: "payload must be an object" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > 200_000) {
    return new Response(JSON.stringify({ error: "payload too large" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await supabase
    .from("sync_board_state")
    .upsert({
      slug,
      payload,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    })
    .select("slug, payload, updated_by, created_at, updated_at")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
