# Langkah Eksekusi — Dashboard Admin

Pelacak progres implementasi sidebar navigasi admin + update PRD.
Status: `TODO` → `IN PROGRESS` → `DONE`.

Legend status: ⬜ TODO | 🔵 IN PROGRESS | ✅ DONE | ⏭️ SKIPPED | ⚠️ BLOCKED

---

## Tahap A — Navigasi Sidebar Admin

| # | Langkah | Output | Status |
|---|---|---|---|
| A1 | Buat `admin/layout.tsx` dengan sidebar navigasi | Sidebar 4 link + proteksi role | ✅ |
| A2 | Hapus link manual di `admin/page.tsx` | Dashboard tanpa link "Kelola/Lihat semua" | ✅ |
| A3 | Tambah spesifikasi dashboard di `PRD.md` §3 | PRD diperbarui | ✅ |

---

### A1 — Layout Admin dengan Sidebar

**File:** `app/src/app/admin/layout.tsx` (baru)

Server component dengan `auth()` untuk cek role admin — non-admin di-redirect ke `/`. Sidebar 224px (w-56) berisi:

- **Header:** "Admin Panel" + email admin yang sedang login (`session.user.email`)
- **4 nav link:** Dashboard (`/admin`), User (`/admin/users`), Transaksi (`/admin/transactions`), Kupon (`/admin/coupons`)
- **Footer:** "Kembali ke Situs" → `/`

Layout otomatis me-wrap semua halaman di bawah `/admin/*` — halaman `users`, `transactions`, `coupons` tidak perlu diubah satu per satu.

Setiap halaman individu tetap memanggil `requireRole(["admin"])` sebagai defense-in-depth (lapisan kedua setelah guard di layout).

---

### A2 — Hapus Link Manual

**File:** `app/src/app/admin/page.tsx` (edit)

- Menghapus `import Link from "next/link"` (tidak lagi digunakan)
- Menghapus `<Link href="/admin/users">Kelola semua</Link>` dari section User Terbaru
- Menghapus `<Link href="/admin/transactions">Lihat semua</Link>` dari section Transaksi Terkini
- Section header disederhanakan dari `flex items-center justify-between` menjadi heading `<h2>` biasa
- 6 stat cards + daftar user terbaru + daftar transaksi terkini tetap dipertahankan

---

### A3 — Update PRD.md

**File:** `PRD.md` (edit)

§3 "Ruang Lingkup Fitur" diperbarui — bullet singkat "Dashboard admin & instruktur + laporan" diganti dengan 5 bullet spesifik:
- **Dashboard Admin** — statistik global, daftar user terbaru, transaksi terkini, sidebar navigasi
- **Manajemen User** — tabel semua user, dropdown ubah role (admin tidak bisa ubah role sendiri)
- **Manajemen Transaksi** — tabel dengan order ref/kursus/user/jumlah/metode/status
- **Manajemen Kupon** — form buat + daftar kupon (aktif/nonaktif/hapus)
- **Dashboard Instruktur** — statistik kursus miliknya, enrollment, pendapatan, sertifikat

---

## Validasi

| # | Item | Hasil |
|---|---|---|
| 1 | `npx tsc --noEmit` | ✅ Lulus |
| 2 | `npm run lint` | ✅ Lulus |
| 3 | `npm run build` | ✅ Lulus |
| 4 | Verifikasi live `https://gladi.id/admin` | ⬜ Perlu deploy |
