# Langkah Eksekusi — LMS 1 VPS Azure

Pelacak progres implementasi dari `.kilo/plans/1784731820560-lms-single-vps-cost-optimized-plan.md`.
Setiap langkah dijalankan **hanya setelah Anda memerintahkan**. Status: `TODO` → `IN PROGRESS` → `DONE`.

Legend status: ⬜ TODO | 🔵 IN PROGRESS | ✅ DONE | ⏭️ SKIPPED | ⚠️ BLOCKED

---

## Tahap A — Persiapan Lokal (bisa dikerjakan sekarang, tanpa akses Azure)

| # | Langkah | Output | Status |
|---|---|---|---|
| A1 | Rename `PRD-Platform-LMS-Kursus-Digital-v2-SelfHosted.md` → `PRD.md` | File `PRD.md` di root | ✅ |
| A2 | Tulis `docker-compose.yml` + `.env.example` + `.gitignore` (service: nginx, app, postgres, redis, minio, worker, uptime-kuma; memory limit & healthcheck per service) | File compose siap pakai | ✅ |
| A3 | Tulis konfigurasi Nginx (reverse proxy + SSL) + Dockerfile `app` & `worker` | `nginx/`, `Dockerfile` | ✅ |
| A4 | Inisialisasi Next.js + TypeScript + Tailwind + DrizzleORM | Folder `app/` jalan lokal | ✅ |
| A5 | Skema database (migrasi awal, tabel sesuai PRD §7) | File migrasi | ✅ |
| A6 | Auth.js: credentials + Google OAuth + RBAC middleware | Login/logout jalan | ✅ |
| A7 | CI/CD GitHub Actions (build image di runner → GHCR → SSH deploy) | `.github/workflows/deploy.yml` | ✅ |

> Catatan A7: pipeline aktif setelah secrets `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY` diisi di repo GitHub (Settings → Secrets → Actions) pada Tahap B6. File terkait: `scripts/deploy.sh` (pull → migrasi → restart → health check + rollback), `app/scripts/migrate.ts`, `app/src/worker/index.ts` (placeholder worker untuk target Docker), script `build:worker` di package.json.
| A8 | Skrip backup `pg_dump` → Azure Blob + rotasi 14 hari | `scripts/backup.sh` + `scripts/restore.sh` | ✅ |

> Catatan A8: `backup.sh` (dump custom format → upload REST Blob + SAS → rotasi 14 hari → exit non-zero bila gagal) dan `restore.sh` (restore backup terbaru/tertentu, recreate DB, verifikasi jumlah tabel). Bagian dump→restore lokal sudah diuji terhadap Postgres 16 Docker (16 tabel pulih, data utuh). Bagian upload/rotasi Blob butuh kredensial `AZURE_STORAGE_*` yang diisi saat provisioning (Tahap B). Aktivasi cron harian ada di langkah D1.

## Tahap B — Provisioning Azure (dikerjakan oleh Anda, butuh akses Azure/Cloudflare)

> **Cara pakai:** Kerjakan satu langkah per satu waktu mengikuti panduan di bawah tabel.
> Setelah selesai, **isi kolom "Hasil Anda"** dengan nilai yang diminta (IP, nama VM, dll.)
> dan ubah Status ⬜ → ✅. Saat Anda memberi perintah berikutnya, saya membaca kolom
> tersebut untuk melanjutkan pekerjaan (mis. mengisi `.env`, menguji koneksi).

| # | Langkah | Output yang Diharapkan | Hasil Anda (isi di sini) | Status |
|---|---|---|---|---|
| B1 | Buat VM B2ms Ubuntu 24.04 + disk data 64GB + Static IP | VM aktif, IP publik statis | IP: `70.153.16.78` / Nama VM: `vm-gladi-lms` / Region: `
Indonesia Central` | ✅ |
| B2 | NSG: buka 80/443; SSH port custom dibatasi IP admin | Aturan firewall aktif | Port SSH: `2020` / IP admin: `...` | ✅ |
| B3 | Hardening OS (user non-root, SSH key-only, ufw, fail2ban, unattended-upgrades, swap 4GB) | Server aman | User SSH: `deploy` / SSH key: `sudah` | ✅ |
| B4 | Install Docker + mount disk data | Docker siap | Versi Docker: `29.6.2` | ✅ |
| B5 | Cloudflare: A record → IP VPS, proxy ON, SSL Full (strict) | Domain resolving ke VPS | Domain: `gladi.id` | ✅ |
| B6 | Deploy compose pertama + Certbot SSL + isi secrets GitHub | https://domain hidup, CI/CD aktif | URL aktif: `...` / Secrets GitHub: `sudah/belum` | ⬜ |

