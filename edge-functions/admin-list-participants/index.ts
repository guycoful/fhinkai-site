import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const header = cols.join(',');
  const lines = rows.map(r =>
    cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Auth: require Bearer ADMIN_TOKEN
  const authHeader = req.headers.get('authorization') || '';
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expected = Deno.env.get('ADMIN_TOKEN') || '';

  if (!expected) {
    return new Response(JSON.stringify({ error: 'admin token not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!provided || !timingSafeEqual(provided, expected)) {
    // Avoid revealing whether the token exists; same response either way
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Parse format from query string (?format=csv)
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase
    .from('challenge_participants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const rows = data ?? [];

  if (format === 'csv') {
    const csv = '﻿' + toCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="challenge_participants.csv"',
      },
    });
  }

  return new Response(JSON.stringify({ count: rows.length, rows }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
