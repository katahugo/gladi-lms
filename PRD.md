# PRD — Platform LMS Penjualan Kursus Digital
**Versi:** 2.1 — Self-Hosted di Azure VPS + Planning Dashboard Backend
**Status:** Infrastruktur & MVP inti live (23 Jul 2026, `https://gladi.id`) — fokus dashboard Admin & Instruktur menjadi fokus berikutnya
**Skala target:** Produksi (production-grade), fitur lengkap, infrastruktur self-managed

> Perubahan dari v1.0: seluruh infrastruktur (aplikasi + database) dipindahkan ke **1 VPS Azure milik sendiri**, tidak lagi memakai Vercel maupun Supabase. Autentikasi memakai library open-source gratis, bukan Supabase Auth.
>
> **v2.1:** menambahkan §13 — planning lengkap **Dashboard Backend** (panel Admin + Instruktur) dalam satu dokumen PRD ini, termasuk baseline yang sudah ada, gap, spesifikasi halaman, API, fase pengerjaan, dan kriteria penerimaan.

---

## 1. Ringkasan Eksekutif

Platform LMS untuk menjual kursus digital, dibangun dan di-deploy sepenuhnya di atas **1 Virtual Machine (VPS) Azure** yang dikelola sendiri — termasuk database, aplikasi web, dan proses background — agar biaya operasional lebih terprediksi (harga VM tetap per bulan, bukan pay-per-usage seperti BaaS), serta kontrol penuh atas data dan infrastruktur.

**Konsekuensi arsitektural dari keputusan ini:**
- Tim bertanggung jawab penuh atas provisioning, keamanan, backup, dan monitoring server (tidak ada lagi "managed service" yang menangani ini otomatis).
- Butuh sedikit effort DevOps di awal (setup Docker, reverse proxy, SSL, backup terjadwal), tapi setelah itu operasional harian relatif ringan dengan automasi yang tepat.
- Video hosting tetap direkomendasikan pakai layanan eksternal khusus (lihat Bagian 6.3) karena transcoding & streaming video di 1 VPS tunggal berisiko membebani CPU/bandwidth dan mengganggu performa aplikasi utama — namun opsi full self-hosted video tetap dijabarkan sebagai alternatif dengan trade-off-nya.

---

## 2. Target Pengguna & Peran (Roles)

Tidak berubah dari v1.0:

| Peran | Deskripsi | Akses Utama |
|---|---|---|
| **Siswa (Student)** | Pembeli/pengguna kursus | Katalog, checkout, player video, kuis, sertifikat, forum tanya-jawab |
| **Instruktur** | Pembuat konten kursus | Course builder, upload materi, lihat progres siswa, jawab pertanyaan |
| **Admin** | Pemilik platform | Manajemen user, kursus, transaksi, laporan, konfigurasi pembayaran |
| **Support/CS** | Tim layanan pelanggan | Lihat transaksi, bantu reset akses, moderasi forum |

---

## 3. Ruang Lingkup Fitur (Functional Requirements)

Sama seperti v1.0 — tidak ada perubahan fitur, hanya perubahan infrastruktur. Ringkasan:

- Autentikasi & manajemen akun (registrasi, login, OAuth Google, reset password, RBAC)
- Katalog & manajemen kursus (course builder, modul/materi, draft-publish)
- Pemutaran konten (video adaptif, proteksi akses, progress tracking)
- Kuis, tugas & evaluasi (auto-grading, review manual)
- Sertifikat otomatis + halaman verifikasi publik
- Pembayaran (Midtrans/Xendit — QRIS, e-wallet, transfer bank, kartu kredit)
- Forum diskusi & rating kursus
- Notifikasi email (+ opsional WhatsApp)
- SEO & landing page promosi
- **Dashboard Backend (Admin & Instruktur)** — spesifikasi lengkap di **§13** (baseline, gap, IA, API, fase, acceptance criteria)
  - **Admin** — overview platform, user, transaksi, kupon; perluasan: kursus global, moderasi, laporan
  - **Instruktur** — overview milik sendiri, kelola kursus; perluasan: course builder kurikulum, upload konten, kuis builder, diskusi, penilaian essay, progres siswa

---

## 4. Non-Functional Requirements

| Aspek | Target | Catatan untuk self-hosted VPS |
|---|---|---|
| **Ketersediaan (uptime)** | ≥ 99.5% | Tidak ada auto-failover bawaan seperti cloud managed service — perlu monitoring aktif + alerting, dan rencana disaster recovery (snapshot VM) |
| **Waktu muat halaman** | < 2.5 detik (LCP) | Perlu caching (Nginx/Redis) karena tidak ada CDN edge otomatis seperti Vercel — direkomendasikan tetap pasang Cloudflare di depan VPS (gratis) untuk caching aset statis & proteksi DDoS |
| **Skalabilitas** | Tahan lonjakan trafik promo | Di 1 VPS, skalabilitas vertikal (upgrade ukuran VM) adalah jalur utama fase awal; skalabilitas horizontal (multi-VM + load balancer) jadi rencana Fase 4 |
| **Keamanan** | Tahan OWASP Top 10 | Hardening OS, firewall (NSG Azure + ufw), fail2ban, update rutin — semua jadi tanggung jawab tim, bukan otomatis dari provider |
| **Kepatuhan data (UU PDP)** | Wajib | Karena data siswa disimpan di database sendiri, tim bertanggung jawab penuh atas enkripsi at-rest, kontrol akses, dan hak hapus data |
| **Backup** | Harian, retensi ≥ 7–30 hari | Wajib disiapkan manual: backup database + snapshot VM terjadwal (lihat Bagian 8) |

