# Gladi LMS — Platform Penjualan Kursus Digital

Platform LMS production-grade untuk menjual kursus digital, dibangun dan di-deploy sepenuhnya di atas 1 VPS Azure dengan biaya tetap per bulan.

**Live:** [`https://gladi.id`](https://gladi.id) | **Monitoring:** [`https://monitoring.gladi.id`](https://monitoring.gladi.id)

---

## Daftar Isi

- [Fitur](#fitur)
- [Arsitektur](#arsitektur)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi & Setup](#instalasi--setup)
- [Pengembangan Lokal](#pengembangan-lokal)
- [Deployment](#deployment)
- [Operasional](#operasional)
- [Dokumentasi Terkait](#dokumentasi-terkait)

---

## Fitur

### Untuk Siswa
- **Katalog kursus** — browsing, pencarian, detail lengkap
- **Pemutaran video** — streaming adaptif via Cloudflare Stream, resume posisi terakhir
- **Materi unduh** — PDF, gambar, dokumen via signed URL MinIO
- **Kuis interaktif** — multiple choice, true/false, essay dengan auto-grading
- **Sertifikat terverifikasi** — nomor unik, halaman verifikasi publik
- **Forum diskusi** — tanya-jawab per materi
- **Rating & review** — beri penilaian kursus

### Untuk Instruktur
- **Course builder** — CRUD kursus, modul, materi (draft/publish/archive)
- **Upload video** — direct upload ke Cloudflare Stream (TUS)
- **Upload materi** — signed URL ke MinIO
- **Kuis builder** — buat soal MC/true-false/essay, passing score, max attempts
- **Dashboard** — statistik kursus, pendapatan, progres siswa
- **Manajemen progres** — lihat penyelesaian materi per siswa

### Untuk Admin
- **Dashboard global** — user, kursus, enrollment, pendapatan, sertifikat
- **Manajemen user** — ubah role (student/instructor/admin/support)
- **Manajemen transaksi** — daftar, rekonsiliasi
- **Kupon diskon** — CRUD kupon (percent/fixed), per-kursus, kedaluwarsa

### Keandalan
- **CI/CD otomatis** — build → push GHCR → deploy via GitHub Actions
- **Backup harian** — pg_dump → Azure Blob Storage, retensi 14 hari
- **Restore** — satu perintah pulihkan dari backup terbaru
- **Monitoring** — Uptime Kuma (health check), Sentry (error tracking), Azure Monitor (resource)
- **Rollback otomatis** — health check gagal → kembali ke image sebelumnya
- **Idempotensi webhook** — partial unique index mencegah pembayaran ganda

---

## Arsitektur

```
                         Internet
                            │
                  ┌─────────▼─────────┐
                  │   Cloudflare       │  ← DNS, DDoS, cache statis
                  │  (Free Plan)       │
                  └─────────┬─────────┘
                            │ HTTPS
        ┌───────────────────▼──────────────────────────┐
        │              AZURE VPS (1 VM, Ubuntu)          │
        │                                                 │
        │  ┌──────────────────────────────────────────┐  │
        │  │   Nginx (reverse proxy + SSL)              │  │
        │  └───────────────┬────────────────────────────┘ │
        │                  │                               │
        │  ┌───────────────▼────────────┐                 │
        │  │  Next.js App (Docker)       │                 │
        │  │  - Web UI (SSR)             │                 │
        │  │  - API routes               │                 │
        │  └───────┬──────────┬──────────┘                 │
        │          │          │                             │
        │  ┌───────▼───┐  ┌───▼────────┐   ┌─────────────┐│
        │  │ PostgreSQL │  │   Redis    │   │  MinIO      ││
        │  │ (Docker)   │  │  (cache +  │   │ (storage)   ││
        │  │            │  │   queue)   │   │             ││
        │  └────────────┘  └────────────┘   └─────────────┘│
        │                                                 │
        │  ┌──────────────────────────────────────────┐  │
        │  │  Worker (BullMQ)                           │  │
        │  │  - Rekonsiliasi pembayaran                 │  │
        │  │  - Generate sertifikat PDF                 │  │
        │  │  - Kirim email                             │  │
        │  └──────────────────────────────────────────┘  │
        │                                                 │
        │  ┌──────────────┐  ┌──────────────────────┐   │
        │  │ Uptime Kuma  │  │ Certbot (SSL renew)   │   │
        │  └──────────────┘  └──────────────────────┘   │
        └─────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
      ┌───────▼────────┐         ┌───────▼────────┐
      │  Midtrans       │         │  Cloudflare     │
      │  (Pembayaran)   │         │  Stream (Video) │
      └────────────────┘         └────────────────┘
```

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16 (React 19) + TypeScript + Tailwind CSS 4 |
| Backend | Next.js API Routes / Route Handlers |
| Database | PostgreSQL 16 (Docker, 17 tabel) |
| ORM | Drizzle ORM + postgres.js |
| Auth | Auth.js (NextAuth v5) + Drizzle adapter, JWT, RBAC |
| Cache/Queue | Redis 7 + BullMQ |
| Storage | MinIO (S3-compatible, self-hosted) |
| Reverse Proxy | Nginx + Certbot (Let's Encrypt) |
| Video | Cloudflare Stream (direct upload TUS) |
| Payment | Midtrans Snap + webhook (SHA512 signature) |
| Email | Resend |
| Monitoring | Uptime Kuma + Sentry + Azure Monitor |
| Backup | pg_dump → Azure Blob Storage (REST + SAS) |
| CI/CD | GitHub Actions → GHCR → SSH deploy |
| Container | Docker Compose (8 service) |
| Hosting | Azure VM B2ms (2 vCPU, 8GB RAM), Ubuntu 24.04 |

---

## Struktur Proyek

```
gladi-lms/
├── .github/workflows/     # CI/CD (deploy.yml)
├── app/                   # Aplikasi Next.js
│   ├── src/
│   │   ├── app/           # Halaman & API routes
│   │   │   ├── admin/     # Dashboard admin
│   │   │   ├── api/       # 25+ endpoint API
│   │   │   ├── courses/   # Katalog publik
│   │   │   ├── dashboard/ # Dashboard user
│   │   │   ├── instructor/# Dashboard instruktur
│   │   │   ├── learn/     # Halaman belajar
│   │   │   ├── login/     # Halaman login
│   │   │   └── verify/    # Verifikasi sertifikat
│   │   ├── components/    # 15+ komponen React
│   │   ├── db/            # Skema database + koneksi
│   │   ├── jobs/          # Job BullMQ worker
│   │   ├── lib/           # Helper (video, storage, payments, kupon, kuis, reports)
│   │   └── worker/        # Entry point worker BullMQ
│   ├── drizzle/           # File migrasi SQL
│   ├── scripts/           # Skrip build (migrate, worker)
│   ├── Dockerfile         # Multi-stage build (app + worker)
│   └── package.json
├── nginx/                 # Konfigurasi Nginx
│   ├── nginx.conf         # Konfigurasi utama
│   ├── templates/         # Template site (envsubst)
│   ├── includes/          # Shared proxy config
│   └── lms.conf.bootstrap # Konfigurasi bootstrap SSL
├── scripts/               # Skrip operasional
│   ├── deploy.sh          # Deploy dengan rollback
│   ├── backup.sh          # Backup harian
│   ├── restore.sh         # Restore dari backup
│   ├── setup-backup.sh    # Aktivasi backup
│   ├── provision-monitoring-ssl.sh  # SSL monitoring
│   └── load-test.js       # Load test k6
├── docker-compose.yml     # 8 service
├── .env.example           # Template environment
├── .gitignore
├── PRD.md                 # Product Requirements Document
├── EXECUTION-STEPS.md     # Pelacak progres implementasi
├── Context.md             # Konteks & keputusan proyek
├── code-testing.md        # Panduan pengujian
├── Setup.md               # Panduan instalasi & setup
└── README.md              # File ini
```

---

## Prasyarat

### Development Lokal
- Node.js 20+
- npm
- Docker Desktop (untuk menjalankan Postgres/Redis/MinIO lokal)

### Production (VPS)
- Azure VM (atau VPS lain) dengan Ubuntu 24.04
- Domain dengan Cloudflare (free plan)
- Docker + Docker Compose

---

## Instalasi & Setup

**Panduan lengkap dari nol hingga production: lihat [`Setup.md`](Setup.md).**

Ringkasan singkat:

```bash
# 1. Clone repo
git clone https://github.com/katahugo/gladi-lms.git
cd gladi-lms

# 2. Setup environment
cp .env.example .env
nano .env  # isi minimal: APP_DOMAIN, AUTH_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD

# 3. Jalankan service
docker compose up -d postgres redis minio
docker compose build app
docker compose up -d
```

---

## Pengembangan Lokal

```bash
cd app
npm install
npm run dev          # Next.js dev server (port 3000)
npm run db:generate  # Generate migrasi dari perubahan skema
npm run db:push      # Push skema ke database (development)
npm run db:studio    # Drizzle Studio (GUI database)
npm run lint         # ESLint
npx tsc --noEmit     # Type-check
```

Database lokal bisa dijalankan via Docker:
```bash
docker compose up -d postgres redis minio
```

---

## Deployment

Deployment **otomatis** via GitHub Actions setiap push ke branch `main`:

1. **Quality** — lint → type-check → build
2. **Docker** — build image app + worker (tag terpisah, timestamp WIB) → push GHCR
3. **Deploy** — SSH ke VPS → pull image → migrasi DB → restart → health check + rollback

Secrets yang dibutuhkan di GitHub: `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`.

---

## Operasional

### Backup Harian
```bash
# Otomatis via cron (02:00 UTC = 09:00 WIB)
# Manual: ./scripts/backup.sh
tail -f /var/log/lms-backup.log
```

### Restore dari Backup
```bash
./scripts/restore.sh                    # restore terbaru
./scripts/restore.sh pgdump-...dump     # restore spesifik
```

### Monitoring
- **Uptime Kuma:** [`https://monitoring.gladi.id`](https://monitoring.gladi.id)
- **Sentry:** dashboard sentry.io (isi `SENTRY_DSN` di `.env`)
- **Azure Monitor:** portal Azure → VM → Alerts

### Load Test
```bash
# Install k6: winget install k6
k6 run scripts/load-test.js
```

### Logs
```bash
docker compose logs -f app       # log aplikasi
docker compose logs -f worker    # log worker BullMQ
docker compose logs -f nginx     # log reverse proxy
```

---

## Dokumentasi Terkait

| File | Isi |
|---|---|
| [`Setup.md`](Setup.md) | Panduan instalasi & setup lengkap (dari nol hingga production) |
| [`PRD.md`](PRD.md) | Product Requirements Document v2.0 |
| [`EXECUTION-STEPS.md`](EXECUTION-STEPS.md) | Pelacak progres 33 langkah implementasi + pelajaran perbaikan |
| [`Context.md`](Context.md) | Konteks proyek, keputusan arsitektur, pola teknik |
| [`code-testing.md`](code-testing.md) | Panduan pengujian fitur |
| [`.env.example`](.env.example) | Template environment variables |

---

## Lisensi

Proyek ini bersifat private. © 2026 Gladi LMS.
