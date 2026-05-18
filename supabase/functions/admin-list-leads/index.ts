import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token !== Deno.env.get('ADMIN_TOKEN')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 200);

  const { data, error } = await supabase
    .from('challenge_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: String(error.message) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ count: data?.length ?? 0, rows: data }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
