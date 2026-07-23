# Context — Proyek Gladi LMS

> Dokumen ini merangkum seluruh konteks, keputusan, dan progress proyek agar
> percakapan/pengerjaan bisa dilanjutkan tanpa kehilangan informasi.
> **Terakhir diperbarui:** 23 Juli 2026 (setelah C1–C5 selesai, E1 dimulai).

---

## 1. Gambaran Proyek

- **Nama:** Gladi LMS — Platform LMS penjualan kursus digital
- **PRD:** `PRD.md` (v2.0 — Self-Hosted di Azure VPS)
- **Domain live:** `https://gladi.id`
- **Repo:** `https://github.com/katahugo/gladi-lms` (branch `main`)
- **Tujuan:** production-grade, fitur lengkap, biaya murah, 1 VPS self-managed

## 2. Infrastruktur (Deployment Aktual)

| Aspek | Nilai |
|---|---|
| VM | `vm-gladi-lms` — Azure **B2ms** (2 vCPU, 8GB RAM), Indonesia Central |
| IP publik | `70.153.16.78` (Static) |
| OS | Ubuntu 24.04 LTS, disk OS 128GB + data 64GB (`/data/docker`) |
| SSH | port **2020**, user `deploy`, key-only (root login mati) |
| Domain | `gladi.id` — Cloudflare proxied, SSL Full (strict), Let's Encrypt |
| Stack | Next.js 16 + TypeScript + Tailwind 4 + **Drizzle ORM** (bukan Prisma) |
| DB | PostgreSQL 16 (Docker, tidak diekspos) — 16 tabel |
| Cache/Queue | Redis 7 + BullMQ (kredensial field terpisah) |
| Storage | MinIO (S3-compatible, konsol di 127.0.0.1:9001) |
| Auth | Auth.js (NextAuth v5) + Drizzle adapter, JWT, RBAC, `trustHost: true` |
| Video | Cloudflare Stream (interface `VideoProvider`, `cf:` prefix) |
| Payment | Midtrans Snap + webhook (signature SHA512, idempotent) |
| CI/CD | GitHub Actions → build app+worker (tag terpisah, timestamp WIB) → GHCR → SSH deploy |

## 3. File Kunci

- `PRD.md` — PRD v2.0
- `EXECUTION-STEPS.md` — pelacak progres A1–E4 + panduan Tahap B step-by-step + Ringkasan Deployment + 15 pelajaran
- `code-testing.md` — panduan & progress pengujian C1
- `docker-compose.yml` — 8 service (nginx, certbot, certbot-issue, app, worker, postgres, redis, minio, uptime-kuma)
- `app/Dockerfile` — multi-stage (deps → builder → app/worker), bundle worker+migrate via esbuild
- `scripts/deploy.sh` — deploy dengan rollback otomatis (APP_DIR dari lokasi skrip)
- `scripts/backup.sh` / `restore.sh` — pg_dump → Azure Blob (retensi 14 hari)
- `.github/workflows/deploy.yml` — 3 job (quality → docker → deploy)

## 4. Progress Tahap

### ✅ Tahap A (A1–A8) — Persiapan lokal
PRD, compose, Nginx/Dockerfile, Next.js+Drizzle, skema DB 16 tabel, Auth.js+RBAC, CI/CD, backup/restore.

### ✅ Tahap B (B1–B6) — Provisioning Azure + CI/CD
Go-live 23 Jul 2026. 15 pelajaran terdokumentasi (health 404, nginx crash, certbot, Created, worker.js, URI malformed Redis/Postgres, MODULE_NOT_FOUND, UntrustedHost, cache basi, drizzle .sql ter-gitignore, dll).

### ✅ Tahap C (C1–C5) — Fitur inti MVP
- **C1** Katalog kursus + course builder (draft/publish/archive, guard kepemilikan)
- **C2** Integrasi Cloudflare Stream (interface `VideoProvider`, direct upload TUS, playback dengan kontrol akses)
- **C3** Upload materi MinIO signed URL (upload/confirm/download, kontrol akses)
- **C4** Checkout Midtrans + webhook idempotent (kursus gratis langsung enrollment, signature verification, enrollment atomik)
- **C5** Enrollment otomatis + progress tracking + halaman belajar (`/learn/[slug]`)

