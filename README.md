# Shadcn Billing & MikroTik Admin Dashboard

Dashboard administrasi billing ISP/RT-RW Net berbasis React + PHP untuk manajemen pelanggan PPPoE, router MikroTik, keuangan, ODP, network map, activity log, dan pengaturan admin.

Project ini awalnya berasal dari template `shadcn-admin`, lalu dikembangkan menjadi aplikasi billing lokal dengan backend PHP session auth dan API protected.

---

## Ringkasan Fitur

### Architecture & Background Workers

- **MikroTik Daemon (`mikrotik-daemon`)**: Proses background (PM2) untuk sinkronisasi real-time (setiap 3 detik) data Active Users, Secrets, Profile Pricing, dan Router Resources.
- **WhatsApp Gateway (`wa-gateway`)**: Proses background (PM2) untuk pengiriman antrean pesan WhatsApp dan Webhook dua arah (Chat Messenger).

### Authentication & Security

- Login admin berbasis PHP session/cookie.
- Verifikasi session melalui endpoint backend.
- API penting dilindungi dengan `api/auth/require_auth.php`.
- Role-based access control frontend dan backend.
- Admin user management.
- Activity/audit logging untuk aksi penting.
- Privacy Mode global untuk menyamarkan data sensitif.
- `.htaccess` hardening untuk memblokir akses langsung ke file debug/test/scratch.

### Role & Permission

Role utama:

- `super_admin`
- `admin`
- `finance`
- `operator`
- `viewer`

Alias legacy yang dikenali:

- `administrator` → `admin`
- `super admin` → `super_admin`
- `superadministrator` → `super_admin`

Contoh akses:

| Role          | Akses                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `super_admin` | Semua fitur                                                                                     |
| `admin`       | Semua fitur utama kecuali pembatasan khusus super admin jika nanti diterapkan                   |
| `finance`     | Keuangan, laporan, pembayaran                                                                   |
| `operator`    | Operasional pelanggan, PPPoE, ODP, monitoring; tidak delete data penting/router/profile pricing |
| `viewer`      | Read-only dashboard/monitoring                                                                  |

Permission sudah diterapkan pada:

- Sidebar/menu.
- Customers table/action.
- Customer add/edit/delete/bulk.
- Import/export pelanggan.
- Finance billing/piutang.
- PPPoE secrets.
- PPPoE profiles.
- ODP.
- Router settings UI/API.
- Network map UI/API.
- Integration settings UI/API.
- MikroTik action API.

### Manajemen Pelanggan

- List pelanggan paginated.
- Search pelanggan.
- Tambah/edit/hapus pelanggan.
- Bulk edit.
- Bulk import/export CSV.
- Sinkronisasi PPP Secret dari MikroTik ke database.
- Hard sync: pelanggan yang tidak ada lagi di MikroTik dapat dihapus dari DB.
- Load pelanggan dari database lebih ringan; sync MikroTik dilakukan manual.
- Subnav pelanggan lengkap: overview, semua, online, offline, per profil, import/export.
- Lokasi pelanggan:
  - field `maps`, `lat`, `lng`
  - parse koordinat dari Google Maps link umum
  - resolve short link `maps.app.goo.gl` via backend
  - bulk convert maps link ke `lat/lng`
  - Map Picker untuk pilih/drag titik manual
  - koordinat `0,0` dianggap tidak valid dan tidak disimpan dari hasil convert
- Optional customer fields boleh kosong.
- Field wajib utama mengikuti kebutuhan PPP Secret MikroTik:
  - username
  - password
  - profile
  - status/service sesuai kebutuhan

### MikroTik / PPPoE

- Multi-router MikroTik.
- Router credentials diselesaikan server-side dari `router_id`.
- PPPoE secrets list.
- Add/edit/enable/disable PPP Secret.
- Delete PPP Secret dibatasi admin.
- PPPoE profile management dibatasi admin.
- **Real-Time Connection & Traffic Monitoring (Network Map Integration):**
  - Mengambil live IP address dan uptime sesi PPPoE langsung dari `/ppp/active`.
  - Mengukur real-time throughput (RX/TX bits per second) langsung dari interface router menggunakan `/interface/monitor-traffic`.
- **Robust Interface Recognition (Fallback Mechanism):**
  - Backend secara dinamis mendeteksi dan mendukung penamaan interface dynamic `<pppoe-username>` maupun server-binding statis `pppoe-username`.
- Ping/live status via MikroTik action.
- Cache PPP Secret dan PPP active untuk performa.

### Keuangan / Billing

- Dashboard finance KPI.
- Billing bulanan.
- Piutang/receivable.
- Laporan tahunan/bulanan.
- Mark paid/unpaid.
- Summary billing:
  - lunas
  - belum bayar
  - terkumpul
  - sisa piutang
  - persentase tertagih
- Filter:
  - bulan
  - tahun
  - search
  - profile
- Export piutang CSV.
- Role finance/admin dapat mengelola pembayaran.
- **Digital Notes:** Sistem pencatatan anomali operasional dan follow-up pembayaran yang persisten di Dashboard Keuangan.

