import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    if (!body.email || typeof body.email !== 'string') {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!body.answers || typeof body.answers !== 'object') {
      return new Response(JSON.stringify({ error: 'answers required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const emailNorm = String(body.email).trim().toLowerCase();

    // Try exact match first, then case-insensitive fallback.
    let { data: matched, error } = await supabase
      .from('challenge_leads')
      .update({
        pre_test_data: body.answers,
        questionnaire_sent: true,
        questionnaire_sent_at: new Date().toISOString(),
      })
      .eq('email', emailNorm)
      .select('id');

    if (!error && (!matched || matched.length === 0)) {
      const ci = await supabase
        .from('challenge_leads')
        .update({
          pre_test_data: body.answers,
          questionnaire_sent: true,
          questionnaire_sent_at: new Date().toISOString(),
        })
        .ilike('email', emailNorm)
        .select('id');
      matched = ci.data ?? [];
      error = ci.error ?? null;
    }

    if (error) {
      console.error('Update error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!matched || matched.length === 0) {
      console.warn('save-pretest-answers: no lead matched email', emailNorm);
      return new Response(JSON.stringify({ ok: false, matched: 0, email: emailNorm }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: matched.length }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
