import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const expected = Deno.env.get('ADMIN_TOKEN') || '';
  if (!expected) return new Response(JSON.stringify({ error: 'admin token not configured' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  if (!provided || !timingSafeEqual(provided, expected)) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const pid = new URL(req.url).searchParams.get('pid');
  if (!pid) return new Response(JSON.stringify({ error: 'pid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data, error } = await supabase
    .from('challenge_chat_messages')
    .select('role, content, created_at')
    .eq('participant_id', pid)
    .order('created_at', { ascending: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ messages: data || [] }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
