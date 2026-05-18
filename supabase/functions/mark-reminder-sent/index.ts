import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-recipients-token',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const requiredToken = Deno.env.get('DAILY_RECIPIENTS_TOKEN');
  const providedToken = req.headers.get('x-recipients-token');
  if (requiredToken && providedToken !== requiredToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const pid = String(body.pid || '').trim();
    const day = Number(body.day_number);

    if (!pid || !Number.isInteger(day) || day < 1 || day > 4) {
      return new Response(JSON.stringify({ error: 'pid and day_number (1-4) required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase
      .from('challenge_participants')
      .update({
        last_reminder_day: day,
        last_reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', pid);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, pid, day_number: day }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
