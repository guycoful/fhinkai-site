import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const pid = url.searchParams.get('pid');
    const dayParam = url.searchParams.get('day');
    const day = dayParam ? parseInt(dayParam, 10) : NaN;

    if (!pid || !day || day < 1 || day > 4) {
      return new Response(JSON.stringify({ error: 'pid and day (1-4) required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('challenge_participants')
      .select('challenge_start_at, cohort, name')
      .eq('id', pid)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'participant not found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const startAt = new Date(data.challenge_start_at);
    const unlockAt = new Date(startAt);
    unlockAt.setUTCDate(startAt.getUTCDate() + (day - 1));

    const now = new Date();
    const unlocked = now >= unlockAt;
    const secondsUntilUnlock = unlocked ? 0 : Math.floor((unlockAt.getTime() - now.getTime()) / 1000);

    return new Response(JSON.stringify({
      unlocked,
      unlockAt: unlockAt.toISOString(),
      secondsUntilUnlock,
      serverNow: now.toISOString(),
      cohort: data.cohort,
      name: data.name,
      day,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
