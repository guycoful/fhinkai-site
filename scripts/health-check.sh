#!/usr/bin/env bash
# fhinkai.com health check — runs on Hetzner as cron, alerts via Telegram
set -uo pipefail

ENV_FILE="/home/claude/.claude/channels/telegram/.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN not set}"
CHAT_ID="${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID not set}"
STATE_FILE="${HOME}/.fhinkai-health-state"
LOG_FILE="${HOME}/.fhinkai-health.log"
NOW=$(date '+%Y-%m-%d %H:%M:%S %Z')

telegram() {
  curl -s -o /dev/null -X POST \
    "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    -d "parse_mode=Markdown" \
    --data-urlencode "text=$1" || true
}

> /tmp/fhink_fails

check() {
  local name="$1" expected="$2" must_contain="$3"
  shift 3
  local status
  status=$(curl -s -o /tmp/fhink_body -w '%{http_code}' --max-time 15 "$@" 2>/dev/null) || status="000"

  if [[ "$status" != "$expected" ]]; then
    echo "FAIL [$name]: HTTP $status"
    echo "$name (HTTP $status)" >> /tmp/fhink_fails
    return 0
  fi
  if [[ -n "$must_contain" ]] && ! grep -q "$must_contain" /tmp/fhink_body 2>/dev/null; then
    echo "FAIL [$name]: body missing '$must_contain'"
    echo "$name (body)" >> /tmp/fhink_fails
    return 0
  fi
  echo "PASS [$name]"
}

check "landing"          "200" "" \
  https://fhinkai.com/landing/

check "day1.html"        "200" "" \
  https://fhinkai.com/day1.html

check "READY"            "200" "" \
  https://fhinkai.com/READY/

check "create-lead"      "200" "id" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"__HEALTHCHECK__","phone":"0500000000","email":"healthcheck@example.com","cohort":"pilot"}' \
  https://vuvavjmbvdqnwtleudqh.supabase.co/functions/v1/create-lead

check "daily-recipients" "200" "recipients" \
  -H "x-recipients-token: drcp_b3b0509bfaddb39a3186891b4a57665d40e4847a238f69b6" \
  "https://vuvavjmbvdqnwtleudqh.supabase.co/functions/v1/daily-recipients?dry_run=true&date=2026-05-31T08:00:00%2B03:00"

CURRENT=$(sort /tmp/fhink_fails 2>/dev/null || echo "")
PREV=$(cat "$STATE_FILE" 2>/dev/null || echo "")

NEW_FAILS=$(comm -23 <(echo "$CURRENT") <(echo "$PREV") | sed 's/^/• /' | tr '\n' '\n')
RECOVERED=$(comm -13 <(echo "$CURRENT") <(echo "$PREV") | sed 's/^/• /' | tr '\n' '\n')

if [[ -n "$NEW_FAILS" ]]; then
  telegram "🚨 *fhinkai DOWN* — ${NOW}

Down:
${NEW_FAILS}"
  echo "[$NOW] ALERT: $NEW_FAILS" >> "$LOG_FILE" 2>/dev/null || true
fi

if [[ -n "$RECOVERED" ]]; then
  telegram "✅ *fhinkai RECOVERED* — ${NOW}

Back up:
${RECOVERED}"
  echo "[$NOW] RECOVERY: $RECOVERED" >> "$LOG_FILE" 2>/dev/null || true
fi

echo "$CURRENT" > "$STATE_FILE"

if [[ -z "$CURRENT" ]]; then
  echo "[$NOW] PASS all 5" >> "$LOG_FILE" 2>/dev/null || true
fi

exit 0
