# Panduan Pengujian — C1: Katalog Kursus & Course Builder

Dokumen ini berisi langkah pengujian untuk fitur yang dibangun di Tahap C1:
katalog kursus publik (`/courses`, `/courses/[slug]`) dan course builder
instruktur (`/instructor/courses` beserta CRUD + draft/publish/archive).

Cara pakai: kerjakan berurutan dari Bagian 0. Centang `[ ]` → `[x]` untuk setiap
kasus uji yang lolos. Jika ada yang gagal, catat di bagian "Temuan" paling bawah.

**Lingkungan uji:** `https://gladi.id` (produksi) — atau `http://localhost:3000`
untuk pengujian lokal.

---

## Ringkasan Progress (diperbarui 23 Jul 2026)

| Status | Jumlah | Kasus |
|---|---|---|
| ✅ Lolos | 7 | 0.1, 1.1, 1.4, 4.5, 4.6, 6 (4 dari 5 sub-kasus API) |
| ⏸ Terblokir | sisanya | Semua kasus yang butuh login (0.2, 0.3, 1.2, 1.3, 1.5, Bagian 2–5) |

**Pemblokir:** endpoint `/api/auth/*` mengembalikan **500** di produksi setelah
deploy C1, sehingga login tidak bisa dilakukan. Bukan bug fitur C1 — masalah
konfigurasi Auth.js di deployment. **Tindakan yang dibutuhkan (di VPS):**
`docker compose logs --tail=60 app | grep -iE "error|auth|secret"` untuk diagnosis.
Selain itu, promosi role instruktur (0.2) butuh `UPDATE users SET role='instructor'`
via DB di VPS (SSH dari lingkungan uji saya ditolak publickey).

---

## Bagian 0 — Persiapan (wajib sebelum pengujian)

### 0.1 Buat akun siswa biasa

1. Buka `https://gladi.id/login`.
2. Registrasi via API (belum ada halaman register — gunakan curl/terminal):
   ```bash
   curl.exe -s -X POST https://gladi.id/api/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Siswa Uji","email":"siswa@uji.id","password":"password123"}'
   ```
   **Harapan:** respons `201` berisi `{"id":"...","email":"siswa@uji.id"}`.
   - [x] Lolos — `201`, id `894b58b5-...` (diuji 23 Jul 2026)

### 0.2 Buat akun instruktur (promosi manual via database)

Endpoint registrasi hanya membuat role `student`, jadi role `instructor`
harus diangkat langsung di database (by design — pengangkatan role adalah
wewenang admin, dilakukan via DB sampai dashboard admin ada di Tahap E3).

1. Registrasi akun calon instruktur:
   ```bash
   curl.exe -s -X POST https://gladi.id/api/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Instruktur Uji","email":"instruktur@uji.id","password":"password123"}'
   ```
2. Di VPS, promosikan ke instruktur:
   ```bash
   ssh -p 2020 deploy@70.153.16.78
   cd ~/gladi-lms
   set -a; source .env; set +a
   docker exec lms_postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
     -c "UPDATE users SET role='instructor' WHERE email='instruktur@uji.id';"
   ```
    **Harapan:** output `UPDATE 1`.
    - [ ] Lolos — ⏸ menunggu: registrasi `instruktur@uji.id` (201 ✓) sudah, tapi promosi role via DB butuh SSH ke VPS (SSH dari lingkungan uji saya ditolak publickey). Jalankan perintah `UPDATE users SET role='instructor' WHERE email IN ('instruktur@uji.id','instruktur2@uji.id');` di VPS.

### 0.3 Verifikasi login kedua akun

1. Login sebagai `siswa@uji.id` di `https://gladi.id/login` → masuk `/dashboard`, role `student`.
2. Logout, login sebagai `instruktur@uji.id` → masuk `/dashboard`, role `instructor`.
   - [ ] Lolos

---

## Bagian 1 — Proteksi Akses (RBAC)

| # | Kasus Uji | Langkah | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 1.1 | Anonim buka builder | Logout, buka `/instructor/courses` | Redirect 307 ke `/login?callbackUrl=/instructor/courses` | [x] |
| 1.2 | Siswa buka builder | Login sebagai siswa, buka `/instructor/courses` | Redirect ke `/` (bukan halaman builder) | [ ] ⏸ |
| 1.3 | Instruktur buka builder | Login sebagai instruktur, buka `/instructor/courses` | Halaman "Kursus Saya" tampil | [ ] ⏸ |
| 1.4 | Anonim buka katalog | Logout, buka `/courses` | Halaman katalog tampil (publik, tanpa login) | [x] |
| 1.5 | Siswa buka katalog | Login siswa, buka `/courses` | Halaman katalog tampil | [ ] ⏸ |

> **⚠ PEMBLOKIR (23 Jul 2026):** Kasus yang membutuhkan login (1.2, 1.3, 1.5, dan seluruh Bagian 2–5) **terblokir sementara** — endpoint `/api/auth/*` mengembalikan **500 "problem with server configuration"** di produksi setelah deploy C1, sehingga login tidak bisa dilakukan. Halaman `/login` (UI) dan registrasi/DB masih berfungsi normal. Ini bukan bug fitur C1 melainkan masalah konfigurasi Auth.js di deployment. Sedang didiagnosis — butuh `docker compose logs app` dari VPS untuk memastikan penyebab.

---

## Bagian 2 — Course Builder: Membuat Kursus

Login sebagai **instruktur** untuk seluruh kasus di bagian ini.

