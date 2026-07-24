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
| B6 | Deploy compose pertama + Certbot SSL + isi secrets GitHub | https://domain hidup, CI/CD aktif | URL aktif: `https://gladi.id` (health OK) / Secrets GitHub: `sudah` / CI/CD: `aktif (run #17 sukses)` | ✅ |

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

# 2. Build image app dan worker dengan tag TERPISAH (jangan timpa image app
#    yang sedang berjalan — compose menandai keduanya ':latest' bila dibangun
#    bersamaan, dan build terakhir yang menang):
docker compose build app
docker tag ghcr.io/katahugo/gladi-lms/app:latest lms-local/app:latest
docker compose build worker
docker tag ghcr.io/katahugo/gladi-lms/worker:latest lms-local/worker:latest

# 3. Migrasi database SEBELUM app dinyalakan penuh
#    (pakai run one-shot di network internal, bukan exec ke app yang belum jalan)
set -a; source .env; set +a
APP_IMAGE=lms-local/app:latest docker compose run --rm --no-deps \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  app node migrate.mjs

# 4. Naikkan app + worker + nginx + certbot renew-loop + uptime-kuma
#    dengan tag lokal yang sudah dipisah:
APP_IMAGE=lms-local/app:latest WORKER_IMAGE=lms-local/worker:latest docker compose up -d

# 5. Verifikasi menyeluruh
docker compose ps                          # semua harus Up/healthy
curl -s http://localhost/api/health        # lewat nginx lokal → {"status":"ok",...}
curl -s https://<DOMAIN_ANDA>/api/health   # lewat Cloudflare+SSL → {"status":"ok",...}
```

**Bagian 6 — Isi secrets GitHub agar CI/CD (A7) aktif:**
*(Catatan: langkah ini tersisa — pipeline belum aktif sampai 4 secrets diisi. Setelah itu, deploy tidak lagi manual di VPS.)*
1. Di VPS: `cat ~/.ssh/authorized_keys` — pastikan ada key Anda. Pipeline butuh key **khusus deploy**; buat yang baru:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N "" -C "github-actions"
   cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/github-deploy   # SALIN seluruh isi private key ini
   ```
2. Di browser: repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, buat 4 secrets:
   - `VPS_HOST` = IP VPS dari B1
   - `VPS_USER` = `deploy`
   - `VPS_PORT` = port SSH dari B2 (deployment ini: `2020`)
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

### Ringkasan Deployment Aktual (vm-gladi-lms — Indonesia Central)

Berhasil go-live pada 23 Jul 2026. Nilai nyata yang dipakai:

| Aspek | Nilai Aktual |
|---|---|
| IP publik | `70.153.16.78` (Static) |
| Nama VM / Region | `vm-gladi-lms` / Indonesia Central |
| Domain | `gladi.id` (Cloudflare proxied, SSL Full strict) |
| Port SSH custom | `2020` (dibatasi IP admin di NSG) |
| User SSH | `deploy` |
| Versi Docker | `29.6.2` |
| URL health publik | `https://gladi.id/api/health` → `{"status":"ok"}` |
| Service berjalan | nginx, app, worker, postgres, redis, minio, certbot (semua Up) |

**Pelajaran penting yang memperbaiki error selama deployment (terdokumentasi agar tidak terulang):**

1. **`/health` 404** → `default.conf` bawaan image nginx mencuri request `Host: localhost`. Diperbaiki dengan `nginx/templates/default.conf.template` kosong yang menimpa bawaan + `default_server` + IPv6.
2. **Nginx crash saat bootstrap** → `upstream app:3000` gagal resolve ketika app belum ada. Diperbaiki dengan `resolver 127.0.0.11` + `proxy_pass` via variabel (lazy resolve).
3. **Certbot menggantung** → entrypoint renew-loop service `certbot` mengabaikan argumen `certonly`. Diperbaiki dengan service `certbot-issue` terpisah (tanpa override entrypoint).
4. **Container macet "Created"** → `docker compose up/run` tanpa `--no-deps` ikut menaikkan dependensi yang belum siap. Solusi: selalu `--no-deps` pada langkah bootstrap.
5. **`lms_app` menjalankan `worker.js`** → service `app` tidak menentukan `target: app`, jadi `build` memakai target terakhir Dockerfile (worker). Diperbaiki dengan `target: app` + `command: ["node","server.js"]`.
6. **`URIError: URI malformed` pada Redis** → `REDIS_URL` menginterpolasi password mentah berkarakter khusus. Diperbaiki dengan kredensial terpisah `REDIS_HOST/PORT/PASSWORD`.
7. **`MODULE_NOT_FOUND /app/worker.js`** → `app` dan `worker` berbagi tag `app:latest`; build bersamaan menimpa satu sama lain. Diperbaiki dengan tag terpisah `app:latest` vs `worker:latest` (compose, CI/CD, deploy.sh diselaraskan).

