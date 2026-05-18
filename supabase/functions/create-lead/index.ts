import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const VALID_COHORTS = ['pilot', 'rehearsal', 'lms'];

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/[^0-9]/g, '');
}

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

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'name required (min 2 chars)' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const phone = normalizePhone(body.phone);
    if (phone.length < 9) {
      return new Response(JSON.stringify({ error: 'valid phone required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const cohortInput = String(body.cohort || 'pilot').toLowerCase();
    const cohort = VALID_COHORTS.includes(cohortInput) ? cohortInput : 'pilot';

    const row = {
      name: String(body.name).trim(),
      phone,
      email: body.email ? String(body.email).trim() : null,
      gender: body.gender ? String(body.gender).trim() : null,
      source: body.source ? String(body.source).trim() : null,
      cohort,
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('challenge_leads')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: data.id, lead: data }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
