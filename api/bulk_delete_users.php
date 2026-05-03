<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang boleh bulk delete pelanggan.');

$data = json_decode(file_get_contents("php://input"));

if (!$data || !isset($data->usernames) || !isset($data->router_id)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid input"]);
    exit();
}

$usernames = $data->usernames; // Array of usernames
$router_id = $data->router_id;

if (empty($usernames)) {
    echo json_encode(["success" => true, "message" => "No users selected"]);
    exit();
}

try {
    // 1. Dapatkan detail router untuk sinkronisasi hapus di MikroTik
    $routerStmt = $conn->prepare("SELECT id, host, username, password, port, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $routerStmt->bind_param("ss", $router_id, $router_id);
    $routerStmt->execute();
    $routerData = $routerStmt->get_result()->fetch_assoc();
    $routerStmt->close();

    $db_router_id = $routerData && !empty($routerData['software_id']) ? $routerData['software_id'] : $router_id;

    $deleted_db = 0;
    $deleted_mikrotik = 0;

    // 2. Loop dan Hapus
    $conn->begin_transaction();
    
    // Siapkan statement hapus payment dan DB
    $findUserStmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND router_id = ?");
    $delPaymentStmt = $conn->prepare("DELETE FROM payments WHERE user_id = ?");
    $delStmt = $conn->prepare("DELETE FROM users WHERE username = ? AND router_id = ?");
    
    // MikroTik API
    $API = new RouterosAPI();
    $mt_connected = false;
    if ($routerData) {
        $API->port = (int)$routerData['port'];
        $mt_connected = $API->connect($routerData['host'], $routerData['username'], $routerData['password']);
    }

    foreach ($usernames as $user) {
        // Hapus payment terkait lalu hapus dari DB
        $findUserStmt->bind_param("ss", $user, $db_router_id);
        $findUserStmt->execute();
        $userRow = $findUserStmt->get_result()->fetch_assoc();
        if ($userRow) {
            $uid = (int)$userRow['id'];
            $delPaymentStmt->bind_param("i", $uid);
            $delPaymentStmt->execute();
        }

        $delStmt->bind_param("ss", $user, $db_router_id);
        if ($delStmt->execute() && $delStmt->affected_rows > 0) {
            $deleted_db++;
        }

        // Hapus dari MikroTik
        if ($mt_connected) {
            $secrets = $API->comm('/ppp/secret/print', ['?name' => $user]);
            if (!empty($secrets[0]['.id'])) {
                $API->comm('/ppp/secret/remove', ['numbers' => $secrets[0]['.id']]);
                $deleted_mikrotik++;
            }
        }
    }

    $conn->commit();
    $findUserStmt->close();
    $delPaymentStmt->close();
    $delStmt->close();
    if ($mt_connected) {
        $API->disconnect();
        $cacheKeyRouter = $routerData['id'] ?: $router_id;
        (new MikrotikCache($conn))->invalidate("mt_{$cacheKeyRouter}_ppp_secret");
    }

    echo json_encode([
        "success" => true,
        "message" => "Berhasil menghapus $deleted_db pelanggan dari database" . ($mt_connected ? " dan $deleted_mikrotik dari MikroTik." : "."),
        "deleted_count" => $deleted_db
    ]);

} catch (Exception $e) {
    if ($conn) $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
$conn->close();
?>
