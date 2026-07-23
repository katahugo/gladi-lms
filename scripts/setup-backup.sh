#!/usr/bin/env bash
# =============================================================================
# setup-backup.sh — Aktivasi backup otomatis di VPS (Tahap D1).
#
# Tugas:
#   1. Verifikasi kredensial Azure Blob sudah diisi di .env
#   2. Pasang cron job harian (jam 02:00 UTC = 09:00 WIB) untuk backup.sh
#   3. Uji koneksi upload satu kali (tanpa menunggu cron)
#
# Dijalankan SEKALI di VPS sebagai user deploy.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

echo "==> Memuat .env..."
set -a; source .env; set +a

# Verifikasi kredensial Azure
if [ -z "${AZURE_STORAGE_ACCOUNT:-}" ]; then
  echo "GALAT: AZURE_STORAGE_ACCOUNT belum diisi di .env" >&2
  echo "  Buka portal.azure.com → Storage accounts → buat akun dengan tier Cool (murah)"
  echo "  → buat container '${AZURE_STORAGE_CONTAINER:-lms-backups}' → Shared Access Signature"
  echo "  → generate SAS token (izin: Write, List, Delete, masa berlaku 2 tahun)"
  echo "  → isi 3 variabel AZURE_STORAGE_* di .env, lalu jalankan ulang skrip ini."
  exit 1
fi

: "${AZURE_STORAGE_CONTAINER:?AZURE_STORAGE_CONTAINER wajib diisi di .env}"
: "${AZURE_STORAGE_SAS_TOKEN:?AZURE_STORAGE_SAS_TOKEN wajib diisi di .env}"

echo "==> Kredensial Azure Blob: OK (${AZURE_STORAGE_ACCOUNT} / ${AZURE_STORAGE_CONTAINER})"

# Pastikan backup.sh executable
chmod +x "$SCRIPT_DIR/backup.sh"

# Pasang cron job (backup harian jam 02:00 UTC = 09:00 WIB)
CRON_LINE="0 2 * * * ${APP_DIR}/scripts/backup.sh >> /var/log/lms-backup.log 2>&1"
CRON_MARKER="# gladi-lms-backup"

echo "==> Memasang cron job harian..."
# Hapus entry lama bila ada, lalu tambah yang baru
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab - 2>/dev/null || true
(crontab -l 2>/dev/null; echo "$CRON_LINE $CRON_MARKER") | crontab -

echo "==> Cron terpasang. Verifikasi:"
crontab -l | grep gladi-lms-backup

echo ""
echo "==> Uji backup satu kali sekarang (tanpa menunggu cron)..."
"$SCRIPT_DIR/backup.sh" && echo "==> Backup pertama BERHASIL! D1 selesai." || {
  echo "==> PERINGATAN: Backup pertama gagal — periksa log di /var/log/lms-backup.log"
  echo "    Pastikan Azure Storage Account + container + SAS token sudah benar."
}
