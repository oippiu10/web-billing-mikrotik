<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

$user_id = intval($_GET['id'] ?? 0);
$username = trim($_GET['username'] ?? '');

if (!$user_id && $username === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter id atau username wajib diisi.']);
    exit();
}

// Fetch complete user details from DB
$sql = "SELECT u.id, u.username, u.password, u.profile, u.wa, u.maps, u.lat, u.lng, u.foto,
               u.alamat, u.redaman, u.tanggal_tagihan, u.router_id, o.name as odp_name
        FROM users u
        LEFT JOIN odp o ON u.odp_id = o.id
        WHERE " . ($user_id ? "u.id = ?" : "u.username = ?") . " LIMIT 1";

$stmt = $conn->prepare($sql);
if ($user_id) {
    $stmt->bind_param("i", $user_id);
} else {
    $stmt->bind_param("s", $username);
}
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$res) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Pelanggan tidak ditemukan.']);
    exit();
}

// Coba hubungkan data status & ip live dengan query MikroTik cache jika router_id tersedia
$res['disabled'] = 'no';
$res['status'] = 'offline';
$res['remote-address'] = '-';

if (!empty($res['router_id'])) {
    $router_id = $res['router_id'];
    
    // Cari internal numeric id router
    $stmtR = $conn->prepare("SELECT id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtR->bind_param("ss", $router_id, $router_id);
    $stmtR->execute();
    $rRow = $stmtR->get_result()->fetch_assoc();
    $stmtR->close();
    
    if ($rRow) {
        $routerInternalId = $rRow['id'];
        require_once __DIR__ . '/mikrotik_cache.php';
        $cache = new MikrotikCache($conn);
        
        $sData = $cache->getStale("mt_{$routerInternalId}_ppp_secret");
        $aData = $cache->getStale("mt_{$routerInternalId}_ppp_active");
        
        if (is_array($sData)) {
            foreach ($sData as $sec) {
                if (($sec['name'] ?? '') === $res['username']) {
                    $res['disabled'] = (($sec['disabled'] ?? 'false') === 'true') ? 'yes' : 'no';
                    $res['remote-address'] = $sec['remote-address'] ?? '-';
                    break;
                }
            }
        }
        
        if (is_array($aData)) {
            foreach ($aData as $act) {
                if (($act['name'] ?? '') === $res['username']) {
                    $res['status'] = 'online';
                    $res['remote-address'] = $act['address'] ?? $res['remote-address'];
                    break;
                }
            }
        }
    }
}

echo json_encode([
    'success' => true,
    'data' => $res
], JSON_UNESCAPED_UNICODE);
?>
