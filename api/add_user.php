<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$routerId = trim($input['router_id'] ?? '');
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');
$profile = trim($input['profile'] ?? '');
$wa = trim($input['wa'] ?? '');
$alamat = trim($input['alamat'] ?? '');
$maps = trim($input['maps'] ?? '');
$redaman = trim($input['redaman'] ?? '');
$tanggalTagihan = trim($input['tanggal_tagihan'] ?? '');
$tanggalDibuat = trim($input['tanggal_dibuat'] ?? '');

if (empty($routerId)) {
    echo json_encode(['success' => false, 'message' => 'Router ID (Software ID) wajib diisi. Pastikan router sudah terpilih.']);
    exit;
}

if (empty($username) || empty($profile)) {
    echo json_encode(['success' => false, 'message' => 'Username dan Profile wajib diisi.']);
    exit;
}

if (empty($password)) {
    $password = '123456';
}

if (empty($tanggalDibuat)) {
    $tanggalDibuat = date('Y-m-d H:i:s');
}

// Convert empty strings to NULL for database compatibility (Strict Mode)
$valTanggalTagihan = ($tanggalTagihan === '') ? null : $tanggalTagihan;
$valAlamat = ($alamat === '') ? null : $alamat;
$valMaps = ($maps === '') ? null : $maps;
$valRedaman = ($redaman === '') ? null : $redaman;
$valWa = ($wa === '') ? null : $wa;

// Check for duplicate username in the same router
$checkStmt = $conn->prepare("SELECT id FROM users WHERE router_id = ? AND username = ?");
$checkStmt->bind_param("ss", $routerId, $username);
$checkStmt->execute();
$checkStmt->store_result();
if ($checkStmt->num_rows > 0) {
    $checkStmt->close();
    echo json_encode(['success' => false, 'message' => "Username \"$username\" sudah ada di router ini."]);
    exit;
}
$checkStmt->close();

$stmt = $conn->prepare(
    "INSERT INTO users (router_id, username, password, profile, wa, alamat, maps, redaman, tanggal_tagihan, tanggal_dibuat, on_router)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"
);
$stmt->bind_param(
    "ssssssssss",
    $routerId,
    $username,
    $password,
    $profile,
    $valWa,
    $valAlamat,
    $valMaps,
    $valRedaman,
    $valTanggalTagihan,
    $tanggalDibuat
);

if ($stmt->execute()) {
    $insertId = $stmt->insert_id;

    // Sync ke Mikrotik
    $stmtRouter = $conn->prepare("SELECT host, port, username, password FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtRouter->bind_param("ss", $routerId, $routerId);
    $stmtRouter->execute();
    $router = $stmtRouter->get_result()->fetch_assoc();
    $stmtRouter->close();

    if ($router) {
        require_once __DIR__ . '/routerosAPI.php';
        require_once __DIR__ . '/mikrotik_cache.php';

        $api = new RouterosAPI();
        $api->port = intval($router['port']) ?: 8728;
        $api->timeout = 3;

        if ($api->connect($router['host'], $router['username'], $router['password'])) {
            // Check if secret exists
            $secrets = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (empty($secrets)) {
                $params = ['name' => $username, 'password' => $password, 'profile' => $profile, 'service' => 'pppoe'];
                $api->comm('/ppp/secret/add', $params);
            }
            $api->disconnect();

            // Invalidate mikrotik cache
            (new MikrotikCache($conn))->invalidate("mt_{$router['host']}_{$api->port}_ppp_secret");
        }
    }

    echo json_encode(['success' => true, 'message' => "User \"$username\" berhasil ditambahkan.", 'id' => $insertId]);
} else {
    echo json_encode(['success' => false, 'message' => 'Gagal menyimpan ke database: ' . $stmt->error]);
}

$stmt->close();

?>