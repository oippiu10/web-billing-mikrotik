<?php
// CLI version - no header() calls
define('CLI_MODE', true);

$host = '127.0.0.1';
$db   = 'pppoe_monitor';
$user = 'root';
$pass = 'yahahahusein112';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("Gagal konek: " . $conn->connect_error . PHP_EOL);
}
mysqli_set_charset($conn, 'utf8mb4');

echo "=== Import Router IDs dari users ke mikrotik_routers ===" . PHP_EOL . PHP_EOL;

// Ambil semua router_id unik dari tabel users
$ri = $conn->query("SELECT router_id, COUNT(*) as jml FROM users WHERE router_id IS NOT NULL AND router_id != '' GROUP BY router_id ORDER BY jml DESC");

$inserted = 0;
$skipped  = 0;

while ($row = $ri->fetch_assoc()) {
    $sid = $row['router_id'];
    $jml = $row['jml'];

    // Cek apakah sudah ada
    $check = $conn->prepare("SELECT id FROM mikrotik_routers WHERE software_id = ?");
    $check->bind_param("s", $sid);
    $check->execute();
    $exists = $check->get_result()->num_rows > 0;
    $check->close();

    if ($exists) {
        echo "[SKIP]     $sid ($jml users) - sudah ada" . PHP_EOL;
        $skipped++;
        continue;
    }

    $name = "Router-" . $sid;
    // Gunakan software_id sebagai host placeholder agar tidak konflik UNIQUE KEY (host,port)
    $ins = $conn->prepare("INSERT INTO mikrotik_routers (name, host, port, username, password, software_id, is_active, sort_order) VALUES (?, ?, 8728, 'admin', '', ?, 0, 99)");
    $ins->bind_param("sss", $name, $sid, $sid);
    if ($ins->execute()) {
        echo "[INSERT]   $sid ($jml users) - berhasil ditambahkan" . PHP_EOL;
        $inserted++;
    } else {
        echo "[ERROR]    $sid - " . $conn->error . PHP_EOL;
    }
    $ins->close();
}

echo PHP_EOL . "=== Hasil ===" . PHP_EOL;
echo "Inserted: $inserted" . PHP_EOL;
echo "Skipped : $skipped" . PHP_EOL;

echo PHP_EOL . "=== Semua Router di mikrotik_routers sekarang ===" . PHP_EOL;
$all = $conn->query("SELECT id, name, host, software_id, is_active FROM mikrotik_routers ORDER BY id");
while ($row = $all->fetch_assoc()) {
    $active = $row['is_active'] ? "[AKTIF]" : "[nonaktif]";
    echo "$active ID:{$row['id']} | name:{$row['name']} | host:{$row['host']} | software_id:{$row['software_id']}" . PHP_EOL;
}

echo PHP_EOL . "SELESAI. Silakan isi IP & password router di halaman Settings > Routers." . PHP_EOL;
?>
