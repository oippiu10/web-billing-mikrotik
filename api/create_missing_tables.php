<?php
// Script untuk membuat tabel yang hilang di database pppoe_monitor
require_once __DIR__ . '/config.php';

$results = [];

// ─── 1. Buat tabel mikrotik_routers ──────────────────────────────────────────
$sql_routers = "CREATE TABLE IF NOT EXISTS `mikrotik_routers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '',
  `host` varchar(255) NOT NULL,
  `port` int(11) NOT NULL DEFAULT 8728,
  `username` varchar(100) NOT NULL DEFAULT 'admin',
  `password` varchar(255) NOT NULL DEFAULT '',
  `software_id` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_host_port` (`host`, `port`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";

if ($conn->query($sql_routers)) {
    $results[] = ['table' => 'mikrotik_routers', 'status' => 'OK', 'message' => 'Berhasil dibuat'];
} else {
    $results[] = ['table' => 'mikrotik_routers', 'status' => 'ERROR', 'message' => $conn->error];
}

// ─── 2. Buat tabel web_settings ───────────────────────────────────────────────
$sql_settings = "CREATE TABLE IF NOT EXISTS `web_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";

if ($conn->query($sql_settings)) {
    $results[] = ['table' => 'web_settings', 'status' => 'OK', 'message' => 'Berhasil dibuat'];

    // Insert default settings
    $defaults = [
        ['isp_name',        'ISP Saya'],
        ['isp_tagline',     'Layanan Internet Cepat & Terpercaya'],
        ['isp_address',     ''],
        ['isp_phone',       ''],
        ['isp_email',       ''],
        ['currency',        'Rp'],
        ['tax_percent',     '0'],
        ['whatsapp_api',    ''],
        ['genieacs_url',    ''],
        ['genieacs_user',   ''],
        ['genieacs_pass',   ''],
    ];
    $stmt = $conn->prepare("INSERT IGNORE INTO web_settings (setting_key, setting_value) VALUES (?, ?)");
    foreach ($defaults as [$key, $val]) {
        $stmt->bind_param("ss", $key, $val);
        $stmt->execute();
    }
    $results[] = ['table' => 'web_settings', 'status' => 'OK', 'message' => 'Default settings dimasukkan'];
} else {
    $results[] = ['table' => 'web_settings', 'status' => 'ERROR', 'message' => $conn->error];
}

// ─── 3. Cek semua tabel setelah perbaikan ─────────────────────────────────────
$check = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $check->fetch_row()) {
    $tables[] = $row[0];
}

echo json_encode([
    'success' => true,
    'actions' => $results,
    'all_tables' => $tables,
    'total_tables' => count($tables)
], JSON_PRETTY_PRINT);
?>
