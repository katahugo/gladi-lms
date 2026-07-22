# PRD — Platform LMS Penjualan Kursus Digital
**Versi:** 2.0 — Self-Hosted di Azure VPS
**Status:** Draft untuk validasi
**Skala target:** Produksi (production-grade), fitur lengkap, infrastruktur self-managed

> Perubahan dari v1.0: seluruh infrastruktur (aplikasi + database) dipindahkan ke **1 VPS Azure milik sendiri**, tidak lagi memakai Vercel maupun Supabase. Autentikasi memakai library open-source gratis, bukan Supabase Auth.

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
- Dashboard admin & instruktur + laporan
- Notifikasi email (+ opsional WhatsApp)
- SEO & landing page promosi

*(Detail lengkap tiap fitur mengikuti PRD v1.0 — tidak diulang di sini agar dokumen fokus pada perubahan arsitektur.)*

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
| **VM Series** | Azure **B-series** (contoh: Standard_B4ms — 4 vCPU, 16GB RAM) untuk tahap awal produksi |
| **OS** | Ubuntu Server 24.04 LTS |
| **Storage** | Premium SSD, minimal 128GB (pisahkan disk data untuk volume Docker/database agar mudah di-resize) |
| **Networking** | Azure NSG (Network Security Group) — hanya buka port 22 (SSH, dibatasi IP tertentu), 80, 443 |
| **Static IP** | Azure Public IP (static) agar domain & DNS stabil |

> Catatan: B-series cocok karena sifatnya *burstable* (murah saat idle, bisa burst saat trafik naik) — cocok untuk LMS yang traffic-nya tidak konstan sepanjang hari. Kalau nanti pemakaian CPU konsisten tinggi, pertimbangkan pindah ke D-series.

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
- SSH hanya via key-based auth (disable password login), port SSH idealnya diubah dari default 22.
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
- Setup CI/CD sederhana: GitHub Actions yang SSH ke VPS, `git pull` + `docker compose up -d --build` saat ada push ke branch `main`.
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

1. Provisioning VPS Azure (pilih ukuran VM, region terdekat dengan mayoritas target siswa).
2. Setup domain + Cloudflare (DNS & proteksi) mengarah ke IP VPS.
3. Bangun `docker-compose.yml` awal: Nginx, Next.js app, PostgreSQL, Redis, MinIO.
4. Implementasi Auth.js di codebase Next.js.
5. Tentukan pilihan final video hosting (Cloudflare Stream vs Mux) berdasarkan estimasi jam tonton bulanan.
6. Setup backup terjadwal & monitoring sebelum go-live (jangan ditunda sampai setelah launching).
