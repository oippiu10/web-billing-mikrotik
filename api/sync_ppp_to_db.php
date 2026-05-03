<?php
/**
 * Mikrotik Sync API (Web Version)
 * Syncs PPP secrets from Mikrotik to local database 'users' table.
 */
ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_NOTICE);
ini_set('memory_limit', '256M');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

// Ambil router_id dari GET (software_id dari Mikrotik)
$router_id = $_GET['router_id'] ?? '';

if (empty($router_id)) {
    echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
    exit;
}

try {
    // 1. Dapatkan detail router dari DB berdasarkan software_id atau ID
    // Frontend mengirim Software ID sebagai router_id
    $stmt = $conn->prepare("SELECT id, host, port, username, password, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmt->bind_param("ss", $router_id, $router_id);
    $stmt->execute();
    $router = $stmt->get_result()->fetch_assoc();

    if (!$router) {
        throw new Exception("Router tidak ditemukan di database.");
    }

    $host = $router['host'];
    $port = intval($router['port']) ?: 8728;
    $user = $router['username'];
    $pass = $router['password'];
    $db_router_id = $router['software_id'] ?: $router_id; // Gunakan software_id asli dari DB

    // 2. Connect ke Mikrotik
    $api = new RouterosAPI();
    $api->port = $port;
    $api->timeout = 10;

    if (!$api->connect($host, $user, $pass)) {
        throw new Exception("Gagal konek ke Mikrotik $host");
    }

    // 3. Ambil data PPP Secret
    $secrets = $api->comm('/ppp/secret/print');
    $api->disconnect();

    if (!is_array($secrets)) {
        throw new Exception("Gagal mengambil data ppp secret atau hasil kosong.");
    }

    // 4. Proses Sinkronisasi ke Database
    $added = 0;
    $updated = 0;
    $deleted = 0;

    // Gunakan transaksi untuk performa
    $conn->begin_transaction();

    // Ambil daftar username dari MikroTik.
    // Sync dibuat hard sync: user DB yang sudah tidak ada di PPP Secret akan dihapus.
    $secretUsernames = [];

    foreach ($secrets as $s) {
        $username = $s['name'] ?? '';
        if (empty($username))
            continue;

        $password = $s['plain-password'] ?? ($s['password'] ?? '');
        $profile = $s['profile'] ?? 'default';
        $secretUsernames[] = $username;

        // Cek apakah user sudah ada
        $check = $conn->prepare("SELECT id FROM users WHERE router_id = ? AND username = ?");
        $check->bind_param("ss", $db_router_id, $username);
        $check->execute();
        $res = $check->get_result();

        if ($res->num_rows > 0) {
            // Update & set on_router = 1
            $upd = $conn->prepare("UPDATE users SET password = ?, profile = ?, on_router = 1, updated_at = NOW() WHERE router_id = ? AND username = ?");
            $upd->bind_param("ssss", $password, $profile, $db_router_id, $username);
            $upd->execute();
            $updated++;
        } else {
            // Insert & set on_router = 1
            $ins = $conn->prepare("INSERT INTO users (router_id, username, password, profile, on_router, tanggal_dibuat) VALUES (?, ?, ?, ?, 1, NOW())");
            $ins->bind_param("ssss", $db_router_id, $username, $password, $profile);
            $ins->execute();
            $added++;
        }
    }

    if (count($secretUsernames) > 0) {
        $safeRouterId = $conn->real_escape_string($db_router_id);
        $safeUserList = implode(',', array_map(function ($name) use ($conn) {
            return "'" . $conn->real_escape_string($name) . "'";
        }, $secretUsernames));

        $conn->query("DELETE p FROM payments p INNER JOIN users u ON p.user_id = u.id WHERE u.router_id = '{$safeRouterId}' AND u.username NOT IN ({$safeUserList})");
        $conn->query("DELETE FROM users WHERE router_id = '{$safeRouterId}' AND username NOT IN ({$safeUserList})");
        $deleted = $conn->affected_rows;
    } else {
        $delPayments = $conn->prepare("DELETE p FROM payments p INNER JOIN users u ON p.user_id = u.id WHERE u.router_id = ?");
        $delPayments->bind_param('s', $db_router_id);
        $delPayments->execute();
        $delPayments->close();

        $delUsers = $conn->prepare("DELETE FROM users WHERE router_id = ?");
        $delUsers->bind_param('s', $db_router_id);
        $delUsers->execute();
        $deleted = $delUsers->affected_rows;
        $delUsers->close();
    }

    (new MikrotikCache($conn))->invalidate("mt_{$router['id']}_ppp_secret");
    // Jangan invalidate ppp_active di sini. Kalau cache active dikosongkan saat auto-sync,
    // halaman pelanggan akan menganggap semua user offline sampai data active terisi lagi.

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Sinkronisasi berhasil',
        'details' => [
            'added' => $added,
            'updated' => $updated,
            'deleted' => $deleted,
            'total_mikrotik' => count($secrets)
        ]
    ]);

} catch (Exception $e) {
    // Rollback hanya jika ada koneksi
    if (isset($conn))
        $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>