import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

// Day-1 unlock time (stored as challenge_start_at)
const COHORT_START: Record<string, string> = {
  'pilot': '2026-05-31T06:00:00+03:00',
  'rehearsal': '2026-05-20T06:00:00+03:00',
  'lms': '2026-05-20T11:30:00+03:00',
};

// Registration cutoff; defaults to COHORT_START when not overridden
const COHORT_REG_CLOSE: Record<string, string> = {
  'lms': '2026-05-20T13:00:00+03:00',
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

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'name required (min 2 chars)' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (typeof body.income !== 'number' || body.income < 0) {
      return new Response(JSON.stringify({ error: 'income required (number >= 0)' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const cohortInput = (body.cohort || 'pilot').toLowerCase();
    const cohort = COHORT_START[cohortInput] ? cohortInput : 'pilot';
    const challenge_start_at = COHORT_START[cohort];

    const regClose = COHORT_REG_CLOSE[cohort] ?? challenge_start_at;
    const cutoff = new Date(regClose).getTime();
    const now = Date.now();
    if (now > cutoff) {
      return new Response(JSON.stringify({
        error: 'late_registration',
        message: 'הרישום לקוהורט הזה נסגר. הקוהורט הבא יוכרז בקרוב.',
        cohort,
        started_at: challenge_start_at,
      }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const allowed = [
      'name','age','job_type','email','phone',
      'income','income_extra',
      'rent','arnona','utilities','telecom','car_insurance','loans','education','leasing','test_annual',
      'groceries','dining','coffee','transport','health','shopping','leisure','kids',
      'pension_extra','keren_hishtalmut','gemel_invest','child_savings','general_savings',
      'annual_insurance','emergency_fund','annual_subs',
      'expenses_detail','agent_type'
    ];
    const row: Record<string, unknown> = {
      cohort,
      challenge_start_at,
    };
    for (const k of allowed) {
      if (body[k] !== undefined) row[k] = body[k];
    }

    const { data, error } = await supabase
      .from('challenge_participants')
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

    return new Response(JSON.stringify({ id: data.id, row: data }), {
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
