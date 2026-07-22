#!/usr/bin/env bash
# =============================================================================
# deploy.sh — dijalankan DI VPS oleh pipeline CI/CD (atau manual via SSH).
#
# Alur:
#   1. Sinkronkan file compose/config dari repo (git pull)
#   2. Login ke GHCR (jika GITHUB_TOKEN tersedia) & pull image baru
#   3. Migrasi database (container one-shot, di dalam network Docker internal)
#   4. Restart service dengan image baru
#   5. Health check — gagal → rollback otomatis ke image sebelumnya
#
# Prasyarat: .env sudah ada di ~/gladi-lms (dibuat manual saat provisioning B6).
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/gladi-lms}"
cd "$APP_DIR"

IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="ghcr.io"
# github.repository di-lowercase sesuai aturan GHCR
IMAGE_REPO="${GITHUB_REPOSITORY:-katahugo/gladi-lms}"
IMAGE_REPO="$(echo "$IMAGE_REPO" | tr '[:upper:]' '[:lower:]')"
NEW_IMAGE="$REGISTRY/$IMAGE_REPO/app:$IMAGE_TAG"

echo "==> [1/5] Sinkronisasi konfigurasi dari git"
if [ -d .git ]; then
  git fetch origin main
  git reset --hard origin/main
fi

echo "==> [2/5] Pull image: $NEW_IMAGE"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "${GITHUB_ACTOR:-deploy}" --password-stdin
fi

# Simpan image yang sedang berjalan untuk rollback
CURRENT_IMAGE="$(docker inspect --format='{{.Config.Image}}' lms_app 2>/dev/null || true)"
echo "    Image saat ini: ${CURRENT_IMAGE:-<belum ada>}"

docker pull "$NEW_IMAGE"

echo "==> [3/5] Migrasi database (one-shot)"
# Jalankan migrasi memakai image aplikasi, di network internal compose,
# sehingga bisa menjangkau container postgres yang tidak diekspos.
# Nama network diambil dinamis dari container postgres yang berjalan.
NETWORK_NAME="$(docker inspect lms_postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)"
if [ -z "$NETWORK_NAME" ]; then
  echo "    Container lms_postgres tidak ditemukan — start database dulu"
  docker compose up -d postgres
  sleep 10
  NETWORK_NAME="$(docker inspect lms_postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
fi
echo "    Network: $NETWORK_NAME"
set -a; source .env; set +a
docker run --rm \
  --network "$NETWORK_NAME" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  "$NEW_IMAGE" \
  npx drizzle-kit migrate

echo "==> [4/5] Restart service dengan image baru"
APP_IMAGE="$NEW_IMAGE" docker compose up -d --remove-orphans

echo "==> [5/5] Health check"
HEALTHY=0
for i in $(seq 1 12); do
  if curl -fsS http://localhost/api/health >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  echo "    Menunggu app sehat... ($i/12)"
  sleep 5
done

if [ "$HEALTHY" -eq 1 ]; then
  echo "==> Deploy SUKSES — $NEW_IMAGE"
  # Bersihkan image lama agar disk tidak penuh (simpan 1 versi rollback)
  docker image prune -f >/dev/null 2>&1 || true
else
  echo "==> Health check GAGAL — rollback"
  if [ -n "$CURRENT_IMAGE" ] && [ "$CURRENT_IMAGE" != "$NEW_IMAGE" ]; then
    echo "    Kembali ke: $CURRENT_IMAGE"
    APP_IMAGE="$CURRENT_IMAGE" docker compose up -d --remove-orphans
    sleep 10
    if curl -fsS http://localhost/api/health >/dev/null 2>&1; then
      echo "==> Rollback berhasil — sistem kembali ke versi sebelumnya"
    else
      echo "==> PERINGATAN: rollback juga gagal health check — INTERVENSI MANUAL DIPERLUKAN" >&2
      exit 1
    fi
  else
    echo "==> Tidak ada image sebelumnya untuk rollback — INTERVENSI MANUAL DIPERLUKAN" >&2
    exit 1
  fi
fi
