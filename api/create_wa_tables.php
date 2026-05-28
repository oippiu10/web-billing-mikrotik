<?php
/**
 * Create WA Tables Database Migration
 */
require_once __DIR__ . '/config.php';

echo "Memulai migrasi database...\n";

// 1. Tabel wa_settings
$sqlSettings = "
CREATE TABLE IF NOT EXISTS wa_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gateway_type ENUM('fonnte', 'custom') DEFAULT 'fonnte',
    api_token VARCHAR(255) NULL,
    custom_url VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if ($conn->query($sqlSettings)) {
    echo "✓ Tabel 'wa_settings' berhasil dibuat/sudah ada.\n";
} else {
    echo "✗ Gagal membuat tabel 'wa_settings': " . $conn->error . "\n";
}

// Cek jika wa_settings kosong, masukkan default
$res = $conn->query("SELECT COUNT(*) as count FROM wa_settings");
if ($res && $res->fetch_assoc()['count'] == 0) {
    $conn->query("INSERT INTO wa_settings (gateway_type, api_token) VALUES ('fonnte', '')");
    echo "✓ Data default wa_settings ditambahkan.\n";
}

// 2. Tabel wa_queue
$sqlQueue = "
CREATE TABLE IF NOT EXISTS wa_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('pending', 'sending', 'sent', 'failed') DEFAULT 'pending',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if ($conn->query($sqlQueue)) {
    echo "✓ Tabel 'wa_queue' berhasil dibuat/sudah ada.\n";
} else {
    echo "✗ Gagal membuat tabel 'wa_queue': " . $conn->error . "\n";
}

echo "Migrasi selesai!\n";
?>
