import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-recipients-token',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatPhone(p: string): string {
  if (!p) return '';
  if (p.startsWith('0')) return '0' + p.substring(1);
  if (p.startsWith('972')) return '0' + p.substring(3);
  return p;
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
    const dryRun = url.searchParams.get('dry_run') === 'true';

    const nowMs = Date.now();
    const cutoff24h = new Date(nowMs - 24 * 60 * 60 * 1000);

    const { data: leads, error } = await supabase
      .from('challenge_leads')
      .select('id, created_at, name, phone, email, source, cohort')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const TEST_SOURCES = new Set(['healthcheck', 'e2e_test']);
    const TEST_EMAIL_PATTERNS = ['healthcheck', 'cachetest', 'cachefinal', 'e2e_test', 'test_landing_fix', 'example.com'];

    const realLeads = (leads ?? []).filter(l => {
      if ((l.name || '').startsWith('__')) return false;
      if (TEST_SOURCES.has(l.source || '')) return false;
      const email = (l.email || '').toLowerCase();
      if (TEST_EMAIL_PATTERNS.some(p => email.includes(p))) return false;
      return true;
    });
    const new24h = realLeads.filter(l => new Date(l.created_at) >= cutoff24h);

    const sourceTallyAll: Record<string, number> = {};
    for (const l of realLeads) {
      const s = l.source || 'unknown';
      sourceTallyAll[s] = (sourceTallyAll[s] || 0) + 1;
    }
    const sourceTally24h: Record<string, number> = {};
    for (const l of new24h) {
      const s = l.source || 'unknown';
      sourceTally24h[s] = (sourceTally24h[s] || 0) + 1;
    }

    const now = new Date(nowMs + 3 * 60 * 60 * 1000);
    const dateStr = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}`;

    const lines: string[] = [];
    lines.push(`📊 דוח לידים יומי - ${dateStr}`);
    lines.push('');
    lines.push(`*חדשים ב-24 השעות האחרונות:* ${new24h.length}`);
    lines.push(`*סה"כ במערכת:* ${realLeads.length}`);
    lines.push('');

    if (new24h.length > 0) {
      lines.push('*נרשמים חדשים (24h):*');
      for (const l of new24h) {
        const t = new Date(l.created_at);
        const tStr = `${pad((t.getUTCHours() + 3) % 24)}:${pad(t.getUTCMinutes())}`;
        const src = l.source ? ` [${l.source}]` : '';
        lines.push(`• ${tStr} - ${l.name || '?'} | ${formatPhone(l.phone)}${src}`);
      }
      lines.push('');
    }

    if (Object.keys(sourceTally24h).length > 0) {
      lines.push('*מקורות (24h):*');
      for (const [s, c] of Object.entries(sourceTally24h).sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${s}: ${c}`);
      }
      lines.push('');
    }

    lines.push('*פירוט מקורות מצטבר:*');
    for (const [s, c] of Object.entries(sourceTallyAll).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${s}: ${c}`);
    }

    const message = lines.join('\n');

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_leads: realLeads.length,
        new_24h: new24h.length,
        message,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const greenInstance = Deno.env.get('GREEN_API_INSTANCE');
    const greenToken = Deno.env.get('GREEN_API_TOKEN');
    const guyPhone = Deno.env.get('GUY_PHONE');

    if (!greenInstance || !greenToken || !guyPhone) {
      throw new Error('Missing Green API or GUY_PHONE secrets');
    }

    const sendUrl = `https://api.green-api.com/waInstance${greenInstance}/sendMessage/${greenToken}`;
    const sendRes = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${guyPhone}@c.us`,
        message,
      }),
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      throw new Error(`Green API send failed: ${sendRes.status} ${errBody}`);
    }
    const sendData = await sendRes.json();

    return new Response(JSON.stringify({
      ok: true,
      total_leads: realLeads.length,
      new_24h: new24h.length,
      green_message_id: sendData.idMessage,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
