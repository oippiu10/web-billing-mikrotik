<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/routerosAPI.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['host'])) {
    echo json_encode(['success' => false, 'message' => 'Host wajib diisi']);
    exit();
}

$host     = $input['host'];
$port     = intval($input['port'] ?? 8728);
$username = $input['username'] ?? 'admin';
$password = $input['password'] ?? '';

try {
    $api = new RouterosAPI();
    $api->port = $port;
    $api->timeout = 5;

    if ($api->connect($host, $username, $password)) {
        $resource = $api->comm('/system/resource/print');
        $license  = $api->comm('/system/license/print');
        $api->disconnect();

        $board = $resource[0]['board-name'] ?? 'Unknown';
        $ver   = $resource[0]['version'] ?? 'Unknown';
        $sid   = $license[0]['software-id'] ?? 'Unknown';

        echo json_encode([
            'success' => true,
            'message' => "Koneksi Berhasil! MikroTik terdeteksi.",
            'data' => [
                'board' => $board,
                'version' => $ver,
                'software_id' => $sid
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Gagal konek! Cek IP/Port/User/Pass Anda.']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