---

## 5. Arsitektur Sistem — Rekomendasi (Self-Hosted, 1 VPS Azure)

### 5.1 Filosofi Arsitektur
Semua komponen inti (aplikasi web, API, database, reverse proxy) berjalan sebagai **container Docker** dalam satu VM Azure, diorkestrasi dengan **Docker Compose**. Ini memberi isolasi antar service tanpa kompleksitas Kubernetes, dan mudah dipindah/di-replicate ke VM lain jika nanti perlu scale up.

### 5.2 Spesifikasi VPS Azure yang Direkomendasikan (untuk mulai)

| Komponen | Rekomendasi Awal |
|---|---|
| **VM Series** | Azure **B-series** — rekomendasi awal Standard_B4ms (4 vCPU, 16GB RAM); **deployment aktual: Standard_B2ms (2 vCPU, 8GB RAM)** untuk menekan biaya baseline, dengan jalur resize ke B4ms tanpa rebuild bila trafik naik |
| **OS** | Ubuntu Server 24.04 LTS |
| **Storage** | Premium SSD, minimal 128GB (pisahkan disk data untuk volume Docker/database agar mudah di-resize). **Aktual: OS 128GB + disk data 64GB termount di `/data` (data-root Docker dipindah ke sana)** |
| **Networking** | Azure NSG (Network Security Group) — hanya buka port SSH custom (dibatasi IP admin), 80, 443. **Aktual: SSH di port 2020 (bukan 22), dibatasi IP admin** |
| **Static IP** | Azure Public IP (static) agar domain & DNS stabil. **Aktual: `70.153.16.78`** |
| **Region** | Terdekat dengan mayoritas target siswa. **Aktual: Indonesia Central** |

> Catatan: B-series cocok karena sifatnya *burstable* (murah saat idle, bisa burst saat trafik naik) — cocok untuk LMS yang traffic-nya tidak konstan sepanjang hari. Kalau nanti pemakaian CPU konsisten tinggi, pertimbangkan pindah ke D-series. Deployment aktual memakai B2ms (lihat plan keputusan di `.kilo/plans/`), yang cukup untuk MVP hingga beberapa ratus siswa aktif dengan tuning memory per container.

> **Status implementasi:** Infrastruktur bagian ini **sudah ter-deploy dan go-live** pada 23 Juli 2026 di `https://gladi.id` (VM `vm-gladi-lms`). Rincian nilai aktual dan pelajaran perbaikan selama deployment terdokumentasi di `EXECUTION-STEPS.md` (bagian "Ringkasan Deployment Aktual").

### 5.3 Diagram Arsitektur (High-Level, 1 VPS)

```
                         Internet
                            │
                  ┌─────────▼─────────┐
                  │   Cloudflare       │  ← DNS, proteksi DDoS,
                  │  (gratis, di depan │    cache aset statis
                  │   VPS sbg proxy)   │
                  └─────────┬─────────┘
                            │ HTTPS
        ┌───────────────────▼──────────────────────────┐
        │              AZURE VPS (1 VM, Ubuntu)          │
        │                                                 │
        │  ┌──────────────────────────────────────────┐  │
        │  │   Nginx (reverse proxy + SSL/Let's Encrypt)│  │
        │  └───────────────┬────────────────────────────┘ │
        │                  │                               │
        │  ┌───────────────▼────────────┐                 │
        │  │  Next.js App (Docker)       │                 │
        │  │  - Web UI (SSR)             │                 │
        │  │  - API routes (auth, course,│                 │
        │  │    payment, progress)       │                 │
        │  └───────┬──────────┬──────────┘                 │
        │          │          │                             │
        │  ┌───────▼───┐  ┌───▼────────┐   ┌─────────────┐│
        │  │ PostgreSQL │  │   Redis    │   │  MinIO      ││
        │  │ (Docker)   │  │  (session, │   │ (S3-compat, ││
        │  │            │  │   cache,   │   │  object     ││
        │  │            │  │   queue)   │   │  storage    ││
        │  │            │  │            │   │  untuk PDF, ││
        │  │            │  │            │   │  gambar)    ││
        │  └────────────┘  └────────────┘   └─────────────┘│
        │                                                 │
        │  ┌──────────────────────────────────────────┐  │
        │  │  Background worker (BullMQ + Redis)        │  │
        │  │  - generate sertifikat PDF                 │  │
        │  │  - kirim email                             │  │
        │  │  - rekonsiliasi pembayaran                 │  │
        │  └──────────────────────────────────────────┘  │
        └─────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
      ┌───────▼────────┐         ┌───────▼────────┐
      │  Payment Gateway│         │  Video Streaming│
      │ (Midtrans/Xendit)│        │  (Mux/Cloudflare│
      │  — pihak ketiga  │        │  Stream) — lihat│
      │                  │        │  Bagian 6.3     │
      └──────────────────┘        └─────────────────┘
```

