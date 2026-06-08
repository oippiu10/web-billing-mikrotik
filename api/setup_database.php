<?php
/**
 * SETUP DATABASE - Buat dan perbarui semua tabel yang dibutuhkan
 * Jalankan sekali via browser: https://billing.marzuqnetwork.online/api/setup_database.php
 * HAPUS atau rename file ini setelah selesai untuk keamanan!
 */

require_once __DIR__ . '/config.php';

$results = [];

function runSQL($conn, $tableName, $sql) {
    if ($conn->query($sql)) {
        return ['table' => $tableName, 'status' => '✅ OK', 'message' => 'Berhasil dibuat / sudah diperbarui'];
    } else {
        return ['table' => $tableName, 'status' => '❌ ERROR', 'message' => $conn->error];
    }
}

function ensureColumnExists($conn, $table, $column, $definition) {
    $res = $conn->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    if ($res && $res->num_rows === 0) {
        if ($conn->query("ALTER TABLE `$table` ADD COLUMN `$column` $definition")) {
            return ['table' => "$table ($column)", 'status' => '✅ OK', 'message' => 'Kolom berhasil ditambahkan'];
        } else {
            return ['table' => "$table ($column)", 'status' => '❌ ERROR', 'message' => $conn->error];
        }
    }
    return ['table' => "$table ($column)", 'status' => 'ℹ️ SKIP', 'message' => 'Kolom sudah ada'];
}

