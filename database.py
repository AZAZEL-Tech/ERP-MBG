import os
import pymysql
from pymysql.cursors import DictCursor
from datetime import date, timedelta
from dotenv import load_dotenv

# Load .env configuration
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_NAME = os.getenv("DB_NAME", "dapur_mbg")

def get_server_connection():
    """Koneksi langsung ke server MySQL (tanpa memilih database terlebih dahulu)."""
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True
    )

def get_connection():
    """Koneksi ke database MySQL dapur_mbg."""
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True
    )

def init_db():
    """Inisialisasi database dan tabel-tabel di MySQL / MariaDB."""
    # 1. Pastikan database ada
    server_conn = get_server_connection()
    with server_conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    server_conn.close()

    # 2. Buat tabel di dalam database
    conn = get_connection()
    with conn.cursor() as cursor:
        # Tabel Pembelian Bahan Pangan
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS `purchases` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `date` DATE NOT NULL,
            `item_name` VARCHAR(191) NOT NULL,
            `category` VARCHAR(100) NOT NULL,
            `quantity` DECIMAL(10,2) NOT NULL,
            `unit` VARCHAR(50) NOT NULL,
            `unit_price` DECIMAL(12,2) NOT NULL,
            `total_price` DECIMAL(14,2) NOT NULL,
            `supplier` VARCHAR(191) DEFAULT '',
            `notes` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_p_date` (`date`),
            INDEX `idx_p_cat` (`category`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # Tabel Stok Sisa Bahan Pangan (Inventaris Dapur)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS `inventory` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `date` DATE NOT NULL,
            `item_name` VARCHAR(191) NOT NULL,
            `category` VARCHAR(100) NOT NULL,
            `remaining_qty` DECIMAL(10,2) NOT NULL,
            `unit` VARCHAR(50) NOT NULL,
            `item_condition` VARCHAR(100) DEFAULT 'Baik / Segar',
            `storage_location` VARCHAR(191) DEFAULT 'Gudang Dapur',
            `notes` TEXT,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_inv_name` (`item_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # Tabel Bahan Dibuang (Food Waste & Kerusakan Mutu)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS `food_waste` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `date` DATE NOT NULL,
            `item_name` VARCHAR(191) NOT NULL,
            `category` VARCHAR(100) NOT NULL,
            `waste_qty` DECIMAL(10,2) NOT NULL,
            `unit` VARCHAR(50) NOT NULL,
            `estimated_loss` DECIMAL(14,2) NOT NULL,
            `reason` VARCHAR(191) NOT NULL,
            `notes` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_w_date` (`date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # Tabel Transaksi Keuangan (Arus Kas Masuk & Keluar)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS `finances` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `date` DATE NOT NULL,
            `type` ENUM('INCOME','EXPENSE') NOT NULL,
            `category` VARCHAR(100) NOT NULL,
            `amount` DECIMAL(14,2) NOT NULL,
            `description` VARCHAR(255) NOT NULL,
            `source_or_recipient` VARCHAR(191) DEFAULT '',
            `ref_number` VARCHAR(100) DEFAULT '',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_f_date` (`date`),
            INDEX `idx_f_type` (`type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # Tabel Pengaturan / Profil SPPG MBG
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS `settings` (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # Inisialisasi default settings jika belum ada
        default_settings = {
            "kitchen_name": "Satuan Pelayanan Pemenuhan Gizi (SPPG) MBG Mandiri",
            "service_area": "Kecamatan Sejahtera, Kab. Nusantara",
            "manager_name": "Budi Santoso, S.Gz",
            "treasurer_name": "Siti Rahmawati, S.E",
            "head_cook": "Chef Agus Priyono",
            "daily_target_portions": "1200",
            "budget_per_portion": "15000",
            "active_schools": "SDN 01 Harapan, SDN 02 Pagi, SMPN 01 Perintis"
        }

        for k, v in default_settings.items():
            cursor.execute("INSERT IGNORE INTO `settings` (`key`, `value`) VALUES (%s, %s)", (k, v))

        # Cek apakah tabel purchases kosong, jika ya isi data awal sampel MBG
        cursor.execute("SELECT COUNT(*) as cnt FROM `purchases`")
        row = cursor.fetchone()
        if row and row["cnt"] == 0:
            seed_sample_data(cursor)

    conn.close()

def seed_sample_data(cursor):
    today = date.today()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    three_days_ago = today - timedelta(days=3)

    # 1. Sample Pembelian Bahan Pangan
    sample_purchases = [
        # Hari ini
        (today.isoformat(), "Beras Rojolele Super", "Karbohidrat", 100.0, "kg", 14500, 1450000, "UD Tani Makmur", "Untuk nasi siang 1200 porsi"),
        (today.isoformat(), "Daging Dada Ayam Fillet", "Protein Hewani", 60.0, "kg", 38000, 2280000, "RPA Berkah Segar", "Ayam kecap manis MBG"),
        (today.isoformat(), "Wortel Segar Brastagi", "Sayuran", 25.0, "kg", 12000, 300000, "Pasar Induk Sayur", "Sayur sop pelengkap gizi"),
        (today.isoformat(), "Buncis Hijau Segar", "Sayuran", 20.0, "kg", 15000, 300000, "Pasar Induk Sayur", "Campuran sayur sop"),
        (today.isoformat(), "Tempe Daun Segar", "Protein Nabati", 150.0, "potong", 2000, 300000, "Pengrajin Tempe Berkah", "Tempe mendoan gurih"),
        (today.isoformat(), "Buah Pisang Ambon", "Buah-buahan", 1200.0, "buah", 1500, 1800000, "Grosir Buah Nusantara", "Pencuci mulut bergizi 1 porsi/anak"),
        (today.isoformat(), "Susu UHT MBG 125ml", "Susu & Pelengkap", 1200.0, "kotak", 3500, 4200000, "Distributor Susu Sehat", "Susu pemenuhan kalsium"),
        (today.isoformat(), "Minyak Goreng Sawit", "Minyak & Bumbu", 15.0, "liter", 17000, 255000, "Toko Sembako Jaya", "Penggorengan tempe"),
        (today.isoformat(), "Bawang Merah & Putih", "Minyak & Bumbu", 8.0, "kg", 35000, 280000, "Pasar Induk Sayur", "Bumbu dapur kuah sop"),

        # Kemarin
        (yesterday.isoformat(), "Beras Rojolele Super", "Karbohidrat", 100.0, "kg", 14500, 1450000, "UD Tani Makmur", "Kebutuhan harian"),
        (yesterday.isoformat(), "Telur Ayam Negeri", "Protein Hewani", 75.0, "kg", 27000, 2025000, "Peternakan Barokah", "Telur balado gizi"),
        (yesterday.isoformat(), "Bayam Hijau Segar", "Sayuran", 40.0, "ikat", 3000, 120000, "Pasar Tradisional", "Sayur bening bayam"),
        (yesterday.isoformat(), "Jagung Manis Pipil", "Sayuran", 20.0, "kg", 9000, 180000, "Pasar Tradisional", "Pelengkap sayur bayam"),
        (yesterday.isoformat(), "Tahu Putih Sutra", "Protein Nabati", 120.0, "potong", 2000, 240000, "Pabrik Tahu Lestari", "Tahu bacem gizi"),
        (yesterday.isoformat(), "Buah Jeruk Manis", "Buah-buahan", 120.0, "kg", 18000, 2160000, "Grosir Buah Nusantara", "Buah segar vitamin C"),

        # 2 hari lalu
        (two_days_ago.isoformat(), "Ikan Kembung Segar", "Protein Hewani", 70.0, "kg", 32000, 2240000, "Koperasi Nelayan Sejahtera", "Ikan kembung goreng tepung"),
        (two_days_ago.isoformat(), "Kangkung Segar", "Sayuran", 50.0, "ikat", 3000, 150000, "Pasar Tradisional", "Tumis kangkung saus tiram"),
        (two_days_ago.isoformat(), "Beras Rojolele Super", "Karbohidrat", 100.0, "kg", 14500, 1450000, "UD Tani Makmur", "Kebutuhan harian"),
    ]

    for p in sample_purchases:
        cursor.execute("""
            INSERT INTO `purchases` (`date`, `item_name`, `category`, `quantity`, `unit`, `unit_price`, `total_price`, `supplier`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, p)

    # 2. Sample Stok Sisa Bahan Pangan
    sample_inventory = [
        (today.isoformat(), "Beras Rojolele Super", "Karbohidrat", 35.0, "kg", "Baik / Segar", "Gudang Beras (Palet 1)", "Sisa pasok aman 1-2 hari"),
        (today.isoformat(), "Minyak Goreng Sawit", "Minyak & Bumbu", 8.0, "liter", "Baik / Segar", "Rak Bumbu Utama", "Sisa pemakaian gorengan"),
        (today.isoformat(), "Bawang Putih Kupas", "Minyak & Bumbu", 2.5, "kg", "Baik / Segar", "Chiller Sayur & Bumbu", "Harus digunakan besok pagi"),
        (today.isoformat(), "Wortel Segar Brastagi", "Sayuran", 4.0, "kg", "Perlu Segera Diolah", "Chiller Sayur Rak 2", "Kondisi baik, resep menu besok"),
        (today.isoformat(), "Garam Dapur Beriodium", "Minyak & Bumbu", 10.0, "bks", "Baik / Segar", "Rak Bumbu Kering", "Stok penyedap terkontrol"),
        (today.isoformat(), "Susu UHT MBG 125ml", "Susu & Pelengkap", 45.0, "kotak", "Baik / Segar", "Gudang Minuman", "Cadangan darurat / siswa tambahan")
    ]

    for inv in sample_inventory:
        cursor.execute("""
            INSERT INTO `inventory` (`date`, `item_name`, `category`, `remaining_qty`, `unit`, `item_condition`, `storage_location`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, inv)

    # 3. Sample Bahan Dibuang (Waste)
    sample_waste = [
        (today.isoformat(), "Wortel Segar Brastagi", "Sayuran", 1.5, "kg", 18000, "Busuk / Layu saat sortir", "Sortiran awal sebelum dicuci"),
        (yesterday.isoformat(), "Bayam Hijau Segar", "Sayuran", 3.0, "ikat", 9000, "Layu & Batang Rusak", "Kerusakan selama transit pengiriman"),
        (yesterday.isoformat(), "Tahu Putih Sutra", "Protein Nabati", 4.0, "potong", 8000, "Pecah & Asam", "Kualitas drop dari pemasok"),
        (two_days_ago.isoformat(), "Ikan Kembung Segar", "Protein Hewani", 1.2, "kg", 38400, "Insang memar / tidak lolos QC gizi", "Ditolak saat pemeriksaan mutu SPPG")
    ]

    for w in sample_waste:
        cursor.execute("""
            INSERT INTO `food_waste` (`date`, `item_name`, `category`, `waste_qty`, `unit`, `estimated_loss`, `reason`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, w)

    # 4. Sample Transaksi Keuangan (Arus Kas Masuk & Keluar)
    sample_finances = [
        # Pemasukan Dana MBG
        (three_days_ago.isoformat(), "INCOME", "Dana Anggaran MBG", 25000000, "Pencairan Tahap 1 Alokasi MBG Minggu Ke-1", "Badan Gizi Nasional / Kas Daerah", "SP2D-MBG-2026/001"),
        (yesterday.isoformat(), "INCOME", "Dana Anggaran MBG", 20000000, "Dropping Tambahan Operasional SPPG", "Kas APBD / Mitra MBG", "TRF-KAS-04921"),

        # Pengeluaran Belanja Pangan
        (two_days_ago.isoformat(), "EXPENSE", "Belanja Bahan Pangan", 3840000, "Belanja Ikan Kembung, Sayur Kangkung & Beras", "Pasar & Koperasi", "NOTA-PASAR-01"),
        (yesterday.isoformat(), "EXPENSE", "Belanja Bahan Pangan", 6175000, "Belanja Beras, Telur, Sayur, Jeruk & Tahu", "Pemasok Dapur", "NOTA-PASAR-02"),
        (today.isoformat(), "EXPENSE", "Belanja Bahan Pangan", 11165000, "Belanja Beras, Ayam Fillet, Sop, Tempe, Pisang & Susu MBG", "Mitra & Distributor", "NOTA-PASAR-03"),

        # Pengeluaran Operasional Dapur
        (three_days_ago.isoformat(), "EXPENSE", "Operasional Dapur", 450000, "Isi Ulang Gas LPG 12kg (3 Tabung)", "Pangkalan Gas Sejahtera", "STRUK-LPG-91"),
        (two_days_ago.isoformat(), "EXPENSE", "Kemasan & Distribusi", 600000, "Pembelian Ompreng Stainless Food Grade & Sendok", "Toko Kemasan Ramah Lingkungan", "NOTA-KMS-12"),
        (yesterday.isoformat(), "EXPENSE", "Operasional Dapur", 250000, "Air Mineral Galon Sanitasi Dapur (10 Galon)", "Depot Air Tirta Sehat", "STRUK-AIR-88"),
        (today.isoformat(), "EXPENSE", "Kemasan & Distribusi", 350000, "Bahan Bakar Transportasi Armada Pengantar MBG ke Sekolah", "SPBU Nusantara", "STRUK-BBM-77")
    ]

    for fin in sample_finances:
        cursor.execute("""
            INSERT INTO `finances` (`date`, `type`, `category`, `amount`, `description`, `source_or_recipient`, `ref_number`)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, fin)

if __name__ == "__main__":
    init_db()
    print("Database MySQL / MariaDB Dapur MBG berhasil diinisialisasi!")