### 5.4 Kenapa Struktur Ini
- **Docker Compose** memisahkan tiap service (app, db, redis, storage) jadi container sendiri — kalau nanti perlu pindah database ke VM terpisah, tinggal ubah connection string, tidak perlu re-arsitektur total.
- **Nginx** sebagai reverse proxy + terminasi SSL (pakai **Certbot/Let's Encrypt**, gratis) di depan aplikasi Next.js.
- **MinIO** dipakai sebagai storage S3-compatible yang di-hosting sendiri di VPS — gratis, open-source, dan API-nya kompatibel dengan kode yang biasa dipakai untuk S3/R2, sehingga kalau nanti ingin pindah ke object storage cloud (Azure Blob Storage, Cloudflare R2) migrasinya mudah.
- **Redis** menangani session cache & job queue (dipakai bareng BullMQ untuk background job seperti generate sertifikat dan kirim email, menggantikan peran Inngest/Supabase Edge Functions di versi sebelumnya).

### 5.5 Keamanan (Disesuaikan untuk Self-Hosted)
- SSH hanya via key-based auth (disable password login), port SSH diubah dari default 22. **Aktual: port 2020 + user non-root `deploy` + root login dimatikan.**
- Firewall berlapis: Azure NSG di level cloud + `ufw` di level OS.
- `fail2ban` untuk mencegah brute-force ke SSH/login endpoint.
- Update keamanan OS & Docker image terjadwal (unattended-upgrades untuk patch kritikal).
- Database PostgreSQL tidak diekspos ke internet — hanya bisa diakses dari container aplikasi dalam jaringan Docker internal.
- Row-level authorization tetap diterapkan di level aplikasi (karena tidak ada RLS otomatis seperti Supabase, ini harus ditulis eksplisit di query/ORM).
- Signed URL berdurasi pendek untuk akses video & file materi.
- Webhook signature verification untuk semua callback payment gateway.

---

## 6. Tech Stack Rekomendasi (Self-Hosted di Azure VPS)

| Layer | Rekomendasi | Alasan |
|---|---|---|
| **Frontend** | Next.js (React) + TypeScript + Tailwind CSS | Tetap dipertahankan — framework-nya sama, hanya cara hosting yang berubah |
| **Backend/API** | Next.js API Routes / Route Handlers, dijalankan sebagai container Node.js (via `next start` atau custom Node server) | Satu image Docker untuk frontend+backend, deploy simpel dengan `docker compose up` |
| **Database** | **PostgreSQL** — diinstall sendiri sebagai container Docker di VPS | Gratis, open-source, sepenuhnya dalam kendali sendiri, tanpa biaya bulanan tambahan seperti Supabase |
| **Object storage** | **MinIO** (self-hosted, S3-compatible) | Alternatif gratis untuk Supabase Storage/S3, API kompatibel sehingga library upload yang sama tetap bisa dipakai |
| **Cache & Queue** | **Redis** (Docker) + **BullMQ** | Menangani session, cache, dan background job tanpa perlu layanan eksternal |
| **Reverse proxy & SSL** | **Nginx** + **Certbot (Let's Encrypt)** | Gratis, standar industri, banyak dokumentasi |
| **Orkestrasi container** | **Docker Compose** | Cukup untuk 1 VPS; migrasi ke Kubernetes/Swarm baru relevan kalau sudah multi-server |
| **Hosting** | **Azure VM (VPS)** | Sesuai keputusan — biaya tetap per bulan, kontrol penuh |
| **CDN/Proteksi** | **Cloudflare (free plan)** di depan VPS | Tetap dipakai walau tanpa Vercel — proteksi DDoS, caching aset statis, DNS gratis |
| **Payment gateway** | **Midtrans / Xendit** | Tidak berubah — tetap pihak ketiga untuk urusan pembayaran (wajib, demi kepatuhan PCI-DSS) |
| **Email transaksional** | **Resend** (tier gratis terbatas) atau self-host **Postfix/Mailu** | Untuk volume kecil-menengah, layanan pihak ketiga (Resend/SendGrid free tier) tetap lebih praktis daripada self-host SMTP (rawan masuk spam kalau reputasi domain belum terbangun) |
| **Monitoring & error tracking** | **Uptime Kuma** (self-hosted, gratis) + **Sentry self-hosted** (opsional) atau Sentry free tier cloud | Uptime Kuma ringan untuk cek server hidup/mati; Sentry untuk tracking error aplikasi |
| **Backup** | **pg_dump terjadwal (cron)** ke object storage terpisah + **Azure VM snapshot** mingguan | Kombinasi backup logis (database) dan backup fisik (seluruh VM) |

### 6.1 Alternatif Autentikasi Gratis (Pengganti Supabase Auth)

Karena tidak lagi memakai Supabase, berikut opsi autentikasi gratis & open-source, diurutkan dari yang paling cocok untuk kebutuhan LMS single-app di 1 VPS:

| Opsi | Tipe | Cocok untuk | Catatan |
|---|---|---|---|
| **Auth.js (NextAuth.js)** ⭐ Rekomendasi utama | Library yang menyatu langsung di aplikasi Next.js | LMS single-app seperti ini | Gratis 100%, open-source, tinggal dipasang di codebase Next.js, session disimpan di PostgreSQL/Redis sendiri. Mendukung email/password (via credentials provider) + OAuth Google. Tidak perlu container/service tambahan — paling ringan untuk kasus 1 VPS. |
| **Better Auth** | Library serupa Auth.js, TypeScript-first | LMS single-app, alternatif modern dari Auth.js | Gratis, open-source, API lebih modern & fleksibel untuk custom flow (misal: verifikasi email, magic link), komunitas masih lebih kecil dari Auth.js tapi berkembang cepat |
| **Keycloak** | Identity Provider penuh (server terpisah) | Kalau ke depan mau SSO lintas banyak aplikasi (bukan cuma LMS) | Gratis & sangat matang (dikembangkan Red Hat), tapi cukup berat secara resource (butuh RAM lumayan) — kurang ideal kalau hanya untuk 1 aplikasi LMS di VPS yang sama |
| **Authentik** | Identity Provider penuh (server terpisah) | Sama seperti Keycloak, tapi lebih ringan & modern | Gratis, open-source, UI lebih modern dari Keycloak, tapi tetap menambah 1 service terpisah yang perlu di-maintain (butuh PostgreSQL & Redis sendiri juga) |

**Rekomendasi:** gunakan **Auth.js (NextAuth.js)** langsung tertanam di aplikasi Next.js, dengan sesi & data user disimpan di PostgreSQL yang sama dengan data kursus. Ini paling hemat resource untuk skenario 1 VPS + 1 aplikasi, dan tetap mendukung semua kebutuhan di PRD (email/password, OAuth Google, role-based access). Kalau di masa depan platform berkembang jadi beberapa aplikasi terpisah (misal: LMS + aplikasi mobile + portal instruktur terpisah) dan butuh single sign-on lintas aplikasi, baru pertimbangkan migrasi ke **Authentik** sebagai identity provider terpusat.

### 6.2 Alur Autentikasi dengan Auth.js
1. Registrasi/login memanggil endpoint Auth.js di dalam Next.js API routes.
2. Password di-hash (bcrypt/argon2) sebelum disimpan ke tabel `users` di PostgreSQL.
3. Session disimpan di database (Postgres adapter) atau Redis untuk performa lebih cepat, dengan cookie httpOnly + secure.
4. OAuth Google dikonfigurasi via Google Cloud Console (gratis) dan dihubungkan lewat provider bawaan Auth.js.
5. RBAC (role: student/instructor/admin/support) disimpan sebagai kolom di tabel `users`, dicek di middleware Next.js untuk proteksi route.

### 6.3 Video Hosting — Tetap Direkomendasikan Eksternal (dengan Alternatif Self-Hosted)

Ini satu-satunya bagian di mana **tetap disarankan memakai layanan eksternal** meski infrastruktur lain sudah self-hosted, karena:
- Transcoding video (mengubah 1 file jadi berbagai resolusi/adaptive bitrate) sangat membebani CPU — bisa mengganggu performa aplikasi utama yang berjalan di VPS yang sama.
- Streaming video ke banyak siswa sekaligus butuh bandwidth besar dan CDN tersebar geografis — 1 VPS di 1 region Azure tidak akan sekencang CDN video khusus.

**Opsi A (direkomendasikan): Cloudflare Stream atau Mux** — tetap dipakai walau infrastruktur lain self-hosted. Biaya berbasis pemakaian (bayar sesuai menit video yang ditonton), jadi di awal saat siswa masih sedikit, biayanya juga masih kecil.

**Opsi B (full self-hosted, kalau ingin benar-benar tanpa layanan eksternal):**
- Gunakan `ffmpeg` untuk transcode video jadi format HLS (HTTP Live Streaming) saat upload.
- Simpan hasil HLS di MinIO/disk VPS, disajikan lewat Nginx dengan modul `nginx-rtmp` atau langsung sebagai static file HLS.
- **Trade-off:** butuh VPS dengan CPU lebih besar (transcoding berat), bandwidth keluar dari Azure VM juga dikenai biaya per GB (bisa lebih mahal dari layanan streaming khusus kalau trafik tonton tinggi), dan tidak ada CDN bawaan sehingga siswa yang lokasinya jauh dari region Azure VM akan mengalami buffering.

Karena target-nya "cepat go-live dengan fitur lengkap", **Opsi A lebih realistis** — cukup 1 bagian ini yang tetap pakai layanan pihak ketiga, sisanya full self-hosted sesuai keputusan.

---

## 7. Skema Data Utama (Ringkas)

Tidak berubah dari v1.0 — struktur tabel sama, hanya lokasi database yang berubah (PostgreSQL self-hosted, bukan Supabase):

- **users** — id, nama, email, password_hash, role, created_at
- **courses** — id, instructor_id, judul, deskripsi, harga, status, kategori
- **modules** — id, course_id, urutan, judul
- **lessons** — id, module_id, tipe, konten_ref, durasi
- **enrollments** — id, user_id, course_id, status, tanggal_daftar
- **progress** — id, user_id, lesson_id, persen_selesai, last_position
- **quizzes** / **quiz_attempts** — pertanyaan, jawaban, skor
- **certificates** — id, user_id, course_id, nomor_sertifikat, tanggal_terbit
- **transactions** — id, user_id, course_id, jumlah, metode_bayar, status, payment_gateway_ref
- **discussions** — id, lesson_id, user_id, isi, parent_id
- **sessions** — (tabel tambahan untuk Auth.js) id, user_id, expires, session_token

---

## 8. Operasional VPS (Bagian Baru — Tidak Ada di v1.0)

Karena tidak lagi pakai managed hosting, berikut yang perlu disiapkan tim secara eksplisit:

### 8.1 Deployment
- Setup CI/CD sederhana: GitHub Actions yang **build image (app + worker, tag terpisah) di runner → push ke GHCR → SSH ke VPS** untuk `docker compose pull && up -d`. Build **tidak** dilakukan di VPS agar CPU/RAM B2ms tidak terbebani (kecuali deploy pertama kali yang memang build manual di VPS).
- Migrasi database dijalankan di VPS sebagai container one-shot di network internal (Postgres tidak diekspos), sebelum service di-restart; deploy.sh menyertakan health check + rollback otomatis ke image sebelumnya bila gagal.
- Gunakan `docker compose` dengan file `.env` terpisah untuk secret (jangan commit ke repo).

### 8.2 Backup & Disaster Recovery
- `pg_dump` terjadwal (cron harian) → upload ke object storage terpisah (Azure Blob Storage atau bahkan MinIO di VM lain) agar backup tidak hilang bersamaan kalau VPS utama bermasalah.
- Azure VM snapshot mingguan sebagai backup tingkat infrastruktur.
- Uji proses restore secara berkala (backup yang tidak pernah dites restore-nya tidak bisa diandalkan).

### 8.3 Monitoring
- **Uptime Kuma** (self-hosted, gratis) untuk cek endpoint aplikasi & database hidup/mati, dengan notifikasi ke Telegram/email/WhatsApp saat down.
- **Sentry** untuk error tracking aplikasi (bisa pakai free tier cloud Sentry agar tidak perlu resource tambahan di VPS).
- Monitoring resource VM (CPU/RAM/disk) via Azure Monitor bawaan (gratis untuk metrik dasar).

### 8.4 Skalabilitas ke Depan
- **Vertikal dulu:** kalau VPS mulai kewalahan, upgrade ukuran VM (Azure bisa resize tanpa rebuild dari nol).
- **Horizontal kalau sudah perlu:** pisahkan database ke VM/managed Postgres terpisah, tambah VM aplikasi kedua di belakang Azure Load Balancer, baru pertimbangkan orkestrasi lebih canggih (Kubernetes) kalau skala sudah signifikan.

---

## 9. Roadmap Bertahap

### Fase 1 — MVP + Setup Infrastruktur (target: 7–9 minggu)
- Minggu 1–2: provisioning VPS, setup Docker Compose (Postgres, Redis, MinIO, Nginx, SSL), CI/CD dasar.
- Minggu 3–9: auth (Auth.js), katalog kursus, course builder dasar, video player (integrasi Cloudflare Stream/Mux), checkout & pembayaran, progress tracking.

### Fase 2 — Engagement (4–6 minggu setelah MVP)
- Kuis & auto-grading, sertifikat otomatis + verifikasi, forum diskusi, notifikasi email, setup monitoring (Uptime Kuma + Sentry).

### Fase 3 — Growth & Optimisasi
- Kupon/diskon, landing page promosi, integrasi WhatsApp, laporan analitik, backup otomatis matang, hardening keamanan lanjutan.

### Fase 4 — Skala Lanjut (jika trafik besar)
- Evaluasi pemisahan database ke VM terpisah, load balancer + multi-VM, pertimbangkan Kubernetes/Swarm.

---

## 10. Risiko & Mitigasi (Ditambah Risiko Khusus Self-Hosted)

| Risiko | Mitigasi |
|---|---|
| VPS down/crash → seluruh sistem down (single point of failure) | Monitoring + alerting real-time, backup rutin, prosedur restore terlatih, pertimbangkan VM kedua sebagai standby di Fase lanjut |
| Beban kerja DevOps lebih besar dibanding managed service | Automasi sebanyak mungkin (CI/CD, cron backup, unattended-upgrades) agar operasional harian minim campur tangan manual |
| Kebocoran/pembajakan video kursus | Signed URL berdurasi pendek, tetap pakai layanan streaming khusus (bukan file statis biasa) |
| Kegagalan pembayaran/reconciliation | Webhook idempotent + job rekonsiliasi harian |
| Kepatuhan UU PDP dengan data di-manage sendiri | Enkripsi at-rest untuk database, kebijakan akses ketat, dokumentasi prosedur keamanan |
| Human error saat maintenance server (karena semua manual) | SOP tertulis untuk deployment & maintenance, akses SSH dibatasi & di-log |

---

## 11. Estimasi Tim untuk Fase MVP

- 1 Fullstack Developer (Next.js/Node.js)
- 1 orang dengan kemampuan **DevOps dasar** (setup Docker, Nginx, backup, monitoring) — bisa dirangkap oleh fullstack developer kalau familiar dengan Linux server administration
- 1 UI/UX Designer (paruh waktu)
- 1 QA/Tester (paruh waktu)
- 1 Product Owner

> Catatan: dibanding v1.0 (full managed services), pendekatan self-hosted ini butuh kompetensi tambahan di sisi server administration — kalau tim belum punya pengalaman DevOps, pertimbangkan alokasi waktu ekstra 1–2 minggu di Fase 1 khusus untuk setup & pengujian infrastruktur.

---

## 12. Langkah Selanjutnya

> **Status per 25 Juli 2026:** infrastruktur + MVP inti + keandalan dasar **sudah go-live** di `https://gladi.id`. Fokus produk berikutnya: **Dashboard Backend Admin & Instruktur** (§13).

Selesai (ringkas):
1. ~~Provisioning VPS Azure + domain/SSL/Cloudflare~~
2. ~~Docker Compose (app, worker, Postgres, Redis, MinIO, Nginx, Uptime Kuma)~~
3. ~~Auth.js + RBAC + CI/CD + backup/restore + monitoring dasar~~
4. ~~Fitur MVP C/E: katalog, video, materi, Midtrans, learn, kuis, forum, rating, sertifikat, kupon, landing~~
5. ~~Dashboard Admin dasar (stats, user, transaksi, kupon + sidebar) & Dashboard Instruktur dasar (stats, list kursus, progres siswa)~~

Berikutnya (urut prioritas — detail di §13.7):
6. **F0 — Shell Instruktur** — layout sidebar + navigasi konsisten (paritas dengan Admin).
7. **F1 — Course Builder kurikulum** — CRUD modul/lesson + pasang uploader video/materi + kuis builder UI.
8. **F2 — Operasional Instruktur** — diskusi, penilaian essay, filter progres siswa.
9. **F3 — Perluasan Admin** — kelola kursus global, moderasi, laporan/export ringan.
10. **F4 — Hardening panel** — refresh role JWT, pagination/filter, empty/error states, audit trail ringan.

---

## 13. Planning — Dashboard Backend (Admin & Instruktur)

> Dokumen planning digabung di PRD ini agar satu sumber kebenaran.  
> **Tujuan:** menjadikan panel internal (bukan situs publik) cukup lengkap agar Admin mengoperasikan platform dan Instruktur membangun serta mengelola kursus end-to-end tanpa akses langsung ke database.

### 13.1 Definisi & Ruang Lingkup

| Istilah | Arti di proyek ini |
|---|---|
| **Dashboard Backend** | Panel web internal di route `/admin/*` dan `/instructor/*` (bukan micro-service terpisah) |
| **Admin Panel** | Operasi platform: user, transaksi, kupon, oversight kursus, moderasi, laporan |
| **Instructor Panel** | Operasi konten: course builder, upload, kuis, siswa, diskusi, penilaian |
| **Shell** | Layout sidebar + header identitas role + navigasi bersama |

**In scope (F0–F4):** shell, authoring kurikulum, wiring upload/kuis, operasional instruktur, perluasan admin, hardening UX/RBAC panel.

**Out of scope (fase ini):** portal Support/CS penuh, live class, chat real-time, SCORM/LTI, multi-gateway Xendit, redesign brand landing publik, mobile app native.

### 13.2 Baseline Saat Ini (sudah ada di kode)

| Area | Status | Lokasi utama |
|---|---|---|
| Admin shell (sidebar) | Ada | `app/src/app/admin/layout.tsx` — Dashboard, User, Transaksi, Kupon |
| Admin overview | Ada | `/admin` + `getAdminStats()` |
| Admin user/role | Ada | `/admin/users` + `PATCH /api/admin/users/[id]` |
| Admin transaksi | Ada | `/admin/transactions` (read-only list) |
| Admin kupon | Ada | `/admin/coupons` + API CRUD |
| Instructor overview | Ada | `/instructor/dashboard` + `getInstructorStats()` |
| Instructor course metadata | Ada | `/instructor/courses` (+ new/edit) — draft/publish/archive |
| Instructor student progress | Ada | `/instructor/courses/[id]/students` |
| Instructor shell (sidebar) | **Belum** | Tidak ada `instructor/layout.tsx` |
| CRUD modul/lesson UI | **Belum** | Schema + read path ada; tidak ada insert/update UI |
| Video/Material uploader di UI | **Parsial** | Komponen ada; belum terpasang di halaman instruktur |
| Kuis builder UI | **Parsial** | API `POST /api/instructor/quizzes/[lessonId]` ada; UI authoring belum |
| Penilaian essay | **Belum** | Auto-grade menunda skor essay; tidak ada UI/API grade manual |
| Moderasi diskusi (panel) | **Parsial** | API resolve/delete ada; belum ada inbox instruktur/admin |
| Kelola kursus global (admin) | **Belum** | Admin bisa lihat semua di list instruktur jika role admin, tapi tidak ada halaman admin khusus |

### 13.3 Prinsip Desain Panel

1. **Satu app, dua shell** — Admin dan Instruktur tetap di Next.js yang sama; beda prefix route + RBAC.
2. **Defense in depth** — middleware route + `requireRole` / `requireInstructor` di page/API + ownership check (`courses.instructorId`).
3. **Admin boleh masuk area instruktur** — untuk support; data tetap difilter konteks (milik kursus / global sesuai halaman).
4. **Server-first** — page SSR + Server Actions / Route Handlers; hindari dashboard SPA terpisah.
5. **Reuse komponen yang sudah ada** — `VideoUploader`, `MaterialUploader`, `QuizPanel` (mode author), pola sidebar Admin.
6. **Satu job per halaman** — overview ≠ tabel manajemen ≠ builder kurikulum.
7. **Tidak menambah service baru** — tidak ada admin-BFF terpisah; API tetap di `app/src/app/api`.

### 13.4 Information Architecture

#### Admin (`/admin`)

| Route | Tujuan | Prioritas |
|---|---|---|
| `/admin` | Overview statistik + aktivitas terkini | Ada (refine F3/F4) |
| `/admin/users` | Manajemen role user | Ada |
| `/admin/transactions` | Rekonsiliasi & support pembayaran | Ada (+ filter F3) |
| `/admin/coupons` | CRUD kupon | Ada |
| `/admin/courses` | Oversight semua kursus (status, instruktur, force archive) | F3 |
| `/admin/moderation` | Antrian diskusi/report ringan | F3 |
| `/admin/reports` | Laporan pendapatan/enrollment (rentang tanggal, export CSV) | F3 |

#### Instruktur (`/instructor`)

| Route | Tujuan | Prioritas |
|---|---|---|
| `/instructor/dashboard` | Overview milik instruktur | Ada (+ shell F0) |
| `/instructor/courses` | Daftar kursus + aksi status | Ada |
| `/instructor/courses/new` | Buat metadata kursus | Ada |
| `/instructor/courses/[id]/edit` | Edit metadata | Ada |
| `/instructor/courses/[id]/curriculum` | **Builder modul & lesson** | **F1 (inti)** |
| `/instructor/courses/[id]/students` | Progres siswa | Ada (+ filter F2) |
| `/instructor/courses/[id]/discussions` | Inbox diskusi per kursus | F2 |
| `/instructor/courses/[id]/grading` | Antrian essay belum dinilai | F2 |
| `/instructor/quizzes/[lessonId]` | Editor kuis (atau embedded di curriculum) | F1 |

**Navigasi shell Instruktur (F0):** Dashboard · Kursus Saya · (konteks kursus muncul sebagai sub-nav di halaman kurikulum).

### 13.5 Spesifikasi Fitur

#### A. Shell & Akses (F0)

| ID | Requirement | Acceptance |
|---|---|---|
| A1 | `instructor/layout.tsx` dengan sidebar + email user | Paritas UX dengan Admin; non-instructor/admin di-redirect |
| A2 | Highlight nav aktif berdasarkan pathname | Link aktif visually distinct |
| A3 | Admin tetap bisa akses `/instructor/*` | Tidak 403; ownership tetap dihormati untuk mutasi konten orang lain kecuali mode admin eksplisit |
| A4 | Link masuk panel dari `/dashboard` atau header (role-aware) | Student tidak melihat link Admin/Instructor |

#### B. Course Builder Kurikulum (F1) — *critical path*

| ID | Requirement | Acceptance |
|---|---|---|
| B1 | CRUD modul: judul, `sort_order`, drag/reorder atau naik-turun | Modul tersimpan; urutan konsisten di `/learn` & katalog |
| B2 | CRUD lesson: tipe `video` \| `text` \| `quiz` \| `assignment`, judul, urutan, teks konten (untuk `text`) | Lesson muncul di learn page sesuai tipe |
| B3 | Pasang `VideoUploader` pada lesson video → confirm → `content_ref = cf:{uid}` | Playback di `/learn` berhasil untuk enrolled |
| B4 | Pasang `MaterialUploader` pada lesson text/file → `content_ref = s3:{key}` | Download signed URL jalan |
| B5 | UI kuis builder memanggil API instructor quizzes | Soal MC/T-F/essay tersimpan; siswa bisa submit |
| B6 | Guard ownership: hanya owner (atau admin) yang mutasi kurikulum | User lain mendapat 403 |
| B7 | Validasi publish: blokir/peringatkan publish bila kursus tanpa modul/lesson | UX jelas; tidak memutus alur draft |

**API baru yang dibutuhkan (F1):**

| Method | Path | Fungsi |
|---|---|---|
| `GET/POST` | `/api/instructor/courses/[id]/modules` | List / buat modul |
| `PATCH/DELETE` | `/api/instructor/modules/[moduleId]` | Update / hapus (+ cascade lesson) |
| `POST` | `/api/instructor/modules/[moduleId]/lessons` | Buat lesson |
| `PATCH/DELETE` | `/api/instructor/lessons/[lessonId]` | Update / hapus lesson |
| `POST` | `/api/instructor/modules/reorder` (atau batch PATCH) | Reorder modul/lesson |

> Endpoint video/material/quiz yang sudah ada **dipakai ulang**; F1 fokusanya menghubungkan UI + menambah CRUD struktur.

#### C. Operasional Instruktur (F2)

| ID | Requirement | Acceptance |
|---|---|---|
| C1 | Inbox diskusi per kursus (filter unresolved) | Instruktur resolve/hapus dari panel |
| C2 | Halaman grading essay: list attempt `submitted` dengan soal essay | Instruktur input skor + feedback; status jadi `graded` |
| C3 | Progres siswa: filter by status / search nama-email | Tabel tetap usable saat enrollment banyak |
| C4 | Ringkasan per siswa: lesson selesai / total, last activity | Satu klik dari daftar siswa |

**API baru (F2):**

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/instructor/courses/[id]/discussions` | List thread kursus |
| `GET` | `/api/instructor/courses/[id]/grading` | List attempt perlu dinilai |
| `PATCH` | `/api/instructor/quiz-attempts/[id]` | Set skor essay + feedback |

#### D. Perluasan Admin (F3)

| ID | Requirement | Acceptance |
|---|---|---|
| D1 | `/admin/courses` — list semua kursus, filter status/instruktur | Admin bisa archive / unpublish |
| D2 | Filter transaksi: status, rentang tanggal, search ref/email | Support bisa temukan order cepat |
| D3 | `/admin/moderation` — thread diskusi terbaru / flagged sederhana | Hapus konten melanggar tanpa SQL |
| D4 | `/admin/reports` — pendapatan & enrollment per periode + export CSV | File CSV terunduh; angka cocok dengan stats |

#### E. Hardening Panel (F4)

| ID | Requirement | Acceptance |
|---|---|---|
| E1 | Refresh role di session setelah admin ubah role (re-issue JWT / force re-login hint) | Role baru berlaku tanpa kebingungan akses |
| E2 | Pagination + empty/error states di semua tabel panel | Tidak ada list tak terbatas tanpa kontrol |
| E3 | Audit log ringan (opsional): siapa mengubah role / status kursus | Queryable di DB atau log terstruktur |
| E4 | Konsistensi visual shell Admin ↔ Instruktur | Spacing, typography, nav pattern selaras |

### 13.6 Model Data & Aturan Bisnis (relevan panel)

Tidak ada migrasi besar di F0–F1 (schema sudah mendukung modul/lesson/quiz). F2 mungkin menambah kolom:

| Perubahan | Kapan | Keterangan |
|---|---|---|
| `quiz_attempts.feedback` (text, nullable) | F2 | Feedback instruktur untuk essay |
| `quiz_attempts.graded_by` / `graded_at` | F2 | Jejak penilai |
| `discussions.is_flagged` (boolean) | F3 opsional | Antrian moderasi sederhana |
| Tabel `admin_audit_logs` | F4 opsional | `actor_id`, `action`, `entity`, `payload`, `created_at` |

**Aturan:**
- Mutasi kurikulum hanya owner atau `admin`.
- Publish kursus: status `published` hanya jika ada ≥1 lesson (peringatan keras di F1; enforce di API di F4 bila perlu).
- Essay: skor awal `null`; course completion / certificate tidak mengandalkan essay belum dinilai kecuali passing rule eksplisit (tetap perilaku MVP: auto-grade hanya MC/T-F).
- Admin tidak dapat mengubah role dirinya sendiri (sudah ada — dipertahankan).

### 13.7 Fase Pengerjaan

| Fase | Nama | Deliverable utama | Ketergantungan |
|---|---|---|---|
| **F0** | Shell Instruktur | `instructor/layout.tsx`, nav, link role-aware | Tidak ada |
| **F1** | Course Builder | Halaman kurikulum + API modul/lesson + wiring uploader & kuis | F0 disarankan |
| **F2** | Operasional Instruktur | Diskusi inbox, grading essay, filter siswa | F1 (butuh lesson/quiz nyata) |
| **F3** | Perluasan Admin | Courses oversight, filter transaksi, moderasi, reports CSV | F0; F1 opsional |
| **F4** | Hardening | JWT role refresh, pagination, audit, polish | Setelah F1–F3 inti |

**Urutan implementasi yang disarankan:** F0 → F1 → F2 → F3 → F4.  
F3 (admin courses/filter) bisa diparalelkan dengan F2 setelah F0 selesai.

### 13.8 Non-Goals & Keputusan yang Ditunda

| Topik | Keputusan untuk fase ini |
|---|---|
| App admin terpisah (domain `admin.gladi.id`) | Ditunda — tetap path `/admin` di app yang sama |
| WYSIWYG kaya (block editor) untuk lesson text | Markdown/textarea dulu; editor kaya nanti |
| Drag-and-drop library berat | Naik/turun urutan cukup di F1; DnD boleh menyusul |
| Assignment submission penuh | Lesson type `assignment` boleh dibuat; alur pengumpulan file siswa ditunda |
| Portal Support (`/support`) | Di luar scope §13; role tetap ada di enum |
| Realtime dashboard (WebSocket) | Tidak — poll/SSR refresh cukup |

### 13.9 Risiko & Mitigasi (khusus panel)

| Risiko | Mitigasi |
|---|---|
| Instruktur tidak bisa jual konten karena builder belum ada | Prioritaskan F1 sebagai critical path |
| Hapus modul cascade menghapus progress siswa | Konfirmasi UI + soft-warning; pertimbangkan block delete jika ada progress (F4) |
| Admin salah unpublish kursus berbayar | Konfirmasi + audit log (F4) |
| Upload video gagal di VPS kecil | Tetap direct-to-Cloudflare (TUS); UI progress/error jelas |
| Role JWT stale setelah promosi user | E1 di F4; interim: minta re-login setelah ubah role |

### 13.10 Kriteria Penerimaan Global (§13)

Panel dianggap **siap dipakai operasional konten** bila:

1. Instruktur membuat kursus → menambah modul/lesson → upload video/materi → buat kuis → publish → siswa enrolled bisa belajar end-to-end **tanpa intervensi SQL/MinIO manual**.
2. Admin mengelola user, transaksi, kupon, dan dapat men-unpublish/archive kursus bermasalah dari UI.
3. Semua route panel terlindungi RBAC; ownership lesson/kursus ditegakkan di API.
4. Tidak ada regresi pada alur publik: katalog, checkout, `/learn`, sertifikat, webhook Midtrans.
5. Typecheck + lint + build CI hijau setelah tiap fase.

### 13.11 Pelacak Eksekusi Singkat

Gunakan checklist ini saat implementasi (boleh dipindah ke `EXECUTION-STEPS-*.md` terpisah, tetapi spesifikasi tetap mengacu ke §13):

| ID | Item | Fase | Status |
|---|---|---|---|
| P1 | Shell sidebar instruktur | F0 | ⬜ |
| P2 | API + UI CRUD modul/lesson + reorder | F1 | ⬜ |
| P3 | Wiring VideoUploader + MaterialUploader di kurikulum | F1 | ⬜ |
| P4 | UI kuis builder (instructor) | F1 | ⬜ |
| P5 | Inbox diskusi instruktur | F2 | ⬜ |
| P6 | Grading essay + kolom feedback | F2 | ⬜ |
| P7 | Admin courses oversight | F3 | ⬜ |
| P8 | Filter transaksi + reports CSV | F3 | ⬜ |
| P9 | Refresh role session + pagination tabel | F4 | ⬜ |

---

*Akhir PRD v2.1 — planning Dashboard Backend Admin & Instruktur.*