---

### B1 — Buat VM Azure (± 15 menit, semua di Portal Azure)

1. Buka https://portal.azure.com → **Virtual Machines** → **Create** → **Azure virtual machine**.
2. **Basics:**
   - Subscription: pilih langganan Anda.
   - Resource group: **Create new** → nama `gladi-lms-rg`.
   - VM name: `gladi-lms-vm`.
   - Region: **Southeast Asia** (Singapura — terdekat ke Indonesia; jika habis kuota, pilih `Australia East` atau `East Asia`).
   - Availability options: **No infrastructure redundancy required** (paling murah).
   - Image: **Ubuntu Server 24.04 LTS - x64 Gen2**.
   - Size: klik **See all sizes** → cari **B2ms** (2 vCPU, 8 GB RAM). Kalau tidak ada, B2s dulu, resize nanti.
   - Authentication: **SSH public key** → username `azureuser` → **Generate new key pair** → nama `gladi-lms-key`.
   - Public inbound ports: pilih **None** (SSH dibuka manual di B2 dengan port custom).
3. **Disks:**
   - OS disk: **Premium SSD (locally-redundant)**, ukuran default (127 GB) — biarkan.
   - Klik **Create and attach a new disk** → nama `gladi-lms-data` → size **64 GiB Premium SSD** → **LRS**.
4. **Networking:**
   - Virtual network: biarkan default (akan dibuat otomatis, mis. `gladi-lms-rg-vnet`).
   - Public IP: **Create new** → nama `gladi-lms-ip` → SKU **Standard** → Assignment **Static** ← penting agar IP tidak berubah saat VM restart.
   - NIC network security group: **Basic** → Public inbound ports: **None**.
5. **Management / Monitoring / Advanced / Tags:** biarkan default. (Opsional: di Monitoring, matikan Boot diagnostics jika ingin hemat sedikit biaya storage.)
6. **Review + create** → validasi lolos → **Create**.
7. Saat muncul dialog **Generate new key pair** → klik **Download private key and create resource** → simpan file `gladi-lms-key.pem` **baik-baik** (ini satu-satunya kunci SSH awal; jangan hilang, jangan commit ke git).
8. Tunggu deployment selesai → **Go to resource** → di halaman Overview catat **Public IP address**.

**Isi kolom Hasil Anda:** IP publik, nama VM, region.

---

### B2 — Aturan Firewall NSG (± 5 menit)

