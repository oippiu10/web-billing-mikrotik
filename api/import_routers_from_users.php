<?php
/**
 * Script: Import router_id dari tabel users ke mikrotik_routers
 * Setiap router_id unik akan dibuat sebagai entri di mikrotik_routers
 * dengan software_id diisi, tapi host/password perlu diisi manual nanti
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=UTF-8');

// Ambil semua router_id unik dari tabel users
$ri = $conn->query("SELECT router_id, COUNT(*) as jml FROM users WHERE router_id IS NOT NULL AND router_id != '' GROUP BY router_id ORDER BY jml DESC");

$inserted = 0;
$skipped  = 0;
$details  = [];

while ($row = $ri->fetch_assoc()) {
    $sid  = $row['router_id'];
    $jml  = $row['jml'];

    // Cek apakah sudah ada di mikrotik_routers (by software_id)
    $check = $conn->prepare("SELECT id FROM mikrotik_routers WHERE software_id = ?");
    $check->bind_param("s", $sid);
    $check->execute();
    $exists = $check->get_result()->num_rows > 0;
    $check->close();

    if ($exists) {
        $skipped++;
        $details[] = ['software_id' => $sid, 'users' => (int)$jml, 'action' => 'SKIP (sudah ada)'];
        continue;
    }

    // Buat nama otomatis dari software_id
    $name = "Router-" . $sid;

    // Insert dengan host kosong — admin perlu isi nanti
    $ins = $conn->prepare("INSERT INTO mikrotik_routers (name, host, port, username, password, software_id, is_active, sort_order) VALUES (?, '', 8728, 'admin', '', ?, 0, 99)");
    $ins->bind_param("ss", $name, $sid);
    $ins->execute();
    $ins->close();

    $inserted++;
    $details[] = ['software_id' => $sid, 'users' => (int)$jml, 'action' => 'INSERTED'];
}

// Cek router pck-server yang sudah ada — jika software_id kosong, tanya user mana yang cocok
$existing = $conn->query("SELECT id, name, host, software_id FROM mikrotik_routers WHERE software_id IS NULL OR software_id = ''")->fetch_all(MYSQLI_ASSOC);

echo json_encode([
    'success'   => true,
    'inserted'  => $inserted,
    'skipped'   => $skipped,
    'details'   => $details,
    'routers_tanpa_software_id' => $existing,
    'pesan'     => $inserted > 0
        ? "Berhasil! $inserted router baru ditambahkan. Silakan isi IP & password di halaman Settings > Routers."
        : "Semua router sudah ada di database.",
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
