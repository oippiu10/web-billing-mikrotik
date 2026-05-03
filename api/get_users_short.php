<?php
/**
 * Get Users Short — Untuk tool Bulk Update
 * Mengambil data username dan data tambahan saja.
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

$routerId = trim($_GET['router_id'] ?? '');
$filterEmpty = trim($_GET['empty_only'] ?? '') === 'true';

if (empty($routerId)) {
    echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
    exit;
}

try {
    $where = [];
    $params = [];
    $types = '';

    if ($routerId !== '') {
        $where[] = 'router_id = ?';
        $params[] = $routerId;
        $types .= 's';
    }

    // Hanya tampilkan yang ada di MikroTik (on_router = 1)
    $where[] = 'on_router = 1';

    if ($filterEmpty) {
        $where[] = "(wa = '' OR wa IS NULL OR alamat = '' OR alamat IS NULL OR maps = '' OR maps IS NULL OR redaman = '' OR redaman IS NULL OR tanggal_tagihan = '' OR tanggal_tagihan IS NULL)";
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT username, profile, wa, alamat, maps, redaman, tanggal_tagihan 
            FROM users 
            $whereSQL 
            ORDER BY username ASC";

    $stmt = $conn->prepare($sql);
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $users
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>