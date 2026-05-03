<?php
/**
 * Script: Update software_id router pck-server
 * Jalankan: php update_router_softwareid.php SOFTWARE_ID_DISINI
 * Contoh:   php update_router_softwareid.php BI5L-CWRV
 */
$host = '127.0.0.1';
$db   = 'pppoe_monitor';
$user = 'root';
$pass = 'yahahahusein112';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) die("Gagal konek: " . $conn->connect_error . PHP_EOL);
mysqli_set_charset($conn, 'utf8mb4');

// Ambil software_id dari argument CLI
$software_id = trim($argv[1] ?? '');
$router_id   = intval($argv[2] ?? 1); // default: update router ID=1 (pck-server)

if (empty($software_id)) {
    echo "Usage: php update_router_softwareid.php <SOFTWARE_ID> [ROUTER_DB_ID]" . PHP_EOL;
    echo "Contoh: php update_router_softwareid.php BI5L-CWRV 1" . PHP_EOL;
    echo PHP_EOL;
    echo "=== Router yang ada (tanpa software_id) ===" . PHP_EOL;
    $r = $conn->query("SELECT id, name, host, software_id FROM mikrotik_routers WHERE software_id IS NULL OR software_id = '' OR software_id = host ORDER BY id");
    while ($row = $r->fetch_assoc()) {
        echo "  ID:{$row['id']} | name:{$row['name']} | host:{$row['host']} | software_id:{$row['software_id']}" . PHP_EOL;
    }
    echo PHP_EOL;
    echo "=== Software ID yang ada di data users ===" . PHP_EOL;
    $u = $conn->query("SELECT router_id, COUNT(*) as jml FROM users GROUP BY router_id ORDER BY jml DESC");
    while ($row = $u->fetch_assoc()) {
        echo "  software_id:{$row['router_id']} | pelanggan:{$row['jml']}" . PHP_EOL;
    }
    exit;
}

// Cek apakah software_id ini ada di data users
$cek = $conn->prepare("SELECT COUNT(*) as cnt FROM users WHERE router_id = ?");
$cek->bind_param("s", $software_id);
$cek->execute();
$cnt = $cek->get_result()->fetch_assoc()['cnt'];
echo "Jumlah pelanggan dengan router_id '$software_id': $cnt" . PHP_EOL;

// Update router
$upd = $conn->prepare("UPDATE mikrotik_routers SET software_id = ? WHERE id = ?");
$upd->bind_param("si", $software_id, $router_id);
if ($upd->execute()) {
    echo "Berhasil! Router ID=$router_id sekarang punya software_id='$software_id'" . PHP_EOL;
} else {
    echo "Gagal: " . $conn->error . PHP_EOL;
}

// Juga update host placeholder ke host yang benar jika perlu
echo PHP_EOL . "=== Status router setelah update ===" . PHP_EOL;
$r = $conn->query("SELECT id, name, host, software_id, is_active FROM mikrotik_routers ORDER BY id");
while ($row = $r->fetch_assoc()) {
    $status = $row['is_active'] ? '[AKTIF]' : '[nonaktif]';
    echo "$status ID:{$row['id']} | {$row['name']} | host:{$row['host']} | software_id:{$row['software_id']}" . PHP_EOL;
}
?>
