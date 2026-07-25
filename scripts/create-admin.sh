#!/usr/bin/env bash
# =============================================================================
# create-admin.sh — Buat user admin pertama di Gladi LMS.
#
# Registrasi endpoint hanya membuat role "student" (by design). Skrip ini
# memanfaatkan endpoint registrasi untuk membuat akun (password di-hash oleh
# aplikasi), LALU mempromosikan role ke "admin" via database.
#
# Kenapa tidak hash manual? bcryptjs mungkin tidak tersedia di image standalone
# Next.js, sehingga hash yang di-generate container tidak cocok dengan hash
# yang diharapkan Auth.js credentials provider.
#
# Pemakaian:
#   ./scripts/create-admin.sh admin@gladi.id "Admin Name" "secure-password"
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

EMAIL="${1:-}"
NAME="${2:-}"
PASSWORD="${3:-}"

if [ -z "$EMAIL" ] || [ -z "$NAME" ] || [ -z "$PASSWORD" ]; then
  echo "Pemakaian: $0 <email> <nama> <password>"
  echo "Contoh:  $0 admin@gladi.id 'Admin Gladi' 'password-kuat-min-8-karakter'"
  exit 1
fi

if [ ! -f .env ]; then
  echo "GALAT: .env belum ada di $APP_DIR" >&2
  exit 1
fi

set -a; source .env; set +a

echo "==> Membuat user admin: $EMAIL ($NAME)"

# 1. Cek apakah email sudah terdaftar
EXISTING="$(docker exec lms_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
  "SELECT role FROM users WHERE email='$EMAIL';" 2>/dev/null | tr -d ' \n')"

if [ -n "$EXISTING" ]; then
  echo "    User sudah ada dengan role: $EXISTING"
  if [ "$EXISTING" != "admin" ]; then
    echo "    Mengubah role menjadi admin..."
    docker exec lms_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
      "UPDATE users SET role='admin', updated_at=now() WHERE email='$EMAIL';" >/dev/null
    echo "    Role diubah menjadi admin. Silakan login di https://gladi.id/login"
  else
    echo "    User sudah admin. Silakan login di https://gladi.id/login"
  fi
  exit 0
fi

# 2. Registrasi via API (password di-hash oleh aplikasi — pasti cocok).
#    Panggil via docker compose exec ke container nginx (pasti punya curl)
#    ke port 3000 internal app, menghindari redirect HTTP→HTTPS.
echo "    Mendaftarkan via API..."
REG_RESP="$(docker compose exec -T nginx curl -s -w '\nHTTP=%{http_code}' -X POST http://app:3000/api/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

HTTP_CODE="$(echo "$REG_RESP" | grep HTTP= | cut -d= -f2)"
BODY="$(echo "$REG_RESP" | grep -v HTTP=)"

if [ "$HTTP_CODE" != "201" ]; then
  echo "    GALAT: Registrasi gagal (HTTP $HTTP_CODE): $BODY" >&2
  exit 1
fi

echo "    Registrasi berhasil (HTTP 201)"

# 3. Promosikan ke admin
docker exec lms_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "UPDATE users SET role='admin', updated_at=now() WHERE email='$EMAIL';" >/dev/null

echo ""
echo "==> User admin berhasil dibuat!"
echo "    Email:    $EMAIL"
echo "    Password: $PASSWORD"
echo "    Role:     admin"
echo "    Login di: https://gladi.id/login"
echo ""
echo "    Setelah login, akses dashboard admin: https://gladi.id/admin"