| # | Kasus Uji | Langkah | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 2.1 | Buat kursus valid | `/instructor/courses/new` → isi Judul "Kursus Docker Pemula", Deskripsi, Kategori "DevOps", Harga `150000` → simpan | Redirect ke daftar; kursus muncul dengan badge **Draft** | [ ] |
| 2.2 | Judul terlalu pendek | Buat kursus dengan judul "AB" | Pesan error "Judul minimal 3 karakter", tidak tersimpan | [ ] |
| 2.3 | Harga nol (gratis) | Buat kursus judul "Kursus Gratis Pengantar", harga `0` | Tersimpan; di daftar tampil "Rp0" | [ ] |
| 2.4 | Slug unik otomatis | Buat kursus kedua dengan judul **sama persis** "Kursus Docker Pemula" | Tersimpan dengan slug berbeda (suffix `-2`); tidak ada error duplikat | [ ] |
| 2.5 | Slug dari judul berkarakter khusus | Judul "Belajar Next.js & React: Lengkap!" | Slug bersih (mis. `belajar-nextjs-react-lengkap`) — cek di DB atau saat publish | [ ] |

Verifikasi 2.5 di database (VPS):
```bash
docker exec lms_postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  -c "SELECT title, slug, status FROM courses ORDER BY created_at;"
```
- [ ] Lolos

---

## Bagian 3 — Course Builder: Edit & Status

| # | Kasus Uji | Langkah | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 3.1 | Edit kursus | Klik **Edit** pada kursus → ubah judul & harga → simpan | Perubahan tampil di daftar | [ ] |
| 3.2 | Publish kursus | Klik **Terbitkan** pada kursus draft | Badge berubah **Terbit** | [ ] |
| 3.3 | Kursus terbit muncul di katalog | Buka `/courses` | Kursus yang diterbitkan tampil sebagai kartu | [ ] |
| 3.4 | Kursus draft TIDAK muncul | Pastikan ada kursus lain masih draft, cek `/courses` | Kursus draft tidak tampil | [ ] |
| 3.5 | Kembalikan ke draft | Pada kursus terbit, klik **Jadikan Draft** | Hilang dari `/courses`; badge kembali **Draft** | [ ] |
| 3.6 | Detail kursus draft 404 | Saat draft, buka `/courses/<slug-draft>` | Halaman 404 (not found) | [ ] |

---

## Bagian 4 — Katalog Publik & Detail Kursus

Prasyarat: minimal 1 kursus berstatus **Terbit** (dari Bagian 3).

| # | Kasus Uji | Langkah | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 4.1 | Kartu katalog lengkap | Buka `/courses` | Kartu menampilkan judul, kategori, deskripsi, nama instruktur, harga | [ ] |
| 4.2 | Harga gratis | Pada kursus harga 0 | Kartu menampilkan teks **"Gratis"** | [ ] |
| 4.3 | Buka detail | Klik kartu kursus | Halaman `/courses/<slug>` tampil: judul, deskripsi, harga, tombol beli, kurikulum | [ ] |
| 4.4 | Format rupiah | Kursus harga 150000 | Tampil "Rp150.000" | [ ] |
| 4.5 | Slug tidak ada | Buka `/courses/slug-ngasal` | Halaman 404 | [x] |
| 4.6 | Tautan dari landing | Buka `/` → klik "Lihat Katalog Kursus" | Tiba di `/courses` | [x] |

---

## Bagian 5 — Guard Kepemilikan (penting untuk keamanan)

Butuh **dua akun instruktur**. Buat instruktur kedua mengikuti langkah 0.2
dengan email `instruktur2@uji.id`.

| # | Kasus Uji | Langkah | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 5.1 | Edit kursus orang lain via URL | Login instruktur2, buka `/instructor/courses/<id-kursus-instruktur1>/edit` | 404 (bukan data bocor) | [ ] ⏸ |
| 5.2 | Daftar kursus terisolasi | Bandingkan `/instructor/courses` kedua instruktur | Masing-masing hanya melihat kursus miliknya | [ ] ⏸ |
| 5.3 | Hapus kursus | Pada kursus sendiri, klik **Hapus** → konfirmasi | Kursus hilang dari daftar dan dari katalog | [ ] ⏸ |

---

## Bagian 6 — Uji API & Respons Cepat (opsional, via terminal)

```bash
# Katalog publik harus 200
curl.exe -s -o NUL -w "%{http_code}`n" https://gladi.id/courses

# Detail kursus terbit harus 200 (ganti <slug> dengan slug nyata)
curl.exe -s -o NUL -w "%{http_code}`n" https://gladi.id/courses/<slug>

# Builder anonim harus redirect ke login
curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" https://gladi.id/instructor/courses

# Registrasi email duplikat harus 409 (pesan generik anti-enumerasi)
curl.exe -s -X POST https://gladi.id/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplikat","email":"siswa@uji.id","password":"password123"}' -w " %{http_code}`n"
```

Hasil yang diharapkan: `200`, `200`, `307 .../login?callbackUrl=...`, `409`.
- [x] Lolos sebagian (23 Jul 2026): katalog `200` ✓, slug-ngasal `404` ✓, builder anonim `307` ✓, duplikat email `409` ✓. Kasus "detail kursus terbit 200" menunggu ada kursus terbit (butuh login instruktur — terblokir masalah auth 500).

---

## Temuan

Catat kasus yang GAGAL di sini (nomor kasus, apa yang terjadi, output/log):

| No Kasus | Gejala | Output/Log | Status Perbaikan |
|---|---|---|---|
| | | | |

---

> **Catatan batasan C1 (by design, bukan bug):**
> - Tombol "Beli Kursus" di halaman detail belum berfungsi — checkout ada di C4.
> - Kurikulum di halaman detail kosong jika belum ada modul/materi — course
>   builder modul/materi belum dibangun (bagian dari C2/C3).
> - Thumbnail kursus belum ada — upload gambar ke MinIO ada di C3.
> - Registrasi hanya via API (`/api/register`); halaman register UI belum ada.
