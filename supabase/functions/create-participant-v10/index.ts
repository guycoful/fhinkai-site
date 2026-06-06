import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

// Day-1 unlock time (stored as challenge_start_at)
// pilot postponed from 2026-06-07 → 2026-06-14 (postponed by Omri on 6.6: warmup phase extended)
const COHORT_START: Record<string, string> = {
  'pilot': '2026-06-14T06:00:00+03:00',
  'rehearsal': '2026-05-20T06:00:00+03:00',
  'lms': '2026-05-20T11:30:00+03:00',
};

// Registration cutoff; defaults to COHORT_START when not overridden.
// lms + pilot have no cutoff — registration stays open from cohort_start onwards.
// (Without this override, cutoff would equal cohort_start and the early-access
// gate below would leave a zero-length valid window.)
const COHORT_REG_CLOSE: Record<string, string> = {
  'lms': '2099-12-31T00:00:00+03:00',
  'pilot': '2099-12-31T00:00:00+03:00',
};

function valueShape(value: unknown) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', length: value.length };

  const type = typeof value;
  if (type === 'string') return { type, length: value.length };
  if (type === 'object') return { type, keyCount: Object.keys(value as Record<string, unknown>).length };
  return { type };
}

function bodyShape(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return valueShape(body);
  }

  const record = body as Record<string, unknown>;
  return {
    type: 'object',
    keyCount: Object.keys(record).length,
    fields: Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, valueShape(record[key])])
    ),
  };
}

Deno.serve(async (req: Request) => {
  const reqId = crypto.randomUUID();
  const userAgent = req.headers.get('user-agent') ?? '';

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', reqId, userAgent }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const shape = bodyShape(body);

    console.log('create-participant-v10:v17 request_shape', JSON.stringify({
      reqId,
      userAgent,
      shape,
    }));

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      console.warn('create-participant-v10:v17 validation_failed', JSON.stringify({
        reqId,
        userAgent,
        reason: 'name',
        shape,
      }));
      return new Response(JSON.stringify({ error: 'name required (min 2 chars)', reqId, userAgent }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (typeof body.income !== 'number' || body.income < 0) {
      console.warn('create-participant-v10:v17 validation_failed', JSON.stringify({
        reqId,
        userAgent,
        reason: 'income',
        shape,
      }));
      return new Response(JSON.stringify({ error: 'income required (number >= 0)', reqId, userAgent }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const cohortInput = (body.cohort || 'pilot').toLowerCase();
    const cohort = COHORT_START[cohortInput] ? cohortInput : 'pilot';
    const challenge_start_at = COHORT_START[cohort];

    const now = Date.now();
    const startTs = new Date(challenge_start_at).getTime();

    // Early-access gate: reject submissions before official cohort start.
    // Mirrors the frontend gate in /READY/script.js and /day1.html.
    if (now < startTs) {
      return new Response(JSON.stringify({
        error: 'too_early',
        message: 'האתגר ייפתח ב-' + challenge_start_at + '. שמרנו את ההרשמה שלך, נשלח תזכורת לפני הפתיחה.',
        cohort,
        starts_at: challenge_start_at,
      }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const regClose = COHORT_REG_CLOSE[cohort] ?? challenge_start_at;
    const cutoff = new Date(regClose).getTime();
    if (now > cutoff) {
      return new Response(JSON.stringify({
        error: 'late_registration',
        message: 'הרישום לקוהורט הזה נסגר. הקוהורט הבא יוכרז בקרוב.',
        cohort,
        started_at: challenge_start_at,
        reqId,
        userAgent,
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
      'expenses_detail','agent_type','source'
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
      console.error('create-participant-v10:v17 insert_error', JSON.stringify({
        reqId,
        userAgent,
        message: error.message,
        code: error.code,
      }));
      return new Response(JSON.stringify({ error: error.message, reqId, userAgent }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    console.log('create-participant-v10:v17 created', JSON.stringify({
      reqId,
      userAgent,
      participantId: data.id,
      cohort,
    }));

    return new Response(JSON.stringify({ id: data.id, row: data, reqId, userAgent }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('create-participant-v10:v17 unexpected_error', JSON.stringify({
      reqId,
      userAgent,
      message: String(e?.message || e),
    }));
    return new Response(JSON.stringify({ error: String(e?.message || e), reqId, userAgent }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
