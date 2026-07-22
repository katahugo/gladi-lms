# Rencana Implementasi — LMS 1 VPS Azure (Murah & Handal)

**Sumber:** `PRD.md` di root repo (sebelumnya `PRD-Platform-LMS-Kursus-Digital-v2-SelfHosted.md`, v2.0)

## Langkah 0 — Housekeeping File
- Rename `PRD-Platform-LMS-Kursus-Digital-v2-SelfHosted.md` → `PRD.md` di root repo (nama kanonik agar mudah dirujuk; isi tidak berubah).
**Tujuan rencana:** menurunkan PRD menjadi langkah eksekusi yang menyeimbangkan biaya bulanan serendah mungkin dengan keandalan production-grade di 1 VPS.

---

## 1. Keputusan yang Sudah Dikunci

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Ukuran VM | **Azure B2ms (2 vCPU, 8GB RAM)** | Titik tengah: RAM lega untuk Postgres+Redis+MinIO+Next.js, biaya ~Rp 350–450rb/bulan. Bisa resize naik tanpa rebuild. |
| Video | **Cloudflare Stream (eksternal)** | Menjaga VPS tetap ringan; satu-satunya komponen non-self-hosted. Abstraksi layer video di kode agar migrasi nanti mudah. |
| Backup | **pg_dump harian → Azure Blob Storage (Cool tier) + snapshot VM mingguan** | Backup selamat walau VPS hilang total; biaya Blob Cool ~Rp 15rb/bulan per 100GB. |
| Email | **Resend free tier** | ~100 email/hari gratis, deliverability jauh lebih baik dari self-host SMTP di IP baru. |
| Auth | **Auth.js (NextAuth.js)** di dalam Next.js, session di PostgreSQL/Redis | Sesuai rekomendasi PRD 6.1 — tanpa container tambahan, hemat resource. |
| Database | **PostgreSQL container Docker**, tidak diekspos ke internet | Sesuai PRD 5.5. |
| Cache/Queue | **Redis + BullMQ** (satu container Redis untuk session, cache, dan queue) | Hemat resource dibanding pisah instance. |
| Storage objek | **MinIO container** (S3-compatible) | Untuk PDF, gambar, aset materi; video TIDAK disimpan di sini. |
| Proxy/SSL | **Nginx + Certbot (Let's Encrypt)** di dalam Docker Compose | Gratis, standar industri. |
| CDN/proteksi | **Cloudflare free plan** di depan VPS | Cache aset statis + DDoS protection tanpa biaya. |
| Monitoring | **Uptime Kuma** (container kecil) + **Sentry cloud free tier** + **Azure Monitor metrik dasar** | Semua gratis/murah. |

## 2. Estimasi Biaya Bulanan (Fase Awal)

| Item | Estimasi |
|---|---|
| Azure VM B2ms | Rp 350–450rb |
| Disk Premium SSD 128GB (OS) + 64GB (data) | Rp 200–300rb |
| Azure Blob Storage Cool (backup, ~50–100GB) | Rp 10–20rb |
| Static Public IP | Rp 50rb |
| Cloudflare (DNS/CDN/Stream awal) | Rp 0 – tergantung menit tonton |
| Resend | Rp 0 (free tier) |
| Sentry | Rp 0 (free tier) |
| **Total baseline** | **± Rp 650–850rb/bulan** |

## 3. Batasan Resource di B2ms (penting untuk implementasi)

- Total RAM 8GB; alokasi target: PostgreSQL ≤ 1.5GB, Redis ≤ 512MB (maxmemory policy `allkeys-lru`), MinIO ≤ 512MB, Next.js app ≤ 1.5GB, Nginx/Uptime Kuma kecil, sisakan ≥ 2GB untuk OS + burst.
- Set memory limit eksplisit di setiap service `docker-compose.yml` agar satu container bocor tidak menjatuhkan seluruh VM.
- Tambahkan swap file 4GB sebagai pengaman.
- Tuning PostgreSQL ringan: `shared_buffers=512MB`, `effective_cache_size=2GB`, `max_connections=50`.
- Build Next.js di CI (GitHub Actions runner), bukan di VPS — VPS hanya `docker pull` + restart, agar CPU/RAM VPS tidak terbebani proses build.

## 4. Langkah Implementasi (Berurutan)

### Fase 0 — Provisioning & Fondasi (prasyarat sebelum kode apa pun)
1. Buat VM Azure B2ms, Ubuntu 24.04 LTS, region terdekat target siswa (mis. Southeast Asia), Premium SSD OS 128GB + disk data terpisah 64GB untuk volume Docker.
2. Pasang Static Public IP; catat IP.
3. NSG: buka hanya 80, 443; port SSH (ubah dari 22, mis. 2222) dibatasi ke IP admin saja.
4. Setup domain di Cloudflare: A record → IP VPS, proxy ON (oranye), SSL mode Full (strict).
5. Hardening OS: user non-root + sudo, SSH key-only (disable password login), `ufw` aktif (allow 80/443/port SSH custom), `fail2ban`, `unattended-upgrades`.
6. Install Docker + Docker Compose plugin; mount disk data ke `/var/lib/docker` atau `/data` untuk volume.
7. Buat swap 4GB.

### Fase 1 — Infrastruktur Compose
8. Tulis `docker-compose.yml` dengan service: `nginx`, `app` (Next.js), `postgres`, `redis`, `minio`, `worker` (BullMQ), `uptime-kuma`. Semua dengan memory limit, healthcheck, dan `restart: unless-stopped`.
9. Network Docker internal khusus; hanya Nginx yang expose port 80/443. Postgres/Redis/MinIO tidak expose port publik.
10. Certbot: dapatkan sertifikat Let's Encrypt (container certbot atau certbot host + reload Nginx via hook). Uji auto-renewal.
11. `.env` terpisah untuk secret; pastikan `.env` di `.gitignore`. Sediakan `.env.example`.
12. CI/CD GitHub Actions: build image `app` & `worker` di runner → push ke GitHub Container Registry (gratis untuk repo publik / murah privat) → SSH ke VPS → `docker compose pull && docker compose up -d`. Jangan build di VPS.
13. Uji deployment hello-world end-to-end (domain → Cloudflare → Nginx → app).

### Fase 2 — Aplikasi Inti (MVP)
14. Inisialisasi Next.js + TypeScript + Tailwind sesuai PRD.
15. Skema database (tabel sesuai PRD bagian 7) via migrasi (Prisma/Drizzle — pilih satu, catat keputusannya saat implementasi).
16. Auth.js: credentials (bcrypt/argon2) + Google OAuth; session di Postgres adapter (Redis sebagai cache opsional); RBAC role `student/instructor/admin/support` dicek di middleware.
17. Katalog kursus + course builder dasar (draft/publish).
18. Integrasi Cloudflare Stream: upload via direct-upload URL, simpan `video_uid` di `lessons.konten_ref`, player dengan signed token. Buat abstraksi interface `VideoProvider` agar migrasi ke self-hosted HLS nanti hanya ganti implementasi.
19. Upload file materi (PDF/gambar) ke MinIO via S3 SDK, akses lewat signed URL berdurasi pendek.
20. Checkout + pembayaran Midtrans/Xendit: endpoint create-transaction, webhook dengan signature verification + idempotency key, status transaksi diperbarui via webhook.
21. Enrollment otomatis setelah pembayaran sukses; progress tracking dasar (persen per lesson, last position).

### Fase 3 — Keandalan (wajib sebelum go-live, jangan ditunda)
22. Backup harian: cron di host menjalankan `pg_dump` di container postgres → kompres → upload ke Azure Blob Storage (Cool) via `azcopy`/REST dengan SAS token terbatas → rotasi hapus backup > 14 hari.
23. Jadwalkan Azure VM snapshot mingguan.
24. Uji restore sekali: pulihkan dump ke database kosong, verifikasi data — dokumentasikan langkahnya.
25. Uptime Kuma: monitor endpoint app (https), health endpoint API, dan postgres; notifikasi ke Telegram/email.
26. Sentry: pasang SDK di app + worker (free tier cloud).
27. Azure Monitor: alert dasar CPU > 85%, RAM > 85%, disk > 80%.
28. Job BullMQ: rekonsiliasi pembayaran harian (bandingkan transaksi lokal vs status gateway), generate sertifikat, kirim email via Resend.
29. Load test ringan (mis. k6 dari lokal) terhadap halaman katalog & player untuk memastikan B2ms sanggup; catat baseline.

### Fase 4 — Fitur Lanjutan (setelah go-live stabil)
30. Kuis & auto-grading, sertifikat otomatis + halaman verifikasi publik.
31. Forum diskusi & rating.
32. Dashboard admin/instruktur + laporan.
33. Kupon/diskon, landing page promosi, integrasi WhatsApp.

## 5. Risiko & Mitigasi Spesifik Rencana Ini

| Risiko | Mitigasi |
|---|---|
| B2ms kehabisan RAM saat trafik puncak | Memory limit per container + swap; alert Azure Monitor; jalur mitigasi = resize ke B4ms (tanpa rebuild) |
| Build/deploy membebani VPS | Build di CI runner; VPS hanya pull image |
| Backup gagal diam-diam | Job backup menulis status ke file/healthcheck yang dimonitor Uptime Kuma; uji restore berkala |
| Email free tier habis kuota | Antrekan email via BullMQ dengan retry; upgrade tier Resend saat volume naik (murah) |
| MinIO penuh | Disk data terpisah + alert disk > 80%; lifecycle policy hapus file sementara |
| Single point of failure VM | Backup eksternal + snapshot + SOP restore terdokumentasi; multi-VM adalah Fase 4 PRD (di luar scope rencana ini) |

## 6. Validasi Akhir (Definisi "Handal")
- [ ] Halaman katalog termuat < 2.5 detik LCP lewat Cloudflare.
- [ ] Alur lengkap: registrasi → beli (mode sandbox Midtrans) → enrollment → tonton video → progress tercatat.
- [ ] Matikan container postgres → alert Uptime Kuma masuk < 1 menit.
- [ ] Simulasi VM hilang: restore dari snapshot + pg_dump ke VM baru berhasil dalam SOP terdokumentasi.
- [ ] Webhook pembayaran duplikat tidak membuat enrollment ganda (idempotent).
- [ ] Semua container punya memory limit dan healthcheck; `docker compose up -d` setelah reboot VM membawa sistem hidup kembali otomatis.

## 7. Di Luar Scope (mengikuti PRD)
- Skalabilitas horizontal / multi-VM / load balancer (Fase 4 PRD).
- Self-hosted video (sudah diputuskan pakai Cloudflare Stream).
- Keycloak/Authentik SSO (hanya jika nanti multi-aplikasi).
- Migrasi dari PRD v1.0 (tidak ada sistem lama yang berjalan — repo masih kosong).
