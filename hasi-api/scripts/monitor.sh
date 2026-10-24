#!/bin/sh
# Basic monitoring. Add to crontab:  */5 * * * * /opt/hasi/scripts/monitor.sh
# Optional: ALERT_WEBHOOK_URL=https://... (Slack/Discord/ntfy) in the environment.
set -u
cd "$(dirname "$0")/.."
. ./.env
URL="https://${API_DOMAIN}/health"
if ! curl -fsS --max-time 10 "$URL" >/dev/null; then
  MSG="HASi API health check failed: $URL"
  echo "$(date -u) $MSG" >> monitor.log
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"text\":\"$MSG\"}" "$ALERT_WEBHOOK_URL" >/dev/null
fi
DISK=$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')
[ "$DISK" -gt 85 ] && echo "$(date -u) disk usage ${DISK}%" >> monitor.log
LAST=$(ls -1t backups/hasi_*.dump 2>/dev/null | head -1)
[ -z "$LAST" ] || [ -n "$(find "$LAST" -mmin +1560)" ] && echo "$(date -u) backup older than 26h or missing" >> monitor.log
exit 0