**Tersisa dari B6:** Bagian 6 (isi 4 secrets GitHub: `VPS_HOST=70.153.16.78`, `VPS_USER=deploy`, `VPS_PORT=2020`, `VPS_SSH_KEY`). Setelah itu pipeline CI/CD (A7) aktif dan deploy tidak lagi manual.

**Update 23 Jul 2026 — Bagian 6 SELESAI, CI/CD aktif.** Secrets terisi, pipeline hijau (run #17). Setiap build image kini juga ditandai timestamp **GMT+7 (WIB)** format `YYYYMMDD-HHMMSS` (mis. `worker:20260723-131519`) + label `build-time-wib`, terlihat di GHCR. Pelajaran tambahan yang diperbaiki selama aktivasi CI/CD:
8. **SSH gagal 1.8 dtk** → public key deploy belum terdaftar di `/home/deploy/.ssh/authorized_keys`.
9. **`cd: /home/deploy/gladi-lms: No such file`** → repo awalnya di `/root/gladi-lms`; dipindah ke `/home/deploy/` + workflow dibuat auto-clone bila belum ada.
10. **`cd: /root/gladi-lms` saat dijalankan root** → `APP_DIR` kini ditentukan dari lokasi skrip, bukan `$HOME`.
11. **`Cannot find module 'drizzle-kit'`** → migrasi dipindah ke `migrate.mjs` (drizzle-orm, di-bundle esbuild ESM) — drizzle-kit adalah devDependency, tidak ada di image produksi.
12. **`Cannot find package 'drizzle-orm'`** → `migrate.mjs` di-bundle esbuild jadi file mandiri; node_modules standalone tidak menyertakannya.
13. **`URIError: URI malformed` Postgres** → sama seperti Redis — kredensial kini field terpisah `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` di `migrate.mjs`, `db/index.ts`, compose, deploy.sh.
14. **`No file drizzle/0000_init.sql`** (root cause paling licin) → pola `*.sql` di `.gitignore` (untuk dump DB) ikut mengabaikan file migrasi Drizzle sehingga tak pernah ter-commit. Diperbaiki dengan `!**/drizzle/**/*.sql`.
15. **Cache CI basi** → `BUILD_SHA` build-arg sebelum `COPY . .` di Dockerfile agar layer context ter-invalidate tiap commit.

## Tahap C — Fitur Inti MVP (lokal, setelah A4–A6)

| # | Langkah | Output | Status |
|---|---|---|---|
| C1 | Katalog kursus + course builder (draft/publish) | CRUD kursus | ✅ |
| C2 | Integrasi Cloudflare Stream (interface `VideoProvider`) | Upload & play video | ✅ |
| C3 | Upload materi ke MinIO (signed URL) | Unduh/upload materi | ✅ |
| C4 | Checkout Midtrans/Xendit + webhook idempotent | Transaksi sandbox sukses | ✅ |
| C5 | Enrollment otomatis + progress tracking | Progres siswa tercatat | ✅ |

## Tahap D — Keandalan (wajib sebelum go-live)

| # | Langkah | Output | Status |
|---|---|---|---|
| D1 | Aktifkan backup harian ke Blob (cron) + snapshot mingguan | Backup terjadwal | ✅ |
| D2 | Uji restore sekali + dokumentasi SOP | SOP restore terbukti | ✅ |
| D3 | Uptime Kuma monitor + Sentry + alert Azure Monitor | Alert berjalan | 🔵 |
| D4 | Job BullMQ: rekonsiliasi pembayaran, sertifikat, email | Worker berjalan | ✅ |
| D5 | Load test ringan + checklist validasi akhir (plan §6) | Sistem tervalidasi | ✅ |

---

### D1 — Aktifkan Backup Harian + Snapshot Mingguan

D1 membutuhkan **Storage Account Azure** (tempat menyimpan backup). Ada dua bagian:
1. **Anda di Azure Portal** — buat Storage Account + SAS token (5 menit)
2. **VPS** — jalankan `scripts/setup-backup.sh` yang otomatis memasang cron

**Bagian 1 — Azure Blob Storage (5 menit, di portal):**

1. Buka `https://portal.azure.com` → **Storage accounts** → **Create**.
2. **Basics:**
   - Resource group: `gladi-lms-rg` (yang sama dengan VM).
   - Storage account name: `gladilmsbackup` (atau nama unik, lowercase saja, tanpa strip).
   - Region: **Indonesia Central** (sama dengan VM — agar transfer internal Azure gratis).
   - Performance: **Standard**.
   - Redundancy: **LRS (locally-redundant)** — paling murah, cukup untuk backup.
3. **Advanced** → pilih **Allow enabling anonymous access** = off (default aman) — biarkan semua default.
4. **Review + create** → tunggu deployment selesai.
5. Masuk ke storage account → menu **Containers** → **+ Container** → nama `lms-backups` → **Private** → **Create**.
6. Menu **Shared Access Signature** (di sidebar kiri, bagian "Security + networking"):
   - Allowed services: **Blob**
   - Allowed resource types: **Service**, **Container**, **Object** ← **WAJIB ketiganya dicentang!** (tanpa Object, PUT blob ditolak 403)
   - Allowed permissions: centang **Read**, **Write**, **Delete**, **List** ← **keempatnya wajib!**
   - Start date: biarkan (atau tanggal hari ini)
   - Expiry date: 2 tahun dari sekarang
   - **Allowed IP addresses**: biarkan kosong dulu (nanti bila 403, tambahkan IP VPS Anda)
   - Klik **Generate SAS and connection string**
7. Salin 3 nilai:
   - **Blob service SAS URL** → ambil token setelah tanda tanya `?sv=...` — ini adalah **`AZURE_STORAGE_SAS_TOKEN`** (tanpa tanda tanya depan)
   - **Storage account name** → **`AZURE_STORAGE_ACCOUNT`**
   - Container name → sudah kita buat: `lms-backups` → **`AZURE_STORAGE_CONTAINER`**

**Bagian 2 — Di VPS (2 menit, SSH sebagai `deploy`):**

```bash
cd ~/gladi-lms
git fetch origin main && git reset --hard origin/main

# Isi 3 variabel Azure di .env (pakai nano):
nano .env
```
Tambahkan di akhir file .env:
```
AZURE_STORAGE_ACCOUNT=gladilmsbackup
AZURE_STORAGE_CONTAINER=lms-backups
# PENTING: SAS token mengandung karakter & — WAJIB dibungkus kutip TUNGGAL (').
# Tanpa kutip, karakter & dianggap command separator oleh bash dan variabel
# tidak akan terdefinisi (error "wajib diisi di .env" padahal sudah diisi).
AZURE_STORAGE_SAS_TOKEN='sv=2025-01-05&ss=b&srt=sco&sp=rwdl&se=2028-07-23T...&sig=...'
```
Simpan (Ctrl+O, Enter, Ctrl+X). Lalu:
```bash
# Jalankan setup otomatis (verifikasi + pasang cron + uji backup pertama)
./scripts/setup-backup.sh
```
Harus muncul: **"Backup pertama BERHASIL! D1 selesai."**

**Bagian 3 — Snapshot VM mingguan (di portal, 2 menit):**

1. Buka portal Azure → VM `vm-gladi-lms` → menu **Disks** → klik disk OS (`gladi-lms-vm_OsDisk_1_...`) → **+ Create snapshot**.
2. Nama: biarkan default (timestamp) → Resource group: `gladi-lms-rg` → **Create**.
3. Untuk otomatisasi: buat **Automation account** atau cukup buat manual setiap minggu (proses ini 2 menit dan perlu Anda lakukan berkala).

**Verifikasi backup berhasil:**
```bash
# Cek log backup
tail -20 /var/log/lms-backup.log
# Harus: "Backup SELESAI: pgdump-gladi_lms-20260724T...dump ter-upload aman."
```

> **Troubleshooting D1:**
> - **HTTP 403 AuthorizationFailure** → paling sering karena SAS token dibuat tanpa **Object** di resource types (perbaiki: generate ulang SAS dengan Service + Container + **Object** dicentang semua) ATAU firewall Storage Account memblokir IP VPS (perbaiki: Storage Account → Networking → Firewall → tambahkan IP VPS `70.153.16.78` ke allow list, atau set "Enabled from all networks").
> - **`AZURE_STORAGE_SAS_TOKEN wajib diisi` padahal sudah ada** → SAS token mengandung karakter `&` — bungkus dengan kutip TUNGGAL: `AZURE_STORAGE_SAS_TOKEN='sv=...'`.
> - **Backup berhasil tapi cron tidak jalan** → `crontab -l | grep gladi-lms` (harus menampilkan 1 baris); `systemctl status cron` (harus active).

- [ ] Backup pertama sukses
- [ ] Cron terpasang (`crontab -l | grep gladi-lms-backup` menampilkan 1 baris)
- [ ] Snapshot VM pertama tersimpan di portal

---

### D2 — Uji Restore & Dokumentasi SOP

Uji restore membuktikan backup bisa dipulihkan — backup yang tidak pernah dites restore-nya tidak bisa diandalkan (PRD §8.2).

**PENTING:** restore bersifat **destruktif** — menghapus database yang sedang berjalan dan menggantinya dengan backup. Lakukan di jam sepi (malam/pagi). Aplikasi akan restart otomatis setelah restore selesai.

**Langkah uji restore di VPS (SSH sebagai `deploy`):**

```bash
cd ~/gladi-lms
git fetch origin main && git reset --hard origin/main

# Restore dari backup terbaru:
./scripts/restore.sh
```

Skrip akan:
1. Mencari backup terbaru di Azure Blob
2. Menampilkan nama backup dan meminta konfirmasi `YA`
3. Download backup → drop database → recreate → `pg_restore`
4. Verifikasi jumlah tabel (minimal 10)
5. Jalankan migrasi untuk memastikan skema up-to-date
6. Restart app + worker + health check

**Verifikasi setelah restore:**
```bash
# Cek aplikasi hidup
curl -s http://localhost/api/health

# Login masih berfungsi? (data user dari backup terpulihkan)
curl -s -c /tmp/ck.txt https://gladi.id/api/auth/csrf | grep csrfToken

# Cek jumlah user di database (harus sama seperti sebelum restore):
set -a; source .env; set +a
docker exec lms_postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  -c "SELECT count(*) AS total_users FROM users;"
```

**SOP Restore (simpan di tempat terpisah / catat):**

| Skenario | Tindakan |
|---|---|
| **Database korup / tidak sengaja terhapus** | `./scripts/restore.sh` — pilih backup terbaru |
| **Restore ke titik waktu tertentu** | `./scripts/restore.sh pgdump-gladi_lms-20260722T020000Z.dump` |
| **Restore gagal (tabel < 10)** | Cek backup lain: list blob di Azure Portal (container `lms-backups`) → pilih file lain yang ukurannya wajar (> 10KB) |
| **Setelah restore, login gagal** | `AUTH_SECRET` mungkin berubah — pastikan `.env` tidak ikut ter-overwrite |
| **Aplikasi tidak bisa konek DB** | `docker compose logs app` — kemungkinan `pg_hba.conf` atau password berubah |

> **Catatan keandalan:** Uji restore sebaiknya dilakukan **berkala** (mis. sebulan sekali) untuk memastikan prosedur tetap berfungsi seiring perubahan skema database. Backup yang tidak pernah dites restore-nya tidak bisa diandalkan.

- [ ] Restore dari backup terbaru berhasil
- [ ] Jumlah tabel ≥ 10
- [ ] Aplikasi sehat setelah restore (`/api/health` OK)
- [ ] Login masih berfungsi
- [ ] SOP restore dicatat/didokumentasikan

---

### D3 — Uptime Kuma + Sentry + Azure Monitor Alert

D3 mengaktifkan 3 lapis monitoring:
1. **Uptime Kuma** (self-hosted) — cek aplikasi hidup/mati tiap menit, notifikasi via Telegram
2. **Sentry** (cloud free tier) — tracking error aplikasi (exception, crash)
3. **Azure Monitor** — alert resource VM (CPU > 85%, RAM > 85%, disk > 80%)

---

**1. Uptime Kuma (sudah ada di compose — tinggal dikonfigurasi via browser)**

Uptime Kuma sudah berjalan di container `lms_uptime_kuma`, UI di `http://localhost:3001` (hanya bisa diakses via SSH tunnel karena hanya bind 127.0.0.1).

Akses Uptime Kuma:
```bash
# Di laptop Anda (PowerShell), buat SSH tunnel:
ssh -L 3001:localhost:3001 -p 2020 deploy@70.153.16.78

# Buka browser → http://localhost:3001
# Setup akun admin (pertama kali)
```

**Update: Uptime Kuma kini bisa diakses langsung via browser** di `https://monitoring.gladi.id` (tanpa SSH tunnel). Lihat langkah provisioning SSL monitoring di bawah.

Tambahkan 2 monitor:
1. **Aplikasi web:**
   - Monitor type: **HTTP(s)**
   - URL: `https://gladi.id/api/health`
   - Heartbeat interval: 60 detik
   - Resend notification: 3 kali gagal berturut-turut
2. **Database:**
   - Monitor type: **HTTP(s)**
   - URL: `https://gladi.id/api/health/db`
   - Heartbeat interval: 120 detik

Setup notifikasi (opsional): Settings → Notifications → Telegram bot token + chat ID.

---

**2. Sentry — error tracking**

Sentry SDK sudah terpasang di kode (`instrumentation.ts` + `next.config.ts`). Hanya perlu DSN:

1. Buka `https://sentry.io` → sign up (free tier: 5K events/bulan, cukup untuk LMS kecil-menengah).
2. Create project → platform **Next.js** → salin **DSN** (format: `https://xxx@sentry.io/xxx`).
3. Di VPS, tambahkan ke `.env`:
   ```bash
   cd ~/gladi-lms
   echo 'SENTRY_DSN=https://xxx@sentry.io/xxx' >> .env
   docker compose restart app
   ```
4. Uji: kunjungi halaman yang tidak ada (`https://gladi.id/xxx`) → cek dashboard Sentry, error 404 (atau exception) akan muncul dalam beberapa detik.

**Konfigurasi di kode:**
- `tracesSampleRate`: 0.1 (10% sampel) di production — hemat kuota free tier
- Tanpa `SENTRY_DSN`, sentry tetap terinisialisasi tapi no-op (tidak mengirim apa pun)

---

**3. Azure Monitor Alert (CPU/RAM/disk)**

Buka portal Azure → VM `vm-gladi-lms` → **Alerts** → **Create alert rule**:

| Alert | Sinyal | Threshold | Evaluasi |
|---|---|---|---|
| CPU tinggi | Percentage CPU | > 85% (rata-rata 5 menit) | Cek tiap 5 menit |
| RAM tinggi | Available Memory Bytes | < 512 MB | Cek tiap 5 menit |
| Disk penuh | Used Space Percentage | > 80% (OS disk) | Cek tiap 15 menit |

Action group: buat baru → notifikasi email ke `hugoirwanto@gmail.com` (atau email Anda).

---

**Verifikasi monitoring aktif:**
- [ ] Uptime Kuma: monitor aplikasi + DB aktif, status hijau
- [ ] Uptime Kuma: bisa diakses via `https://monitoring.gladi.id`
- [ ] Sentry: DSN terisi di `.env`, error muncul di dashboard
- [ ] Azure Monitor: 3 alert rule terbuat

---

### Provisioning SSL untuk Monitoring (sekali jalan)

Setelah DNS `monitoring.gladi.id` sudah dibuat (A record → `70.153.16.78`, Cloudflare proxied ON), jalankan di VPS:

```bash
cd ~/gladi-lms
git fetch origin main && git reset --hard origin main

# Jalankan provisioning SSL untuk monitoring
./scripts/provision-monitoring-ssl.sh hugoirwanto@gmail.com
```

Skrip akan:
1. Menerbitkan sertifikat Let's Encrypt untuk `monitoring.gladi.id`
2. Reload Nginx dengan blok server monitoring
3. Verifikasi akses `https://monitoring.gladi.id`

Setelah itu, buka `https://monitoring.gladi.id` di browser — Uptime Kuma akan menampilkan halaman setup akun admin (pertama kali). Isi username/email + password untuk membuat akun, lalu tambahkan 2 monitor seperti panduan di atas.

**Keamanan Uptime Kuma:**
- **Autentikasi bawaan** — Uptime Kuma punya sistem login sendiri (username + password). Tidak perlu mekanisme tambahan.
- Akses port 3001 sudah dihapus dari host (tidak bisa diakses via `http://VPS_IP:3001`), hanya via Nginx reverse proxy + SSL.
- Status page publik Uptime Kuma bisa diaktifkan dari Settings bila ingin menampilkan status tanpa login.

| # | Langkah | Status |
|---|---|---|
| E1 | Kuis & auto-grading + sertifikat + verifikasi publik | ✅ |
| E2 | Forum diskusi & rating | ✅ |
| E3 | Dashboard admin/instruktur + laporan | ✅ |
| E4 | Kupon, landing page, WhatsApp | ✅ |

---

**Progres saat ini:** ~~A1–A8~~ ✅ → ~~B1–B6~~ ✅ (go-live + CI/CD aktif) → ~~C1–C5~~ ✅ → ~~E1–E4~~ ✅ → ~~D1–D4~~ ✅ → **D5 berikutnya** (load test + validasi akhir).
Fitur lengkap sesuai PRD §3 + keandalan. Perintah cukup sebutkan kodenya, misal: "kerjakan D5".

---

### D5 — Load Test + Checklist Validasi Akhir

D5 adalah langkah terakhir sebelum go-live publik penuh. Dua bagian:
1. **Load test** — buktikan B2ms mampu menangani beban dasar dengan k6
2. **Checklist validasi akhir** — 8 item dari plan §6

---

**1. Load test dengan k6**

Skrip load test: `scripts/load-test.js`. Mensimulasikan 10 user simultan selama 2 menit (ramp-up bertahap) mengakses landing page, katalog, health API, registrasi.

Jalankan dari laptop Anda (PowerShell, butuh k6 terinstal):
```bash
# Install k6 (sekali): winget install k6
k6 run scripts/load-test.js
```

Hasil yang diharapkan:
- **Error rate < 5%**
- **p95 response time < 3 detik** (seluruh request)
- **Katalog < 2.5 detik** (LCP PRD)
- Verdict: **LULUS**

Jika gagal: cek `docker stats` di VPS saat load test (CPU/RAM B2ms), `docker compose logs app` untuk error.

---

**2. Checklist validasi akhir (plan §6)**

| # | Item | Cara Uji | Harapan | Status |
|---|---|---|---|---|
| 1 | Halaman katalog < 2.5 detik LCP | Load test k6 atau Chrome DevTools Lighthouse | p95 < 2500ms | [ ] |
| 2 | Alur lengkap: registrasi → login → beli (sandbox) → enrollment → progress → sertifikat | Manual browser + DB verifikasi | Semua langkah berhasil | [ ] |
| 3 | Matikan container postgres → Uptime Kuma alert | `docker compose stop postgres` lalu cek Uptime Kuma | Alert masuk < 1 menit | [ ] |
| 4 | Simulasi VM hilang: restore dari backup | `./scripts/restore.sh` di VPS baru | 17 tabel pulih, aplikasi sehat | [ ] |
| 5 | Webhook pembayaran duplikat | Kirim 2x payload yang sama ke `/api/webhooks/midtrans` | Hanya 1 enrollment (idempoten) | [ ] |
| 6 | Semua container punya memory limit + healthcheck | `docker compose ps` + `docker stats --no-stream` | Semua Up/healthy, memory limit terlihat | [ ] |
| 7 | Restart VM → sistem hidup kembali otomatis | `sudo reboot` via SSH, tunggu 2 menit | Semua service auto-start, `/api/health` OK | [ ] |
| 8 | Pipeline CI/CD hijau | Push commit ke `main` | 3 job sukses | [ ] |

**Cara mengisi checklist:**

- **Item 1:** Jalankan `k6 run scripts/load-test.js` dari laptop, catat hasil p95 katalog.
- **Item 2:** Login sebagai `siswa@uji.id` di browser, daftar kursus (bila ada yang published), lakukan checkout (Midtrans sandbox), verifikasi enrollment di DB, tandai progress selesai, terbitkan sertifikat, buka `/verify/GLD-...`.
- **Item 3:** `docker compose stop postgres`, buka `https://monitoring.gladi.id`, tunggu monitor "DB Health" berubah merah.
- **Item 4:** `./scripts/restore.sh` (sudah diuji di D2 — checklist ulang untuk konfirmasi).
- **Item 5:** Dua kali POST ke webhook dengan `order_id` yang sama + signature valid → cek DB: hanya 1 enrollment.
- **Item 6:** `docker compose ps` (semua Up/healthy) + `docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"` (pastikan memory limit tidak tembus).
- **Item 7:** `sudo reboot` → tunggu 2-3 menit → `curl https://gladi.id/api/health`.
- **Item 8:** Push commit ini (atau commit apa pun ke `main`) → cek GitHub Actions.

Setelah 8 item checklist tercentang, **Tahap D selesai dan platform siap go-live publik penuh**.

---
