# fhinkai-site — Claude Code Instructions

## Repository
- **Supabase project:** `vuvavjmbvdqnwtleudqh`
- **Dev branch:** `claude/quirky-rubin-5Ojd2`
- **Production:** static site on JetServer via cPanel pull-deploy from `master`

---

## ROUTINE: daily-leads-report

Trigger the deployed edge function and report the result.

```bash
curl -s -X POST 'https://vuvavjmbvdqnwtleudqh.supabase.co/functions/v1/send-daily-leads-report' \
  -H 'x-recipients-token: drcp_b3b0509bfaddb39a3186891b4a57665d40e4847a238f69b6'
```

**What the edge function does:**
1. Queries **both** `challenge_leads` (landing page) and `challenge_participants` (direct/LMS entrants) in parallel.
2. Filters test data from `challenge_leads`: names starting with `__`, sources `healthcheck`/`e2e_test`, test email patterns.
3. Filters test data from `challenge_participants`: names starting with `__`.
4. Deduplicates by phone — anyone who appears in both tables is counted once (from `challenge_leads`).
5. Participants who arrived directly (not via landing page) are included as separate entries; their `source` = their `cohort` value (e.g. `lms`, `pilot`).
6. Formats a Hebrew WhatsApp message with: new-24h count, total count, per-person list for 24h, source breakdown for 24h, cumulative source breakdown.
7. Sends the message to Guy's WhatsApp (0546232063) via Green API.

**Parse the response:**
- `ok: true` → print `PASS: leads report sent (new_24h=N, total=M, green_message_id=...)`
- error → print `FAIL: <error>` and exit with code 1

**Dry-run (no WhatsApp send):** append `?dry_run=true` to the URL.

**Source labels in the report:**
| Source | Origin |
|--------|--------|
| `landing-pilot` | Registered via the challenge landing page |
| `pilot` | Entered the challenge app directly (cohort=pilot), no landing page |
| `lms` | Entered directly from the Helms LMS (cohort=lms) |

---

## Edge Functions

| Slug | Purpose |
|------|---------|
| `send-daily-leads-report` | Daily leads summary → WhatsApp |
| `create-lead` | Landing page registration → `challenge_leads` |
| `daily-recipients` | Returns recipient list for daily challenge messages |

## Key Tables

| Table | Purpose |
|-------|---------|
| `challenge_leads` | Landing page registrations (source = `landing-pilot`) |
| `challenge_participants` | All challenge app users (landing page + direct/LMS) |
| `profiling_form_submissions` | B2B screening form (Fillout) |

## Test-data conventions
- Names starting with `__` are always test entries (both tables)
- Sources `healthcheck`, `e2e_test` are filtered from `challenge_leads`
- Email patterns `healthcheck`, `cachetest`, `example.com`, etc. are filtered from `challenge_leads`
