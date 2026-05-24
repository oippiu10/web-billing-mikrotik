# Pembaruan Modul Keuangan (Finance Dashboard)

Dokumen ini merangkum seluruh perubahan dan penyeragaman antarmuka (UI/UX) pada modul Keuangan untuk memberikan pengalaman bergaya *Premium SaaS*.

## 1. Penyeragaman Filter Bar
Seluruh halaman kini memiliki standar Filter Bar horisontal yang seragam:
- **Tagihan Bulanan (`billing.tsx`)**: Menjadi standar referensi dengan desain latar putih melengkung, efek *shadow* tipis, pencarian teks, pemilih Status dan Paket.
- **Piutang (`receivable.tsx`)**: Menghilangkan antarmuka *pencarian* yang terpisah dan mengintegrasikannya ke dalam Filter Bar terpadu di atas tabel.
- **Pengeluaran (`expenses.tsx`)**: Menambahkan bilah filter "Semua Kategori" dan kolom pencarian "Cari keterangan..." yang sejajar dengan letak filter di halaman lain, serta tombol `Reset` di kanan.

## 2. Peningkatan Fitur Pengeluaran
- **Ubah/Edit Data**: Menambahkan aksi tombol Edit (ikon Pensil) yang memungkinkan penyuntingan transaksi (Nominal, Kategori, Catatan) tanpa harus menghapusnya terlebih dahulu.
- **Modifikasi Backend**: Menambahkan fungsionalitas penanganan aksi `edit` ke dalam API `expense_operations.php`.
- **Optimalisasi Banner KPI**: Mengecilkan ukuran kartu ringkasan "Total Pengeluaran Bulan Ini" beserta *font size*-nya agar selaras secara proporsional dengan kartu ringkasan Tagihan Bulanan.

## 3. Penataan Ikon & Layout Navigasi
- Mengubah ikon **Pengeluaran** pada menu samping (Sidebar) menjadi `ArrowDownCircle` untuk sinkronisasi penuh dengan ikon pada Header halaman.
- Menghapus blok latar belakang warna yang berlebih (background color box) pada ikon Header halaman **Piutang** (`AlertTriangle`) dan **Pengeluaran** agar tampilan menjadi lebih bersih.
- Menghapus keseluruhan halaman dan opsi navigasi **"Billing Lengkap"** untuk menyederhanakan menu aplikasi dan menghindari duplikasi fungsi.