// ─── 1. Tabel INVOICES ───────────────────────────────────────────────────────────
$results[] = runSQL($conn, 'invoices', "
    CREATE TABLE IF NOT EXISTS `invoices` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` int(11) NOT NULL,
        `router_id` varchar(100) NOT NULL,
        `month` tinyint(2) NOT NULL,
        `year` smallint(4) NOT NULL,
        `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
        `status` enum('unpaid','paid','isolir') NOT NULL DEFAULT 'unpaid',
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_invoice` (`user_id`, `router_id`, `month`, `year`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 2. Tabel PAYMENTS ───────────────────────────────────────────────────────────
$results[] = runSQL($conn, 'payments', "
    CREATE TABLE IF NOT EXISTS `payments` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` int(11) NOT NULL,
        `router_id` varchar(100) NOT NULL,
        `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
        `payment_date` date NOT NULL,
        `payment_month` tinyint(2) NOT NULL,
        `payment_year` smallint(4) NOT NULL,
        `method` varchar(50) DEFAULT 'cash',
        `note` text DEFAULT NULL,
        `target_amount` decimal(15,2) DEFAULT NULL,
        `created_by` int(11) DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_user_month` (`user_id`, `payment_month`, `payment_year`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 3. Tabel PPP_PROFILE_PRICING ────────────────────────────────────────────────
$results[] = runSQL($conn, 'ppp_profile_pricing', "
    CREATE TABLE IF NOT EXISTS `ppp_profile_pricing` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `router_id` varchar(100) NOT NULL,
        `profile_name` varchar(100) NOT NULL,
        `price` decimal(15,2) NOT NULL DEFAULT 0.00,
        `description` text DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_profile` (`router_id`, `profile_name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 4. Tabel EXPENSES ───────────────────────────────────────────────────────────
$results[] = runSQL($conn, 'expenses', "
    CREATE TABLE IF NOT EXISTS `expenses` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `router_id` varchar(100) NOT NULL,
        `category` varchar(100) DEFAULT NULL,
        `description` text NOT NULL,
        `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
        `spent_at` date NOT NULL,
        `created_by` int(11) DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_router_date` (`router_id`, `spent_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 5. Tabel ODP ────────────────────────────────────────────────────────────────
$results[] = runSQL($conn, 'odp', "
    CREATE TABLE IF NOT EXISTS `odp` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `router_id` varchar(100) DEFAULT NULL,
        `name` varchar(100) NOT NULL,
        `address` text DEFAULT NULL,
        `lat` decimal(10,7) DEFAULT NULL,
        `lng` decimal(10,7) DEFAULT NULL,
        `capacity` int(11) DEFAULT 8,
        `notes` text DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 6. Tabel WA_SETTINGS & WA_QUEUE ───────────────────────────────────────────────
$results[] = runSQL($conn, 'wa_settings', "
    CREATE TABLE IF NOT EXISTS `wa_settings` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `gateway_type` ENUM('fonnte', 'custom') DEFAULT 'fonnte',
        `api_token` VARCHAR(255) NULL,
        `custom_url` VARCHAR(255) NULL,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// Insert default wa_settings if empty
$res = $conn->query("SELECT COUNT(*) as count FROM wa_settings");
if ($res && $res->fetch_assoc()['count'] == 0) {
    $conn->query("INSERT INTO wa_settings (gateway_type, api_token) VALUES ('fonnte', '')");
}

$results[] = runSQL($conn, 'wa_queue', "
    CREATE TABLE IF NOT EXISTS `wa_queue` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `router_id` VARCHAR(100) NOT NULL,
        `phone` VARCHAR(30) NOT NULL,
        `message` TEXT NOT NULL,
        `status` ENUM('pending', 'sending', 'sent', 'failed') DEFAULT 'pending',
        `error_message` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `sent_at` TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 7. Tabel MIKROTIK_ROUTERS ───────────────────────────────────────────────────
$results[] = runSQL($conn, 'mikrotik_routers', "
    CREATE TABLE IF NOT EXISTS `mikrotik_routers` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 8. Tabel WEB_SETTINGS ───────────────────────────────────────────────────────
$results[] = runSQL($conn, 'web_settings', "
    CREATE TABLE IF NOT EXISTS `web_settings` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `setting_key` varchar(100) NOT NULL,
        `setting_value` text DEFAULT NULL,
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_key` (`setting_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
");

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
if ($stmt) {
    foreach ($defaults as [$key, $val]) {
        $stmt->bind_param("ss", $key, $val);
        $stmt->execute();
    }
    $stmt->close();
}

// ─── 9. Tabel TENANTS ────────────────────────────────────────────────────────────
$results[] = runSQL($conn, 'tenants', "
    CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        domain VARCHAR(150) DEFAULT '',
        contact_name VARCHAR(100) DEFAULT '',
        contact_email VARCHAR(150) DEFAULT '',
        contact_phone VARCHAR(30) DEFAULT '',
        plan ENUM('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
        status ENUM('trial','active','suspended') NOT NULL DEFAULT 'trial',
        max_routers INT NOT NULL DEFAULT 3,
        max_users INT NOT NULL DEFAULT 1,
        api_key VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 10. Tabel INVENTORY & MOVEMENTS ─────────────────────────────────────────────
$results[] = runSQL($conn, 'inventory', "
    CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Lainnya',
        stock INT NOT NULL DEFAULT 0,
        unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
        price DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_router_category (router_id, category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// Migrasi kolom untuk inventory
$results[] = ensureColumnExists($conn, 'inventory', 'price', 'DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER stock');
$results[] = ensureColumnExists($conn, 'inventory', 'unit', 'VARCHAR(30) NOT NULL DEFAULT "pcs" AFTER stock');
$results[] = ensureColumnExists($conn, 'inventory', 'description', 'TEXT NULL AFTER price');
$results[] = ensureColumnExists($conn, 'inventory', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

$results[] = runSQL($conn, 'inventory_movements', "
    CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        inventory_id INT NOT NULL,
        type ENUM('in','out','adjust') NOT NULL,
        qty INT NOT NULL DEFAULT 0,
        note VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory (inventory_id),
        INDEX idx_router_created (router_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 11. Tabel TICKETS & SPK ─────────────────────────────────────────────────────
$results[] = runSQL($conn, 'tickets', "
    CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        username VARCHAR(120) NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Gangguan',
        priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
        status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_router_status (router_id, status),
        INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$results[] = runSQL($conn, 'spk', "
    CREATE TABLE IF NOT EXISTS spk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        technician_name VARCHAR(120) NOT NULL,
        task_description TEXT NULL,
        status ENUM('Assigned','On Progress','Done','Canceled') NOT NULL DEFAULT 'Assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 12. Tabel OLTS & OLT_ONUS ───────────────────────────────────────────────────
$results[] = runSQL($conn, 'olts', "
    CREATE TABLE IF NOT EXISTS olts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        brand VARCHAR(80) NOT NULL DEFAULT 'Generic',
        host VARCHAR(120) NOT NULL,
        port INT NOT NULL DEFAULT 23,
        protocol ENUM('snmp','telnet','ssh','api','manual') NOT NULL DEFAULT 'manual',
        username VARCHAR(120) NULL,
        password VARCHAR(190) NULL,
        snmp_community VARCHAR(120) NULL,
        pon_ports INT NOT NULL DEFAULT 0,
        total_onu INT NOT NULL DEFAULT 0,
        online_onu INT NOT NULL DEFAULT 0,
        offline_onu INT NOT NULL DEFAULT 0,
        status ENUM('unknown','online','offline','maintenance') NOT NULL DEFAULT 'unknown',
        location VARCHAR(190) NULL,
        note TEXT NULL,
        last_checked_at DATETIME NULL,
        last_check_message VARCHAR(255) NULL,
        response_ms INT NULL,
        sys_name VARCHAR(190) NULL,
        sys_descr TEXT NULL,
        sys_uptime VARCHAR(190) NULL,
        last_snmp_at DATETIME NULL,
        web_username VARCHAR(120) NULL,
        web_password VARCHAR(190) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status), INDEX idx_brand (brand)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$results[] = runSQL($conn, 'olt_onus', "
    CREATE TABLE IF NOT EXISTS olt_onus (
        id INT AUTO_INCREMENT PRIMARY KEY,
        olt_id INT NOT NULL,
        pon VARCHAR(20) NULL,
        onu_no VARCHAR(20) NULL,
        onu_id VARCHAR(30) NULL,
        name VARCHAR(120) NULL,
        mac VARCHAR(32) NULL,
        status VARCHAR(30) NULL,
        auth_state VARCHAR(30) NULL,
        register_time VARCHAR(40) NULL,
        last_deregister_time VARCHAR(40) NULL,
        last_deregister_reason VARCHAR(80) NULL,
        device_type VARCHAR(40) NULL,
        onu_type VARCHAR(40) NULL,
        round_trip_time VARCHAR(40) NULL,
        receive_power VARCHAR(40) NULL,
        raw_line TEXT NULL,
        last_seen_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_olt_onu (olt_id, onu_id),
        INDEX idx_olt_status (olt_id, status), INDEX idx_mac (mac), INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 13. Tabel FINANCE_NOTES ─────────────────────────────────────────────────────
$results[] = runSQL($conn, 'finance_notes', "
    CREATE TABLE IF NOT EXISTS finance_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        month TINYINT(2) NOT NULL,
        year SMALLINT(4) NOT NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_month_year (month, year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 14. Tabel MIKROTIK_CACHE ────────────────────────────────────────────────────
$results[] = runSQL($conn, 'mikrotik_cache', "
    CREATE TABLE IF NOT EXISTS mikrotik_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id VARCHAR(100) NOT NULL,
        cache_key VARCHAR(100) NOT NULL,
        cache_value LONGTEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_router_key (router_id, cache_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 15. Tabel AUTOMATION_LOGS ───────────────────────────────────────────────────
$results[] = runSQL($conn, 'automation_logs', "
    CREATE TABLE IF NOT EXISTS automation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id VARCHAR(64) NOT NULL,
        period_month INT DEFAULT NULL,
        period_year INT DEFAULT NULL,
        action VARCHAR(50) NOT NULL,
        dry_run TINYINT(1) DEFAULT 1,
        username VARCHAR(150) DEFAULT NULL,
        status VARCHAR(80) DEFAULT NULL,
        secret_id VARCHAR(80) DEFAULT NULL,
        admin_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_router_created (router_id, created_at),
        INDEX idx_period (period_month, period_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 16. Tabel NETWORK_LINES ─────────────────────────────────────────────────────
$results[] = runSQL($conn, 'network_lines', "
    CREATE TABLE IF NOT EXISTS `network_lines` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `router_id` varchar(100) NOT NULL DEFAULT '',
        `name` varchar(150) NOT NULL,
        `type` varchar(50) NOT NULL DEFAULT 'manual',
        `path` longtext NOT NULL,
        `color` varchar(20) DEFAULT '#3b82f6',
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_router_id` (`router_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 17. Tabel ADMIN_ACTIVITY_LOGS ───────────────────────────────────────────────
$results[] = runSQL($conn, 'admin_activity_logs', "
    CREATE TABLE IF NOT EXISTS `admin_activity_logs` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NULL,
        `action` VARCHAR(100) NOT NULL,
        `description` TEXT NULL,
        `ip_address` VARCHAR(45) NULL,
        `user_agent` VARCHAR(255) NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

// ─── 18. Tabel USERS (Alters) ─────────────────────────────────────────────────────
$results[] = ensureColumnExists($conn, 'users', 'odp_id', 'int(11) DEFAULT NULL');
$results[] = ensureColumnExists($conn, 'users', 'tipe_langganan', "varchar(20) DEFAULT 'pascabayar'");
$results[] = ensureColumnExists($conn, 'payments', 'target_amount', 'decimal(15,2) DEFAULT NULL');

// ─── Cek semua tabel yang ada ─────────────────────────────────────────────────
$check = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $check->fetch_row()) {
    $tables[] = $row[0];
}

// Output HTML yang mudah dibaca
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Setup Database</title>
<style>
body { font-family: sans-serif; padding: 30px; background: #0f172a; color: #e2e8f0; }
h1 { color: #38bdf8; }
table { border-collapse: collapse; width: 100%; margin-top: 20px; }
th, td { padding: 10px 15px; text-align: left; border: 1px solid #334155; }
th { background: #1e293b; color: #94a3b8; font-size: 12px; text-transform: uppercase; }
.ok { color: #4ade80; }
.error { color: #f87171; }
.skip { color: #fbbf24; }
.tables { background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 20px; }
.tables span { display: inline-block; background: #0ea5e9; color: white; padding: 3px 8px; border-radius: 4px; margin: 3px; font-size: 12px; }
.warning { background: #7c3aed; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; }
</style>
</head>
<body>
<h1>🗄️ Setup Database & Migrasi — Billing MikroTik</h1>
<p>Hasil instalasi & pengecekan tabel:</p>
<table>
<tr><th>#</th><th>Objek (Tabel / Kolom)</th><th>Status</th><th>Keterangan</th></tr>
<?php foreach ($results as $i => $r): ?>
<tr>
    <td><?= $i+1 ?></td>
    <td><strong><?= htmlspecialchars($r['table']) ?></strong></td>
    <td class="<?= strpos($r['status'], 'OK') !== false ? 'ok' : (strpos($r['status'], 'SKIP') !== false ? 'skip' : 'error') ?>"><?= $r['status'] ?></td>
    <td><?= htmlspecialchars($r['message']) ?></td>
</tr>
<?php endforeach; ?>
</table>

<div class="tables">
    <strong>Semua tabel di database (<?= count($tables) ?> tabel):</strong><br><br>
    <?php foreach ($tables as $t): ?>
    <span><?= $t ?></span>
    <?php endforeach; ?>
</div>

<div class="warning">
    ⚠️ <strong>PENTING:</strong> Setelah setup selesai di hosting, demi keamanan segera hapus file ini dari server atau ubah namanya menjadi acak agar tidak bisa diakses oleh publik!
</div>
</body>
</html>
