#!/bin/sh
# Ubuntu/Debian host firewall: only SSH, HTTP and HTTPS are reachable.
set -eu
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
# Note: Docker publishes only Caddy (80/443). PostgreSQL has no published port
# and lives on an "internal: true" network. Also enable the Hetzner Cloud Firewall
# with the same rules (22, 80, 443) as a second layer.
