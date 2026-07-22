# Langkah Eksekusi — LMS 1 VPS Azure

Pelacak progres implementasi dari `.kilo/plans/1784731820560-lms-single-vps-cost-optimized-plan.md`.
Setiap langkah dijalankan **hanya setelah Anda memerintahkan**. Status: `TODO` → `IN PROGRESS` → `DONE`.

Legend status: ⬜ TODO | 🔵 IN PROGRESS | ✅ DONE | ⏭️ SKIPPED | ⚠️ BLOCKED

---

## Tahap A — Persiapan Lokal (bisa dikerjakan sekarang, tanpa akses Azure)

| # | Langkah | Output | Status |
|---|---|---|---|
| A1 | Rename `PRD-Platform-LMS-Kursus-Digital-v2-SelfHosted.md` → `PRD.md` | File `PRD.md` di root | ✅ |
| A2 | Tulis `docker-compose.yml` + `.env.example` + `.gitignore` (service: nginx, app, postgres, redis, minio, worker, uptime-kuma; memory limit & healthcheck per service) | File compose siap pakai | ⬜ |
| A3 | Tulis konfigurasi Nginx (reverse proxy + SSL) + Dockerfile `app` & `worker` | `nginx/`, `Dockerfile` | ⬜ |
| A4 | Inisialisasi Next.js + TypeScript + Tailwind + Prisma/Drizzle (hello-world) | Folder `app/` jalan lokal | ⬜ |
| A5 | Skema database (migrasi awal, tabel sesuai PRD §7) | File migrasi | ⬜ |
| A6 | Auth.js: credentials + Google OAuth + RBAC middleware | Login/logout jalan | ⬜ |
| A7 | CI/CD GitHub Actions (build image di runner → GHCR → SSH deploy) | `.github/workflows/deploy.yml` | ⬜ |
| A8 | Skrip backup `pg_dump` → Azure Blob + rotasi 14 hari | `scripts/backup.sh` | ⬜ |

## Tahap B — Provisioning Azure (butuh kredensial/akses Azure Anda)

| # | Langkah | Output | Status |
|---|---|---|---|
| B1 | Buat VM B2ms Ubuntu 24.04 + disk data 64GB + Static IP | VM aktif, IP dicatat | ⬜ |
| B2 | NSG: buka 80/443; SSH port custom dibatasi IP admin | Aturan firewall | ⬜ |
| B3 | Hardening OS (user non-root, SSH key-only, ufw, fail2ban, unattended-upgrades, swap 4GB) | Server aman | ⬜ |
| B4 | Install Docker + mount disk data | Docker siap | ⬜ |
| B5 | Cloudflare: A record → IP VPS, proxy ON, SSL Full (strict) | Domain resolving | ⬜ |
| B6 | Deploy compose pertama + Certbot SSL | https://domain hidup | ⬜ |

## Tahap C — Fitur Inti MVP (lokal, setelah A4–A6)

| # | Langkah | Output | Status |
|---|---|---|---|
| C1 | Katalog kursus + course builder (draft/publish) | CRUD kursus | ⬜ |
| C2 | Integrasi Cloudflare Stream (interface `VideoProvider`) | Upload & play video | ⬜ |
| C3 | Upload materi ke MinIO (signed URL) | Unduh/upload materi | ⬜ |
| C4 | Checkout Midtrans/Xendit + webhook idempotent | Transaksi sandbox sukses | ⬜ |
| C5 | Enrollment otomatis + progress tracking | Progres siswa tercatat | ⬜ |

## Tahap D — Keandalan (wajib sebelum go-live)

| # | Langkah | Output | Status |
|---|---|---|---|
| D1 | Aktifkan backup harian ke Blob (cron) + snapshot mingguan | Backup terjadwal | ⬜ |
| D2 | Uji restore sekali + dokumentasi SOP | SOP restore terbukti | ⬜ |
| D3 | Uptime Kuma monitor + Sentry + alert Azure Monitor | Alert berjalan | ⬜ |
| D4 | Job BullMQ: rekonsiliasi pembayaran, sertifikat, email | Worker berjalan | ⬜ |
| D5 | Load test ringan + checklist validasi akhir (plan §6) | Sistem tervalidasi | ⬜ |

## Tahap E — Fitur Lanjutan (setelah go-live stabil)

| # | Langkah | Status |
|---|---|---|
| E1 | Kuis & auto-grading + sertifikat + verifikasi publik | ⬜ |
| E2 | Forum diskusi & rating | ⬜ |
| E3 | Dashboard admin/instruktur + laporan | ⬜ |
| E4 | Kupon, landing page, WhatsApp | ⬜ |

---

**Urutan perintah yang disarankan:** A1 → A2/A3 → A4 → A5 → A6 → A7 → A8 → (B1–B6 saat Anda siap dengan Azure) → C1–C5 → D1–D5 → E1+.
Perintah cukup sebutkan kodenya, misal: "kerjakan A1" atau "lanjut A2 sampai A4".