1. Di halaman VM `gladi-lms-vm` → menu kiri **Networking** → **Network settings**.
2. Klik tab **Inbound port rules** pada bagian NSG (nama NSG biasanya `gladi-lms-vm-nsg`).
3. **Tambah rule SSH custom** (port 2222, dibatasi IP Anda):
   - Klik **+ Add inbound port rule**.
   - Source: **IP Addresses** → Source IP: **IP publik Anda saat ini** (cek di https://whatismyip.com, format `x.x.x.x/32`). *Catatan: jika IP ISP Anda dinamis, nanti perbarui rule ini bila berubah.*
   - Source port ranges: `*`
   - Destination: **Any**
   - Destination port ranges: `2222` ← port SSH custom kita
   - Protocol: **TCP** / Action: **Allow**
   - Priority: `100` / Name: `allow-ssh-admin`
   - Klik **Add**.
4. **Tambah rule HTTP:**
   - **+ Add inbound port rule** → Source: **Any** → Destination port: `80` → TCP → Allow → Priority `110` → Name `allow-http` → Add.
5. **Tambah rule HTTPS:**
   - Sama seperti HTTP tapi Destination port `443` → Priority `120` → Name `allow-https` → Add.

**Isi kolom Hasil Anda:** port SSH yang dipakai (`2222`) dan IP admin yang didaftarkan.

---

### B3 — Hardening OS (± 20 menit, via SSH)

1. Dari terminal lokal Anda (PowerShell boleh):
   ```powershell
   ssh -i $env:USERPROFILE\Downloads\gladi-lms-key.pem azureuser@<IP_VPS>
   ```
   *(Ganti `<IP_VPS>` dengan IP dari B1. Jika file .pem disimpan di tempat lain, sesuaikan path.)*
2. Setelah masuk, jalankan perintah berikut satu per satu (blok bisa disalin sekaligus):
   ```bash
   # --- 1. User non-root untuk deploy ---
   sudo adduser --disabled-password --gecos "" deploy
   sudo usermod -aG sudo deploy
   
   # --- 2. Pasang SSH key Anda juga untuk user deploy ---
   sudo mkdir -p /home/deploy/.ssh
   sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
   sudo chown -R deploy:deploy /home/deploy/.ssh
   sudo chmod 700 /home/deploy/.ssh
   sudo chmod 600 /home/deploy/.ssh/authorized_keys
   
   # --- 3. Pindah SSH ke port 2222 + matikan password login & root login ---
   sudo sed -i 's/^#\?Port .*/Port 2222/' /etc/ssh/sshd_config
   sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
   sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
   sudo systemctl restart ssh
   
   # --- 4. Firewall OS (ufw) ---
   sudo ufw allow 2222/tcp comment 'SSH custom'
   sudo ufw allow 80/tcp comment 'HTTP'
   sudo ufw allow 443/tcp comment 'HTTPS'
   sudo ufw --force enable
   
   # --- 5. fail2ban (anti brute-force) ---
   sudo apt update
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   
   # --- 6. Auto-update patch keamanan ---
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades   # pilih Yes
   
   # --- 7. Swap 4GB (pengaman RAM B2ms) ---
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. **PENTING — uji login baru SEBELUM menutup sesi lama:** buka terminal lokal BARU, lalu:
   ```powershell
   ssh -i $env:USERPROFILE\Downloads\gladi-lms-key.pem -p 2222 deploy@<IP_VPS>
   ```
   Kalau berhasil masuk sebagai `deploy`, hardening berhasil. Tutup sesi `azureuser` yang lama.
4. Verifikasi cepat (dari sesi `deploy`):
   ```bash
   sudo ufw status        # harus menampilkan 2222, 80, 443 allowed
   free -h                # baris Swap harus 4.0Gi
   sudo systemctl status fail2ban --no-pager   # active (running)
   ```

**Isi kolom Hasil Anda:** username SSH yang dipakai (`deploy`) dan konfirmasi SSH key sudah jalan.

---

### B4 — Install Docker + Mount Disk Data (± 15 menit, via SSH sebagai `deploy`)

1. **Format & mount disk data 64GB:**
   ```bash
   # Cari nama disk data (biasanya /dev/sdc — yang 64G dan belum termount)
   lsblk
   
   # Format (GANTI /dev/sdc sesuai hasil lsblk! Hanya untuk disk BARU kosong)
   sudo mkfs.ext4 /dev/sdc
   
   # Mount permanen ke /data
   sudo mkdir -p /data
   sudo blkid /dev/sdc   # salin UUID-nya
   echo 'UUID=<UUID_DARI_BLKID> /data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
   sudo mount -a
   df -h /data   # harus menampilkan ~63G ter-mount
   ```
2. **Install Docker (repo resmi):**
   ```bash
   # Dependensi + GPG key
   sudo apt update
   sudo apt install -y ca-certificates curl
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg
   
   # Tambahkan repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   
   # Install Docker Engine + Compose plugin
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   
   # User deploy boleh menjalankan docker tanpa sudo
   sudo usermod -aG docker deploy
   ```
3. **Pindahkan data Docker ke disk /data** (agar OS disk tidak penuh oleh image & volume):
   ```bash
   sudo systemctl stop docker docker.socket containerd
   sudo mkdir -p /data/docker
   sudo mv /var/lib/docker/* /data/docker/ 2>/dev/null || true
   echo '{ "data-root": "/data/docker" }' | sudo tee /etc/docker/daemon.json
   sudo systemctl start docker
   ```
4. **Verifikasi** (logout-login dulu agar grup docker aktif: ketik `exit`, SSH ulang, lalu):
   ```bash
   docker version
   docker compose version
   docker run --rm hello-world
   docker info | grep "Docker Root Dir"   # harus: /data/docker
   ```

**Isi kolom Hasil Anda:** versi Docker yang terpasang (dari `docker version`, mis. `29.x`).

---

### B5 — Cloudflare DNS (± 10 menit; prasyarat: domain sudah terdaftar & nameserver mengarah ke Cloudflare)

1. Login https://dash.cloudflare.com → pilih domain Anda.
   *(Jika domain belum di Cloudflare: **Add site** → masukkan domain → pilih **Free plan** → ganti nameserver di registrar domain Anda ke 2 nameserver yang diberikan Cloudflare → tunggu aktif, bisa menit hingga jam.)*
2. Menu **DNS** → **Records** → **Add record**:
   - Type: **A**
   - Name: `@` (atau subdomain, mis. `lms` → jadi `lms.domainanda.com`)
   - IPv4 address: **IP VPS dari B1**
   - Proxy status: **Proxied** (awan ORANYE) ← wajib, untuk proteksi DDoS & cache
   - TTL: Auto → **Save**.
3. Menu **SSL/TLS** → **Overview** → pilih mode **Full (strict)** ← wajib, karena Nginx kita punya sertifikat Let's Encrypt sendiri.
4. Menu **SSL/TLS** → **Edge Certificates** → pastikan **Always Use HTTPS** = ON.
5. Verifikasi DNS (dari PowerShell lokal):
   ```powershell
   nslookup domainanda.com
   ```
   IP yang muncul adalah IP **Cloudflare** (104.x / 172.x) — itu NORMAL karena proxy aktif. Domain sudah benar mengarah.

**Isi kolom Hasil Anda:** domain lengkap yang dipakai (mis. `lms.domainanda.com`).

---

### B6 — Deploy Pertama + SSL + Secrets GitHub (± 30 menit)

**Bagian 1 — Siapkan aplikasi di VPS (SSH sebagai `deploy`):**
```bash
# Clone repo
cd ~
git clone https://github.com/katahugo/gladi-lms.git
cd gladi-lms

# Buat .env dari template lalu edit
cp .env.example .env
nano .env
```
Isi minimal (tekan Ctrl+O, Enter, Ctrl+X untuk simpan di nano):
- `APP_DOMAIN` = domain dari B5
- `APP_URL` = `https://<domain>`
- `AUTH_SECRET` = hasil dari `openssl rand -base64 32` (jalankan di terminal, salin hasilnya)
- `POSTGRES_USER` = `lms`
- `POSTGRES_PASSWORD` = password kuat (mis. dari `openssl rand -base64 24`)
- `POSTGRES_DB` = `gladi_lms`
- `REDIS_PASSWORD` = password kuat lain
- `MINIO_ROOT_USER` = `minioadmin`
- `MINIO_ROOT_PASSWORD` = password kuat lain (min 8 karakter)
- Variabel lain (Cloudflare Stream, Midtrans, Resend, Azure Blob) — bisa diisi belakangan saat Tahap C/D.

**Bagian 2 — Start database dulu + migrasi:**
```bash
cd ~/gladi-lms
docker compose up -d postgres redis minio
docker compose ps   # tunggu sampai postgres "healthy"
```

**Bagian 3 — SSL dengan konfigurasi bootstrap:**
```bash
cd ~/gladi-lms
# Pakai config HTTP-only dulu (blok 443 gagal kalau sertifikat belum ada)
mkdir -p /tmp/nginx-backup
cp nginx/templates/lms.conf.template /tmp/nginx-backup/
cp nginx/lms.conf.bootstrap nginx/templates/lms.conf.template

# PENTING: gunakan --no-deps agar compose TIDAK ikut menaikkan dependensi
# (app/postgres/redis/minio) yang belum siap — tanpa ini compose menunggu
# dependensi "healthy" dan container macet di status "Created".
docker compose up -d --no-deps nginx

# Pastikan nginx healthy dulu (wajib, agar webroot challenge bisa dilayani):
docker compose exec nginx wget -q -O- http://localhost/health   # harus: ok

# Terbitkan sertifikat — gunakan service "certbot-issue" (TANPA override
# entrypoint, jadi argumen Anda benar-benar dijalankan).
# PENTING: JANGAN pakai "docker compose run certbot certbot certonly ..." —
# service "certbot" punya entrypoint renew-loop yang MENGABAIKAN semua argumen
# (container akan menggantung tanpa melakukan apa-apa). Subcommand "certonly"
# diletakkan di AKHIR setelah flag-flagnya.
docker compose run --rm --no-deps certbot-issue \
  -d <DOMAIN_ANDA> \
  --email <EMAIL_ANDA> --agree-tos --no-eff-email \
  --webroot -w /var/www/certbot \
  certonly
# Harus muncul "Successfully received certificate"

# Setelah sertifikat terbit, start certbot renew-loop (otomatis perpanjang tiap 12 jam):
docker compose up -d --no-deps certbot
```

**Bagian 4 — Aktifkan config HTTPS penuh:**
```bash
# Kembalikan config HTTPS penuh (yang ada blok 443), ganti yang bootstrap:
cp /tmp/nginx-backup/lms.conf.template nginx/templates/lms.conf.template

# Recreate nginx (bukan sekadar restart) agar template HTTPS ter-render ulang:
docker compose up -d --no-deps --force-recreate nginx

# Verifikasi HTTPS sudah hidup (sertifikat yang baru terbit dipakai):
curl -sI https://<DOMAIN_ANDA> | head -3   # harus 200/301/302, bukan error SSL
```

**Bagian 5 — Jalankan seluruh komponen:**
*(Sementara CI/CD belum ada image, build `app` langsung di VPS — hanya untuk deploy pertama. Setelah CI/CD aktif, build selalu di CI runner.)*
```bash
cd ~/gladi-lms

# 1. Naikkan database & pendukung DULU, tunggu healthy (penting: app butuh ini)
docker compose up -d postgres redis minio
docker compose ps            # tunggu sampai postgres/redis/minio "healthy"

# 2. Build image app (pertama kali butuh beberapa menit)
docker compose build app

# 3. Migrasi database SEBELUM app dinyalakan penuh
#    (pakai run one-shot di network internal, bukan exec ke app yang belum jalan)
set -a; source .env; set +a
docker compose run --rm --no-deps \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  app npx drizzle-kit migrate

# 4. Naikkan app + worker + nginx + certbot renew-loop + uptime-kuma
docker compose up -d

# 5. Verifikasi menyeluruh
docker compose ps                          # semua harus Up/healthy
curl -s http://localhost/api/health        # lewat nginx lokal → {"status":"ok",...}
curl -s https://<DOMAIN_ANDA>/api/health   # lewat Cloudflare+SSL → {"status":"ok",...}
```

**Bagian 6 — Isi secrets GitHub agar CI/CD (A7) aktif:**
1. Di VPS: `cat ~/.ssh/authorized_keys` — pastikan ada key Anda. Pipeline butuh key **khusus deploy**; buat yang baru:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N "" -C "github-actions"
   cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/github-deploy   # SALIN seluruh isi private key ini
   ```
2. Di browser: repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, buat 4 secrets:
   - `VPS_HOST` = IP VPS dari B1
   - `VPS_USER` = `deploy`
   - `VPS_PORT` = `2222`
   - `VPS_SSH_KEY` = isi private key yang disalin di atas
3. Uji pipeline: push commit apa pun ke `main` (atau di GitHub: tab **Actions** → workflow **deploy** → **Run workflow**) → pantau sampai 3 job hijau.

**Isi kolom Hasil Anda:** URL aktif (mis. `https://lms.domainanda.com`) dan status secrets GitHub.

---

> **Troubleshooting cepat B6:**
> - **Certbot menggantung / tidak melakukan apa-apa** → hampir pasti Anda menjalankan `docker compose run certbot certbot certonly ...` (service `certbot` yang entrypoint-nya renew-loop dan mengabaikan argumen). Solusi: gunakan `certbot-issue` — lihat Bagian 3.
> - **Container macet di status "Created"** → penyebab: `docker compose up`/`run` tanpa `--no-deps` ikut menaikkan dependensi (app/postgres/redis/minio) yang belum siap. Solusi: selalu pakai `--no-deps` pada langkah bootstrap.
> - **Container stuck "health: starting"** → tunggu 10–20 detik lalu `docker compose ps` lagi; kalau tetap, `docker compose logs <service>`.
> - Certbot gagal "connection refused/timeout" → cek NSG (B2) membuka port 80 dari Any, dan DNS (B5) sudah resolve.
> - `curl https://domain` error sertifikat → mode SSL Cloudflare belum **Full (strict)** (B5 langkah 3).
> - `docker compose ps` ada yang "unhealthy" → `docker compose logs <service>` lalu kabari saya outputnya.
> - **Minio "unhealthy"** saat bootstrap → normal jika baru pertama up (butuh waktu init); tidak masalah karena langkah bootstrap pakai `--no-deps`.
> - **`docker compose exec app ...` gagal "container not running"** → app belum Up. Lakukan migrasi via `run --rm --no-deps` seperti Bagian 5 langkah 3 (jangan `exec` ke app yang belum jalan).
> - **App "unhealthy" setelah up** → hampir selalu migrasi belum dijalankan atau `DATABASE_URL` salah. Cek `docker compose logs app`.
> - **`curl https://domain` 502 Bad Gateway** → nginx jalan tapi app belum/mati. Cek `docker compose ps app` dan `docker compose logs app`.

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

**Urutan perintah yang disarankan:** ~~A1–A8~~ (selesai) → **B1–B6 oleh Anda** (isi kolom "Hasil Anda" di tiap langkah) → C1–C5 → D1–D5 → E1+.
Perintah cukup sebutkan kodenya, misal: "kerjakan C1" atau "B1 sudah, lanjut B2".
