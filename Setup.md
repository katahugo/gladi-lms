# Setup Guide — Gladi LMS

Panduan instalasi dari nol hingga production di 1 VPS Azure. Untuk pengembangan lokal, lihat [Pengembangan Lokal](#pengembangan-lokal).

> **Prasyarat:** Akun Azure (aktif), domain dengan Cloudflare, akun GitHub.

---

## Daftar Isi

1. [Provisioning VPS Azure](#1-provisioning-vps-azure)
2. [Hardening OS & Docker](#2-hardening-os--docker)
3. [Domain & Cloudflare](#3-domain--cloudflare)
4. [Clone & Konfigurasi Aplikasi](#4-clone--konfigurasi-aplikasi)
5. [SSL dengan Let's Encrypt](#5-ssl-dengan-lets-encrypt)
6. [Deploy Pertama](#6-deploy-pertama)
7. [CI/CD GitHub Actions](#7-cicd-github-actions)
8. [Aktifkan Backup Harian](#8-aktifkan-backup-harian)
9. [Aktifkan Monitoring](#9-aktifkan-monitoring)
10. [Integrasi Pihak Ketiga](#10-integrasi-pihak-ketiga)
11. [Pengembangan Lokal](#11-pengembangan-lokal)
12. [Pemeliharaan](#12-pemeliharaan)

---

## 1. Provisioning VPS Azure

### 1.1 Buat VM

Buka [portal.azure.com](https://portal.azure.com) → Virtual Machines → Create:

| Parameter | Nilai |
|---|---|
| Resource group | `gladi-lms-rg` (Create new) |
| VM name | `vm-gladi-lms` |
| Region | Indonesia Central (atau terdekat) |
| Image | Ubuntu Server 24.04 LTS x64 Gen2 |
| Size | Standard_B2ms (2 vCPU, 8GB RAM) |
| Authentication | SSH public key → username `azureuser` → Generate new key pair |
| Public inbound ports | **None** |
| OS disk | Premium SSD, default (127 GB) |
| Data disk | Create new: `gladi-lms-data`, 64 GiB, Premium SSD, LRS |
| Public IP | Create new: `gladi-lms-ip`, SKU Standard, **Static** |

Saat dialog "Generate new key pair" muncul → **Download private key** → simpan file `.pem` dengan aman.

### 1.2 Atur Firewall (NSG)

VM → Networking → Inbound port rules → tambah 3 rule:

| Nama | Port | Source | Priority |
|---|---|---|---|
| `allow-ssh-admin` | 2020 | IP Anda (x.x.x.x/32) | 100 |
| `allow-http` | 80 | Any | 110 |
| `allow-https` | 443 | Any | 120 |

---

## 2. Hardening OS & Docker

### 2.1 SSH ke VPS

```powershell
ssh -i .\gladi-lms-key.pem azureuser@<IP_VPS>
```

### 2.2 Hardening

Jalankan semua perintah berikut (blok bisa disalin sekaligus):

```bash
# User deploy
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# SSH port 2020 + key-only + disable root
sudo sed -i 's/^#\?Port .*/Port 2020/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Firewall OS
sudo ufw allow 2020/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# fail2ban + auto-update + swap 4GB
sudo apt update && sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Uji login baru sebelum menutup sesi lama:**
```powershell
ssh -i .\gladi-lms-key.pem -p 2020 deploy@<IP_VPS>
```

### 2.3 Install Docker + Mount Disk Data

```bash
# Format & mount disk data
lsblk                          # cari disk 64G (biasanya /dev/sdc)
sudo mkfs.ext4 /dev/sdc
sudo mkdir -p /data
UUID=$(sudo blkid -s UUID -o value /dev/sdc)
echo "UUID=$UUID /data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a

# Install Docker (repo resmi)
sudo apt update && sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy

# Pindahkan data-root Docker ke /data
sudo systemctl stop docker docker.socket containerd
sudo mkdir -p /data/docker
sudo mv /var/lib/docker/* /data/docker/ 2>/dev/null || true
echo '{ "data-root": "/data/docker" }' | sudo tee /etc/docker/daemon.json
sudo systemctl start docker

# Verifikasi (logout-login dulu: exit, lalu SSH ulang)
docker version && docker compose version
```

---

## 3. Domain & Cloudflare

1. Di [Cloudflare Dashboard](https://dash.cloudflare.com), tambahkan domain Anda.
2. Ganti nameserver di registrar domain ke nameserver Cloudflare.
3. **DNS → Records → Add record:**
   - Type: **A**, Name: `@`, IPv4: `<IP VPS>`, Proxy: **Proxied** (oranye)
   - (Opsional monitoring) Type: **A**, Name: `monitoring`, IPv4: `<IP VPS>`, Proxy: **Proxied**
4. **SSL/TLS → Overview** → mode: **Full (strict)**
5. **Edge Certificates** → **Always Use HTTPS** = ON

---

## 4. Clone & Konfigurasi Aplikasi

```bash
cd ~
git clone https://github.com/katahugo/gladi-lms.git
cd gladi-lms

# Buat .env
cp .env.example .env
nano .env
```

### Variabel wajib diisi

| Variabel | Keterangan | Cara Generate |
|---|---|---|
| `APP_DOMAIN` | Domain utama | `gladi.id` |
| `APP_URL` | URL publik | `https://gladi.id` |
| `AUTH_SECRET` | Secret Auth.js | `openssl rand -base64 32` |
| `POSTGRES_USER` | User database | `lms` |
| `POSTGRES_PASSWORD` | Password database | `openssl rand -base64 24` |
| `POSTGRES_DB` | Nama database | `gladi_lms` |
| `REDIS_PASSWORD` | Password Redis | `openssl rand -base64 24` |
| `MINIO_ROOT_USER` | User MinIO | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Password MinIO (min 8 karakter) | `openssl rand -base64 12` |

Variabel lain (Cloudflare Stream, Midtrans, Resend, Azure Backup) bisa diisi belakangan — endpoint akan mengembalikan 503 yang sopan tanpa nilai ini.

---

## 5. SSL dengan Let's Encrypt

```bash
cd ~/gladi-lms

# Start database dulu
docker compose up -d postgres redis minio
docker compose ps   # tunggu "healthy"

# Mode bootstrap (HTTP-only, tanpa sertifikat)
cp nginx/lms.conf.bootstrap nginx/templates/lms.conf.template
docker compose up -d --no-deps nginx
docker compose exec nginx wget -q -O- http://localhost/health  # harus: ok

# Terbitkan sertifikat
docker compose run --rm --no-deps certbot-issue \
  -d gladi.id \
  --email anda@email.com --agree-tos --no-eff-email \
  --webroot -w /var/www/certbot \
  certonly
# Harus: "Successfully received certificate"

# Aktifkan config HTTPS penuh
cp /tmp/nginx-backup/lms.conf.template nginx/templates/lms.conf.template
docker compose up -d --no-deps --force-recreate nginx

# (Opsional) SSL untuk monitoring
./scripts/provision-monitoring-ssl.sh anda@email.com
```

---

## 6. Deploy Pertama

```bash
cd ~/gladi-lms

# Build image app (pertama kali beberapa menit)
docker compose build app
docker tag ghcr.io/katahugo/gladi-lms/app:latest lms-local/app:latest
docker compose build worker
docker tag ghcr.io/katahugo/gladi-lms/worker:latest lms-local/worker:latest

# Migrasi database
set -a; source .env; set +a
APP_IMAGE=lms-local/app:latest docker compose run --rm --no-deps \
  -e PGHOST=postgres -e PGPORT=5432 \
  -e PGDATABASE="${POSTGRES_DB}" \
  -e PGUSER="${POSTGRES_USER}" \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  app node migrate.mjs

# Start semua service
APP_IMAGE=lms-local/app:latest WORKER_IMAGE=lms-local/worker:latest docker compose up -d

# Verifikasi
docker compose ps                    # semua Up/healthy
curl -s http://localhost/api/health  # {"status":"ok"}
curl -s https://gladi.id/api/health  # {"status":"ok"}
```

---

## 7. CI/CD GitHub Actions

### 7.1 Buat SSH Key Khusus Deploy

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N "" -C "github-actions"
cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github-deploy   # salin SELURUH output (private key)
```

### 7.2 Isi Secrets GitHub

Repo GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `VPS_HOST` | `<IP VPS>` (contoh: `70.153.16.78`) |
| `VPS_USER` | `deploy` |
| `VPS_PORT` | `2020` |
| `VPS_SSH_KEY` | *(paste seluruh private key dari langkah 7.1)* |

### 7.3 Verifikasi

Push commit apa pun ke `main`, atau buka tab **Actions** → **deploy** → **Run workflow**. Pantau sampai 3 job hijau.

---

## 8. Aktifkan Backup Harian

### 8.1 Buat Azure Blob Storage

Portal Azure → Storage accounts → Create:

| Parameter | Nilai |
|---|---|
| Resource group | `gladi-lms-rg` |
| Name | `gladilmsbackup` (unik) |
| Region | Indonesia Central |
| Performance | Standard |
| Redundancy | LRS |

Setelah dibuat:
1. **Containers** → `+ Container` → nama `lms-backups` → **Private** → Create
2. **Shared Access Signature** → centang: Service + Container + **Object**, permissions: Read + Write + Delete + List, Expiry: 2 tahun → **Generate SAS**
3. Salin 3 nilai: Storage account name, container name, SAS token

### 8.2 Konfigurasi di VPS

```bash
cd ~/gladi-lms

# Isi variabel Azure di .env
nano .env
# Tambahkan:
#   AZURE_STORAGE_ACCOUNT=gladilmsbackup
#   AZURE_STORAGE_CONTAINER=lms-backups
#   AZURE_STORAGE_SAS_TOKEN='sv=...&sig=...'  ← WAJIB kutip TUNGGAL!

# Jalankan setup (verifikasi + cron + uji backup pertama)
./scripts/setup-backup.sh
```

### 8.3 Uji Restore

```bash
./scripts/restore.sh   # restore dari backup terbaru (butuh konfirmasi "YA")
```

---

## 9. Aktifkan Monitoring

### 9.1 Uptime Kuma

Buka [`https://monitoring.gladi.id`](https://monitoring.gladi.id) → setup akun admin (pertama kali).

Tambahkan monitor:
- **Aplikasi:** HTTP(s) → `https://gladi.id/api/health` → interval 60s
- **Database:** HTTP(s) → `https://gladi.id/api/health/db` → interval 120s

### 9.2 Sentry

1. Daftar di [sentry.io](https://sentry.io) → create project **Next.js**
2. Salin DSN (format: `https://xxx@sentry.io/xxx`)
3. Tambahkan ke `.env` di VPS:
   ```bash
   echo 'SENTRY_DSN=https://xxx@sentry.io/xxx' >> ~/gladi-lms/.env
   docker compose restart app
   ```

### 9.3 Azure Monitor Alert

Portal Azure → VM → Alerts → Create alert rule:
- **CPU > 85%** (rata-rata 5 menit)
- **RAM < 512 MB** (Available Memory Bytes)
- **Disk > 80%** (Used Space Percentage, OS disk)

Action group: email ke alamat Anda.

---

## 10. Integrasi Pihak Ketiga

### 10.1 Cloudflare Stream (Video)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Stream → API Tokens → Create Token (izin Stream:Edit)
2. Salin Account ID, API Token, dan Customer Subdomain
3. Tambahkan ke `.env`:
   ```bash
   CF_STREAM_ACCOUNT_ID=xxx
   CF_STREAM_API_TOKEN=xxx
   CF_STREAM_CUSTOMER_SUBDOMAIN=xxx
   ```

### 10.2 Midtrans (Pembayaran)

1. Daftar di [midtrans.com](https://midtrans.com) → dapatkan Server Key & Client Key
2. Tambahkan ke `.env`:
   ```bash
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
   MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
   MIDTRANS_IS_PRODUCTION=false   # sandbox dulu
   ```
3. Daftarkan webhook di dashboard Midtrans → URL: `https://gladi.id/api/webhooks/midtrans`

### 10.3 Resend (Email)

1. Daftar di [resend.com](https://resend.com) → dapatkan API Key
2. Verifikasi domain pengirim di dashboard Resend
3. Tambahkan ke `.env`:
   ```bash
   RESEND_API_KEY=re_xxx
   EMAIL_FROM="Gladi LMS <no-reply@gladi.id>"
   ```

### 10.4 MinIO (S3 Access Key)

Buat access key untuk aplikasi:
```bash
docker exec lms_minio mc alias set local http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
docker exec lms_minio mc admin user svcacct add local ${MINIO_ROOT_USER} --access-key "lms-app" --secret-key "<generate>"
```
Tambahkan ke `.env`:
```bash
S3_ACCESS_KEY=lms-app
S3_SECRET_KEY=<secret-key-yang-digenerate>
```

---

## 11. Pengembangan Lokal

### Prasyarat
- Node.js 20+, npm
- Docker Desktop

### Setup

```bash
git clone https://github.com/katahugo/gladi-lms.git
cd gladi-lms/app
npm install

# Salin .env untuk development
cp ../.env.example .env.local
# Edit .env.local — set DATABASE_URL untuk koneksi lokal:
#   DATABASE_URL=postgresql://lms:password@localhost:5432/gladi_lms

# Jalankan database lokal
cd ..
docker compose up -d postgres redis minio

# Migrasi + dev server
cd app
npm run db:migrate   # atau npm run db:push (development)
npm run dev          # http://localhost:3000
```

### Script

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server Next.js |
| `npm run build` | Build production |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migrasi dari skema |
| `npm run db:push` | Push skema langsung (dev) |
| `npm run db:migrate` | Jalankan migrasi |
| `npm run db:studio` | Drizzle Studio GUI |
| `npm run build:worker` | Bundle worker BullMQ |
| `npm run build:migrate` | Bundle skrip migrasi |

---

## 12. Pemeliharaan

### Update Aplikasi

Push ke `main` → CI/CD otomatis deploy. Tidak perlu akses VPS.

### Cek Status

```bash
docker compose ps
docker compose logs --tail=50 app
curl -s https://gladi.id/api/health
```

### Restart Service

```bash
docker compose restart app worker
```

### Lihat Log

```bash
docker compose logs -f app       # real-time
docker compose logs -f worker    # job BullMQ
docker compose logs -f nginx     # reverse proxy
```

### Backup Manual

```bash
./scripts/backup.sh
```

### Restore dari Backup

```bash
./scripts/restore.sh   # pilih backup terbaru, butuh konfirmasi "YA"
```

### Load Test

```bash
# Install k6: winget install k6  (Windows) / brew install k6 (Mac)
k6 run scripts/load-test.js
```

### Rollback Manual

```bash
# Lihat image yang tersedia
docker image ls ghcr.io/katahugo/gladi-lms/app

# Rollback ke versi sebelumnya
APP_IMAGE=ghcr.io/katahugo/gladi-lms/app:sha-<commit> \
WORKER_IMAGE=ghcr.io/katahugo/gladi-lms/worker:sha-<commit> \
docker compose up -d
```

---

## Referensi Cepat

| Perintah | Kegunaan |
|---|---|
| `docker compose up -d` | Start semua service |
| `docker compose ps` | Status container |
| `docker compose logs -f app` | Log aplikasi |
| `docker compose restart app worker` | Restart app & worker |
| `./scripts/backup.sh` | Backup database |
| `./scripts/restore.sh` | Restore database |
| `crontab -l \| grep gladi-lms` | Cek cron backup |
| `tail -f /var/log/lms-backup.log` | Log backup |
| `k6 run scripts/load-test.js` | Load test |