### WhatsApp Center & Gateway

- **Full-Duplex Messaging:** Integrasi Webhook untuk menerima dan membalas pesan pelanggan secara real-time seperti aplikasi chat messenger.
- **Queue System:** Pengiriman pesan massal menggunakan sistem antrean (queue) melalui background worker.
- **WhatsApp Settings:** Pengaturan API Token dan Custom Webhook URL via UI.

### ODP & Network Map

- CRUD ODP.
- Bulk update/delete ODP dengan permission.
- Kapasitas ODP.
- Koordinat ODP memakai `lat/lng`, dengan fallback `maps_link`.
- Convert Google Maps link ODP ke koordinat:
  - per-ODP dari form tambah/edit
  - bulk convert dari daftar ODP
- Network map berbasis Leaflet.
- Tampilkan router/server, ODP, pelanggan, kabel ODP ke rumah pelanggan, dan jalur manual.
- Validasi koordinat map: titik `0,0` dianggap tidak valid dan tidak diplot.
- Marker custom:
  - server/router merah
  - ODP berwarna sesuai kapasitas
  - rumah pelanggan hijau/merah/isolir sesuai status
- Popup marker hanya muncul saat diklik, bukan hover.
- Popup router/ODP/pelanggan dibuat compact/minimalis.
- Popup ODP menampilkan chart port kotak-kotak:
  - hijau = port terpakai
  - abu-abu = port kosong
- Garis server/router ke ODP dinonaktifkan sementara.
- Garis ODP ke pelanggan dibuat tebal, dashed, dan animated flow.
- Layer control compact.
- Filter pelanggan online/offline/semua.
- Search pelanggan di map.
- Focus router.
- Fit semua titik.
- Bottom status bar:
  - online
  - offline
  - ODP
  - persentase port terpakai

### Privacy Mode / Hide & Seek

Privacy Mode global tersedia melalui icon mata di topbar dekat theme switch.

Saat aktif:

- Data sensitif pelanggan disamarkan.
- Data finance/nominal disamarkan.
- Data PPPoE/router sensitif disamarkan.
- KPI besar dapat tampil sebagai `******`.
- Navigasi, title, filter, search tidak diblur.

State disimpan di:

```txt
localStorage key: privacy-mode
html class: privacy-mode
```

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Zustand
- Shadcn UI
- Tailwind CSS
- Radix UI
- Lucide Icons
- Recharts
- Leaflet untuk Network Map

### Backend

- PHP
- MySQL/MariaDB
- PHP session auth
- RouterOS API client
- PM2 (Process Manager) untuk Background Daemons (`mikrotik-daemon`, `wa-gateway`)
- Node.js (untuk WhatsApp Webhook Gateway)
- Apache/Laragon `.htaccess`

---

## Struktur Penting

```txt
api/
  auth/
    login.php
    logout.php
    verify_session.php
    require_auth.php
    activity_log.php
  admin_manager.php
  get_activity_logs.php
  get_all_users_paginated.php
  save_user.php
  delete_user.php
  sync_ppp_to_db.php
  mikrotik_action.php
  payment_operations.php
  finance_report.php
  get_all_payments_for_month_year.php
  routers.php
  odp.php
  network_lines.php
  web_settings.php
  profile_pricing_operations.php
  mikrotik_daemon.php
  wa_operations.php
  get_system_logs.php

src/
  components/
    layout/
    privacy.tsx
    theme-switch.tsx
  features/
    auth/
    customers/
    dashboard/
    finance/
    logs/
    network-map/
    odp/
    pppoe/
    settings/
  lib/
    api.ts
    permissions.ts
  stores/
    auth-store.ts
    privacy-store.ts
    router-store.ts
  styles/
    index.css
```

---

## Setup Lokal

Project ini biasa dijalankan di Laragon/Apache dengan folder:

```txt
C:\laragon\www\shadcn
```

### 1. Install dependencies frontend

```bash
npm install
```

### 2. Jalankan Vite dev server

```bash
npm run dev
```

### 3. Backend API

API berada di folder:

```txt
/api
```

Vite proxy mengarah ke Apache/Laragon:

```ts
'/api': {
  target: 'http://localhost/shadcn',
  changeOrigin: true,
  secure: false,
}
```

Frontend memakai base URL:

```ts
const API_BASE_URL = '/api'
```

Dan request memakai cookie/session:

```ts
withCredentials: true
```

---

## Database & Konfigurasi

Konfigurasi database utama berada di:

```txt
api/config.php
```

File `.env`/config sensitif di dalam `api/` harus dijaga dan tidak dipublikasikan.

> Catatan: project ini belum terdeteksi sebagai Git repository pada pengecekan terakhir. Jika ingin versioning/rollback, inisialisasi Git lokal sangat disarankan.

---

## Script Validasi

Untuk development, gunakan validasi ringan berikut.

### TypeScript check

```bash
npx tsc -b --pretty false
```

### ESLint targeted

