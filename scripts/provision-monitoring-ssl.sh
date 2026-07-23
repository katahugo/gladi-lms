#!/usr/bin/env bash
# =============================================================================
# provision-monitoring-ssl.sh — Terbitkan SSL untuk monitoring.gladi.id.
#
# Dijalankan SEKALI di VPS untuk mengaktifkan akses Uptime Kuma via browser
# di https://monitoring.gladi.id (tanpa SSH tunnel).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

DOMAIN="monitoring.gladi.id"
EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
  echo "Pemakaian: $0 <EMAIL>"
  echo "Contoh:  $0 hugoirwanto@gmail.com"
  exit 1
fi

echo "==> Memastikan Nginx berjalan..."
docker compose up -d --no-deps nginx
docker compose exec nginx wget -q -O- http://localhost/health || {
  echo "GALAT: Nginx tidak sehat — periksa docker compose ps nginx" >&2
  exit 1
}

echo "==> Memastikan DNS monitoring.gladi.id sudah resolve ke Cloudflare..."
if host "$DOMAIN" >/dev/null 2>&1 || nslookup "$DOMAIN" >/dev/null 2>&1; then
  echo "    DNS OK"
else
  echo "GALAT: $DOMAIN belum resolve — buat A record di Cloudflare dulu:" >&2
  echo "  Type: A, Name: monitoring, IPv4: 70.153.16.78, Proxy: ON (oranye)" >&2
  exit 1
fi

echo "==> Menerbitkan sertifikat SSL untuk $DOMAIN..."
docker compose run --rm --no-deps certbot-issue \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email \
  --webroot -w /var/www/certbot \
  certonly

echo ""
echo "==> Reload Nginx agar sertifikat baru aktif..."
docker compose up -d --no-deps --force-recreate nginx
sleep 3

echo ""
echo "==> Verifikasi..."
HTTP="$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")"
if [ "$HTTP" = "200" ] || [ "$HTTP" = "301" ] || [ "$HTTP" = "302" ]; then
  echo "    SUCCESS! https://$DOMAIN hidup (HTTP $HTTP)"
  echo "    Buka browser → https://$DOMAIN → setup akun admin Uptime Kuma."
else
  echo "    PERINGATAN: curl mengembalikan HTTP $HTTP — cek manual https://$DOMAIN"
fi

echo ""
echo "==> SELESAI. Akses Uptime Kuma di: https://$DOMAIN"
echo "    Setup akun admin saat pertama kali membuka (username/email + password)."
