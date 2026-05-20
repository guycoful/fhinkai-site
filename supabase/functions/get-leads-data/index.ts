import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Verify admin via JWT (verify_jwt: true on deploy means Supabase already validated the token)
  // We use the caller's token to verify admin role via is_admin()
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'missing authorization' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use service role for querying data, but check admin status via the user's JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    // Check admin
    const { data: adminCheck, error: adminError } = await supabaseUser.rpc('is_admin');
    if (adminError) {
      return new Response(JSON.stringify({ error: 'admin check failed', detail: String(adminError) }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'forbidden: admin only' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for data queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const nowMs = Date.now();
    const cutoff24h = new Date(nowMs - 24 * 60 * 60 * 1000);

    const [{ data: leads, error: leadsError }, { data: participants, error: pError }] = await Promise.all([
      supabase
        .from('challenge_leads')
        .select('id, created_at, name, phone, email, source, cohort')
        .order('created_at', { ascending: false }),
      supabase
        .from('challenge_participants')
        .select('id, created_at, name, phone, email, cohort')
        .order('created_at', { ascending: false }),
    ]);

    if (leadsError) throw leadsError;
    if (pError) throw pError;

    const TEST_SOURCES = new Set(['healthcheck', 'e2e_test']);
    const TEST_EMAIL_PATTERNS = ['healthcheck', 'cachetest', 'cachefinal', 'e2e_test', 'test_landing_fix', 'example.com'];

    const realLeads = (leads ?? []).filter(l => {
      if ((l.name || '').startsWith('__')) return false;
      if (TEST_SOURCES.has(l.source || '')) return false;
      const email = (l.email || '').toLowerCase();
      if (TEST_EMAIL_PATTERNS.some(p => email.includes(p))) return false;
      return true;
    });

    // Add direct participants (not via landing page) — dedup by phone
    const leadPhones = new Set(realLeads.map(l => l.phone).filter(Boolean));
    const directParticipants = (participants ?? [])
      .filter(p => {
        if ((p.name || '').startsWith('__')) return false;
        if (p.phone && leadPhones.has(p.phone)) return false;
        return true;
      })
      .map(p => ({
        id: p.id,
        created_at: p.created_at,
        name: p.name,
        phone: p.phone ?? '',
        email: p.email ?? '',
        source: p.cohort ?? 'direct',
        cohort: p.cohort,
      }));

    // Merge and sort newest first
    const allLeads = [...realLeads, ...directParticipants].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const new24h = allLeads.filter(l => new Date(l.created_at) >= cutoff24h);

    const bySource: Record<string, number> = {};
    for (const l of allLeads) {
      const s = l.source || 'unknown';
      bySource[s] = (bySource[s] || 0) + 1;
    }

    return new Response(JSON.stringify({
      leads: allLeads,
      stats: {
        total: allLeads.length,
        new_24h: new24h.length,
        by_source: bySource,
      },
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
