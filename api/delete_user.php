<?php
/**
 * Delete User — Hapus user PPPoE dari DB dan Mikrotik
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang boleh menghapus pelanggan.');

$input = json_decode(file_get_contents('php://input'), true);
$usernames = $input['username'] ?? ($input['usernames'] ?? []);
$routerId = trim($input['router_id'] ?? '');

if (empty($routerId)) {
    echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
    exit;
}

// Resolve router DB: ambil software_id untuk filter users dan kredensial untuk hapus PPP Secret
$routerInternalId = null;
$routerHost = $input['router_host'] ?? null;
$routerPort = intval($input['router_port'] ?? 8728);
$routerUser = $input['router_user'] ?? 'admin';
$routerPass = $input['router_pass'] ?? '';

$stmtR = $conn->prepare("SELECT id, host, username, password, port, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
$stmtR->bind_param("ss", $routerId, $routerId);
$stmtR->execute();
$resR = $stmtR->get_result();
if ($rowR = $resR->fetch_assoc()) {
    $routerInternalId = $rowR['id'];
    if (!empty($rowR['software_id'])) {
        $routerId = $rowR['software_id'];
    }
    if ($routerHost === null || $routerHost === '') {
        $routerHost = $rowR['host'];
        $routerUser = $rowR['username'];
        $routerPass = $rowR['password'];
        $routerPort = intval($rowR['port']) ?: $routerPort;
    }
}
$stmtR->close();

// Convert single username to array for uniform processing
if (!is_array($usernames)) {
    $usernames = [$usernames];
}
$usernames = array_filter(array_map('trim', $usernames));

if (empty($usernames)) {
    echo json_encode(['success' => false, 'message' => 'Tidak ada username yang dipilih']);
    exit;
}

if ($routerHost !== null && $routerHost !== '' && $routerPass === '') {
    $stmtP = $conn->prepare("SELECT username, password, port FROM mikrotik_routers WHERE host = ? LIMIT 1");
    $stmtP->bind_param("s", $routerHost);
    $stmtP->execute();
    $resP = $stmtP->get_result();
    if ($rowP = $resP->fetch_assoc()) {
        $routerUser = $rowP['username'];
        $routerPass = $rowP['password'];
        $routerPort = $rowP['port'] ?: $routerPort;
    }
    $stmtP->close();
}

$successCount = 0;
$failCount = 0;
$messages = [];

try {
    $api = null;
    if ($routerHost) {
        $api = new RouterosAPI();
        $api->port = $routerPort;
        if (!$api->connect($routerHost, $routerUser, $routerPass)) {
            $api = null;
        }
    }

    foreach ($usernames as $username) {
        // Ambil user_id terlebih dahulu
        $stmtId = $conn->prepare("SELECT id FROM users WHERE username = ? AND router_id = ?");
        $stmtId->bind_param('ss', $username, $routerId);
        $stmtId->execute();
        $resId = $stmtId->get_result();
        $userId = $resId->num_rows > 0 ? $resId->fetch_assoc()['id'] : null;
        $stmtId->close();

        // Hapus payments terkait
        if ($userId) {
            $stmt2 = $conn->prepare("DELETE FROM payments WHERE user_id = ?");
            $stmt2->bind_param('i', $userId);
            $stmt2->execute();
            $stmt2->close();
        }

        // Hapus dari DB
        $stmt = $conn->prepare("DELETE FROM users WHERE username = ? AND router_id = ?");
        $stmt->bind_param('ss', $username, $routerId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        // Sync hapus ke Mikrotik
        if ($api) {
            $secrets = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (!empty($secrets[0]['.id'])) {
                $api->comm('/ppp/secret/remove', ['numbers' => $secrets[0]['.id']]);
            }
        }

        if ($affected > 0) {
            $successCount++;
        } else {
            $failCount++;
        }
    }

    if ($api) {
        $api->disconnect();
        $cacheKeyRouter = $routerInternalId ?: "{$routerHost}_{$routerPort}";
        (new MikrotikCache($conn))->invalidate("mt_{$cacheKeyRouter}_ppp_secret");
    }

    if ($successCount > 0) {
        log_admin_activity($conn, 'customer_delete', "$successCount user berhasil dihapus" . ($failCount > 0 ? ", $failCount gagal" : ""), (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode([
            'success' => true,
            'message' => "$successCount user berhasil dihapus" . ($failCount > 0 ? ", $failCount gagal" : ""),
            'deleted_count' => $successCount
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Gagal menghapus user atau user tidak ditemukan']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>