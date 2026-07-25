#!/usr/bin/env bash
# =============================================================================
# create-admin.sh — Buat user admin pertama di Gladi LMS.
#
# Registrasi endpoint hanya membuat role "student" (by design). Role admin
# harus diangkat langsung via database. Skrip ini melakukan keduanya dalam
# satu perintah.
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

# 2. Buat user baru langsung via DB (bypass endpoint registrasi)
# Password di-hash bcrypt — kita pakai bcryptjs via Node one-liner
HASH="$(docker run --rm --network "$(docker inspect lms_postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')" \
  --entrypoint node \
  "$(docker inspect --format='{{.Config.Image}}' lms_app 2>/dev/null || echo 'ghcr.io/katahugo/gladi-lms/app:latest')" \
  -e "const b=require('bcryptjs');console.log(b.hashSync('$PASSWORD',12))" 2>/dev/null)"

if [ -z "$HASH" ]; then
  echo "GALAT: Gagal generate password hash — pastikan container app ada" >&2
  exit 1
fi

docker exec lms_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "INSERT INTO users (name, email, password_hash, role, email_verified, created_at, updated_at)
   VALUES ('$NAME', '$EMAIL', '$HASH', 'admin', now(), now(), now());" >/dev/null

echo ""
echo "==> User admin berhasil dibuat!"
echo "    Email:    $EMAIL"
echo "    Password: $PASSWORD"
echo "    Role:     admin"
echo "    Login di: https://gladi.id/login"
echo ""
echo "    Setelah login, akses dashboard admin: https://gladi.id/admin"