### 🔵 Tahap E (E1–E4) — Fitur lanjutan — SEDANG DIKERJAKAN
- **E1** Kuis & auto-grading + sertifikat + verifikasi publik — **BARU DIMULAI**
  - Sudah dibuat: `app/src/lib/quiz.ts` (gradeAnswers untuk MC/true-false, essay manual, generateCertificateNumber GLD-YYYY-XXXXXX)
  - **Belum:** endpoint API kuis (submit attempt + auto-grading), endpoint sertifikat (issue saat kursus selesai), halaman verifikasi publik `/verify/[certificateNumber]`, UI kuis di halaman belajar
- **E2** Forum diskusi & rating — belum
- **E3** Dashboard admin/instruktur + laporan — belum
- **E4** Kupon, landing page, WhatsApp — belum

### ⬜ Tahap D (D1–D5) — Keandalan (ditunda, dikerjakan setelah E atas permintaan user)
Backup cron, uji restore, Uptime Kuma + Sentry, job BullMQ, load test.

## 5. Skema Database (16 tabel)

users, accounts, sessions, verification_tokens (Auth.js) · courses, modules, lessons · enrollments, progress · quizzes, quiz_questions, quiz_attempts · certificates · transactions · discussions, course_reviews.
Constraint penting: `transactions_paid_unique` (partial unique — idempotensi), CHECK rating 1–5, progress 0–100.
Migrasi: `app/drizzle/0000_init.sql` + `0001_custom_constraints.sql` via `app/scripts/migrate.mjs` (bundle ESM).

## 6. Pola Teknik Penting (jangan dilanggar)

- **Kredensial DB/Redis sebagai field terpisah** (PGHOST/PGUSER/dll, REDIS_HOST/dll) — BUKAN URL dengan password mentah (penyebab URIError).
- **Tag image app vs worker terpisah** (`app:latest` vs `worker:latest`).
- **`--no-deps`** pada docker compose saat bootstrap.
- **`certbot-issue`** untuk penerbitan SSL (bukan `certbot` yang renew-loop).
- **`trustHost: true`** di auth.ts (wajib di belakang Nginx reverse proxy).
- **APP_DIR dari lokasi skrip** (bukan `$HOME`).
- **BUILD_SHA build-arg** sebelum `COPY . .` di Dockerfile (invalidasi cache CI).
- **`!**/drizzle/**/*.sql`** di .gitignore (file migrasi wajib ter-commit).
- Guard kepemilikan: instruktur hanya kursus miliknya; admin bebas.
- Kontrol akses konten: free preview (anonim) / instruktur / admin / enrollment aktif.
- Prefix contentRef: `cf:` (Cloudflare Stream), `s3:` (MinIO).

## 7. Akun Uji (untuk pengujian)

- `siswa@uji.id` / `password123` (role student)
- `instruktur@uji.id` / `password123` (role instructor)
- `instruktur2@uji.id` / `password123` (role instructor)
- `tesdb@uji.id` / `password123` (role student)

## 8. Env yang Belum Diisi di VPS (fitur mengembalikan 503 sopan tanpa ini)

- `CF_STREAM_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, `CF_STREAM_CUSTOMER_SUBDOMAIN` (video)
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` (pembayaran)
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` (MinIO — endpoint sudah `http://minio:9000`)
- `AZURE_STORAGE_*` (backup ke Blob — untuk Tahap D)
- `RESEND_API_KEY` (email — untuk Tahap D/E)

## 9. Keadaan Terkini & Langkah Berikutnya

- Pipeline CI/CD hijau; setiap push ke `main` auto-deploy dengan tag timestamp WIB.
- Tahap C lengkap dan tervalidasi live.
- **Sedang mengerjakan E1** — `lib/quiz.ts` sudah dibuat; lanjutkan dengan endpoint API kuis, sertifikat, dan halaman verifikasi publik.
- Setelah E1–E4: kembali ke Tahap D (keandalan) sebelum go-live publik penuh.

## 10. Perintah Lanjutan yang Umum

- "kerjakan E2" / "lanjutkan E1" — fitur lanjutan
- "kerjakan D1" — kembali ke keandalan
- Push: `git -c credential.helper=manager-core push origin main` (PATH: `C:\Program Files\Git\mingw64\libexec\git-core`)
- Pantau pipeline: GitHub Actions API dengan token dari credential manager
