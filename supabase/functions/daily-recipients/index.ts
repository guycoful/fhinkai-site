import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const BASE_URL = 'https://fhinkai.com';
const TIMEZONE_OFFSET_HOURS = 3;

function buildMessage(name: string, dayNumber: number, link: string): string {
  const greetings: Record<number, string> = {
    1: `בוקר טוב ${name} 🌅\n\nהיום מתחיל יום 1 באתגר "כסף שעובד"!\n\nהלינק האישי שלך:\n${link}\n\nזמן משוער: 30 דקות. בהצלחה!`,
    2: `בוקר טוב ${name} ☀️\n\nיום 2 פתוח. ניתוח ההוצאות שלך מחכה.\n\nהלינק שלך:\n${link}`,
    3: `בוקר טוב ${name} 💪\n\nיום 3 מחכה לך - הסוכן האישי שלך להגדלת ההכנסה.\n\nהלינק:\n${link}`,
    4: `בוקר טוב ${name} 🎯\n\nיום 4 - מבחן החמצן. רואים את התמונה השלמה.\n\nהלינק:\n${link}\n\nנפגש בוובינר!`,
  };
  return greetings[dayNumber] ?? `${name}, הלינק שלך ליום ${dayNumber}: ${link}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const requiredToken = Deno.env.get('DAILY_RECIPIENTS_TOKEN');
  const providedToken = req.headers.get('x-recipients-token');
  if (requiredToken && providedToken !== requiredToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const overrideDate = url.searchParams.get('date');
    const cohortFilter = url.searchParams.get('cohort');
    const dryRun = url.searchParams.get('dry_run') === 'true';

    const now = overrideDate ? new Date(overrideDate) : new Date();

    let query = supabase
      .from('challenge_participants')
      .select('id, name, phone, cohort, challenge_start_at, last_reminder_day, last_reminder_sent_at');
    if (cohortFilter) query = query.eq('cohort', cohortFilter);

    const { data: participants, error } = await query;
    if (error) throw error;

    const recipients: any[] = [];

    for (const p of participants ?? []) {
      if (!p.phone || !p.challenge_start_at) continue;
      if (p.name?.startsWith('__')) continue;

      const startAt = new Date(p.challenge_start_at);
      const startLocalMidnight = new Date(startAt);
      startLocalMidnight.setUTCHours(startLocalMidnight.getUTCHours() + TIMEZONE_OFFSET_HOURS);
      startLocalMidnight.setUTCHours(0, 0, 0, 0);
      startLocalMidnight.setUTCHours(startLocalMidnight.getUTCHours() - TIMEZONE_OFFSET_HOURS);

      const nowLocalMidnight = new Date(now);
      nowLocalMidnight.setUTCHours(nowLocalMidnight.getUTCHours() + TIMEZONE_OFFSET_HOURS);
      nowLocalMidnight.setUTCHours(0, 0, 0, 0);
      nowLocalMidnight.setUTCHours(nowLocalMidnight.getUTCHours() - TIMEZONE_OFFSET_HOURS);

      const msPerDay = 24 * 60 * 60 * 1000;
      const dayNumber = Math.floor(
        (nowLocalMidnight.getTime() - startLocalMidnight.getTime()) / msPerDay
      ) + 1;

      if (dayNumber < 1 || dayNumber > 4) continue;

      if (!dryRun && p.last_reminder_day === dayNumber && p.last_reminder_sent_at) {
        const sentAt = new Date(p.last_reminder_sent_at);
        const hoursSinceSent = (now.getTime() - sentAt.getTime()) / (60 * 60 * 1000);
        if (hoursSinceSent < 20) continue;
      }

      const link = `${BASE_URL}/day${dayNumber}.html?pid=${p.id}`;
      const name = (p.name || '').split(' ')[0] || 'משתתף';
      const message = buildMessage(name, dayNumber, link);

      recipients.push({
        pid: p.id,
        name,
        phone: p.phone,
        day_number: dayNumber,
        cohort: p.cohort,
        link,
        message,
      });
    }

    return new Response(
      JSON.stringify({
        recipients,
        count: recipients.length,
        served_at: now.toISOString(),
        dry_run: dryRun,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
