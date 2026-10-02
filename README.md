# Dapur MBG - Sistem Logistik Pangan & Keuangan SPPG
### Program Makan Bergizi Gratis (MBG)

Aplikasi berbasis web modern, ringan, dan terintegrasi dengan **MySQL / MariaDB** untuk memudahkan pegawai dan tim juru masak **Satuan Pelayanan Pemenuhan Gizi (SPPG)** dalam mencatat logistik bahan pangan dan mengelola keuangan dapur harian.

---

## 🌟 Fitur Utama

### 1. 🛒 Pencatatan Pembelian Bahan Pangan
- Mencatat barang belanjaan harian: Nama bahan, kategori (*Sayuran, Protein Hewani/Nabati, Karbohidrat, Buah, Susu, Bumbu Dapur*), kuantitas, satuan (*kg, ikat, potong, liter, pack, dll.*), harga satuan, dan total biaya.
- **Tombol Bahan Cepat (One-Click Presets)**: Cukup 1 klik untuk mengisi bahan populer seperti Beras, Ayam Fillet, Telur, Wortel, Tempe, Ikan, Susu UHT, dsb.
- **Otomatisasi Kas Keluar**: Terhubung langsung ke modul keuangan tanpa perlu mencatat dua kali.

### 2. 📦 Pencatatan Stok Sisa Dapur (Inventory Leftovers)
- Mencatat bahan makanan yang belum habis dipakai setelah shift masak selesai.
- Status kelayakan bahan: *Baik / Segar*, *Perlu Segera Diolah*, atau *Perlu Dipantau*.
- Lokasi penyimpanan (*Chiller sayur, freezer daging, gudang kering, rak bumbu*).

### 3. 🗑️ Pencatatan Bahan Terbuang (Food Waste & Kerusakan)
- Mencatat bahan pangan yang busuk, layu saat sortir, rusak pengiriman, sisa olahan, atau tidak lolos QC mutu gizi.
- Menghitung taksiran kerugian nominal rupiah (Rp) untuk evaluasi efisiensi dapur.

### 4. 💰 Modul Keuangan & Neraca Laba/Rugi (Surplus-Defisit)
- **Uang Masuk**: Pencairan dana anggaran MBG, dropping kas daerah / APBD, bantuan kemitraan.
- **Uang Keluar**: Belanja bahan pangan, operasional dapur (Gas LPG, Listrik, Air galon sanitasi), kemasan ompreng stainless/box, armada transportasi distribusi sekolah, insentif juru masak.
- **Saldo Kas Berjalan**: Total kas riil yang tersedia secara *real-time*.
- **Untung / Rugi (Surplus / Defisit Anggaran)**:
  - **Harian (Per Hari)**
  - **Mingguan (Per Minggu / 7 Hari Terakhir)**
  - **Bulanan (Per Bulan Berjalan)**
  - Analisis *Food Cost per Porsi* terhadap target pagu anggaran (misal: Rp 15.000 / porsi).

### 5. 🖨️ Cetak & Ekspor Laporan Lengkap
- **Cetak ke Printer / Simpan ke PDF**:
  - Format Laporan Resmi SPPG A4 (dilengkapi Kop Resmi, rekapitulasi angka, rincian tabel, dan kolom tanda tangan Kepala SPPG, Bendahara, dan Juru Masak).
  - Format Struk Kasir / Thermal 80mm untuk printer kasir portable di dapur/pasar.
- **Ekspor ke Excel (.xls / .xlsx)**:
  - Multi-sheet lengkap (*Rekap Keuangan, Pembelian Bahan, Sisa Stok, Bahan Dibuang*) dengan format mata uang rupiah dan formula yang langsung kompatibel dengan Microsoft Excel dan Google Sheets.
- **Ekspor ke CSV**: Untuk olah data fleksibel atau integrasi spreadsheet lainnya.

---

## 🗄️ Konfigurasi Database MySQL / MariaDB

Aplikasi menggunakan database **MySQL / MariaDB** (`dapur_mbg`) sehingga sangat ringan, andal, dan siap dihosting di mana saja (cPanel, phpMyAdmin, VPS, atau Cloud).

### Konfigurasi `.env`:
Berkas `.env` ada di root project:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=admin
DB_NAME=dapur_mbg
PORT=8008
```

### File Dump SQL untuk Hosting (`dapur_mbg.sql`):
Jika Anda ingin memindahkan atau meng-hosting aplikasi ke server hosting/cPanel/phpMyAdmin:
1. Buat database baru di cPanel / phpMyAdmin (misal: `dapur_mbg`).
2. Masuk ke menu **Import** di phpMyAdmin, lalu pilih berkas:
   👉 **`dapur_mbg.sql`**
3. Sesuaikan informasi `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` pada file `.env`.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi telah berjalan pada alamat:
👉 **[http://localhost:8008](http://localhost:8008)**

Untuk menjalankan ulang aplikasi kapan saja di terminal:
```bash
cd /home/razael-christ/Documents/mbg
./run.sh
```
Atau menggunakan perintah:
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8008
```
# ERP-MBG