```bash
npx eslint src/features/network-map/index.tsx --quiet
```

Atau untuk folder tertentu:

```bash
npx eslint src/features/finance --quiet
```

### PHP lint

```bash
php -l api/save_user.php
php -l api/mikrotik_action.php
php -l api/routers.php
```

### Catatan penting

Jangan menjalankan build produksi saat user sedang testing lokal kecuali memang diminta.

```bash
npm build
```

Tidak digunakan secara otomatis dalam workflow ini.

---

## Endpoint Penting

### Auth

```txt
POST /api/auth/login.php
POST /api/auth/logout.php
GET  /api/auth/verify_session.php
```

### Admin & Logs

```txt
/api/admin_manager.php
/api/get_activity_logs.php
```

### Customers

```txt
/api/get_all_users_paginated.php
/api/save_user.php
/api/delete_user.php
/api/import_users.php
/api/export_users.php
/api/bulk_upsert_users.php
/api/bulk_update_users.php
/api/bulk_delete_users.php
/api/sync_ppp_to_db.php
```

### MikroTik / PPPoE

```txt
/api/mikrotik_action.php
/api/mikrotik_live.php
```

### Finance

```txt
/api/payment_operations.php
/api/get_all_payments_for_month_year.php
/api/finance_report.php
```

### Router / ODP / Network

```txt
/api/routers.php
/api/odp.php
/api/bulk_update_odp.php
/api/bulk_delete_odp.php
/api/network_lines.php
```

### Settings

```txt
/api/web_settings.php
/api/profile_pricing_operations.php
/api/genieacs_proxy.php

### System Tools & WhatsApp

```txt
/api/get_system_logs.php
/api/wa_operations.php
```
```

---

## Security Notes

- Backend menggunakan PHP session, bukan bearer token utama.
- Frontend mungkin menyimpan dummy token `php-session`, tetapi autentikasi nyata tetap cookie/session PHP.
- Endpoint mutasi penting wajib memakai `require_auth.php` dan `require_admin_role()` sesuai kebutuhan.
- Debug/test/scratch PHP diblokir via `.htaccess`.
- Jika API key/local provider pernah dibagikan di chat/log, sebaiknya rotate/regenerate.
- Pastikan Apache/Laragon mengizinkan `.htaccess` override agar hardening aktif.

---

## Recent Major Updates

- Login redirect/session loop diperbaiki.
- Banyak API frontend-protected sudah memakai auth session.
- Admin Users page ditambahkan.
- Activity log helper ditambahkan.
- Customer add/edit/delete/bulk dan MikroTik sync distabilkan.
- PPP sync menjadi hard sync.
- Finance dashboard/billing/piutang/report dioptimalkan.
- Privacy Mode global ditambahkan.
- Role/permission frontend dan backend diterapkan bertahap.
- Router/ODP/network/settings permission dirapikan.
- Network Map diperbarui menjadi lebih compact dan map-first:
  - layer control compact
  - search/filter atas
  - bottom status bar
  - popup ODP/pelanggan premium
  - **Integrasi MikroTik Real-Time:** Penarikan langsung data live IP & throughput lalu-lintas data (RX/TX bps) langsung dari router via event `popupopen`, lengkap dengan fallback deteksi nama interface (`<pppoe-username>` dan `pppoe-username`).
- **MikroTik Daemon (Real-Time Background Sync):** Arsitektur backend baru menggunakan PM2 worker untuk polling data router (Active Users, Profiles, Secrets, Resources) secara asinkron setiap 3 detik, membuat UI dashboard menjadi instan tanpa lag.
- **WhatsApp Gateway terintegrasi:** Pembuatan sistem chat messenger dua arah (full-duplex) via UI Webhook dan sistem manajemen Queue.
- **System Diagnostics UI:** Penambahan halaman System Logs dengan fitur Auto-Refresh (3 detik) dan Copy Log untuk memantau PM2 Daemon dan PHP Error secara real-time.
- **Modernisasi Finance Dashboard:** Implementasi TanStack Table untuk pencarian dan filter tagihan/piutang yang sangat responsif, ditambah dengan resolusi bug sinkronisasi skema database.

---

## Roadmap Lanjutan

Rekomendasi fitur berikutnya:

1. Audit log untuk percobaan akses 403.
2. Test role satu per satu:
   - super_admin
   - admin
   - finance
   - operator
   - viewer
3. Backup & restore database.
4. Invoice/kuitansi pembayaran.
5. WhatsApp reminder piutang.
6. Edit/delete manual line di Network Map.
7. Fullscreen mode untuk Network Map.
8. CSRF protection untuk POST/PUT/PATCH/DELETE.
9. Session idle timeout/auto logout.

---

## Original Template Credit

Project ini dikembangkan dari template Shadcn Admin Dashboard oleh [@satnaing](https://github.com/satnaing).

Original stack:

- Shadcn UI
- Vite
- TanStack Router
- TypeScript
- ESLint/Prettier
- Lucide/Tabler Icons

---

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/).
