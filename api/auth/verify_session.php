<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
require __DIR__ . '/../config.php';

function table_exists(mysqli $conn, string $table): bool {
    $stmt = $conn->prepare("SHOW TABLES LIKE ?");
    $stmt->bind_param("s", $table);
    $stmt->execute();
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $exists;
}

$timeout = 1800; // 30 minutes
if (!isset($_SESSION['admin_id']) || ($_SESSION['logged_in'] ?? false) !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if (isset($_SESSION['login_time']) && (time() - (int)$_SESSION['login_time'] > $timeout)) {
    session_unset();
    session_destroy();
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Session expired']);
    exit;
}

$id = (int)$_SESSION['admin_id'];
$table = $_SESSION['admin_table'] ?? (table_exists($conn, 'administrators') ? 'administrators' : 'admin_users');

if ($table === 'administrators') {
    $sql = table_exists($conn, 'admin_roles')
        ? "SELECT a.id, a.username, a.full_name, a.role_id, a.is_active, COALESCE(r.role_name, 'admin') AS role FROM administrators a LEFT JOIN admin_roles r ON a.role_id = r.id WHERE a.id = ? LIMIT 1"
        : "SELECT id, username, full_name, role_id, is_active, 'admin' AS role FROM administrators WHERE id = ? LIMIT 1";
} else {
    $sql = "SELECT id, username, full_name, NULL AS role_id, is_active, role FROM admin_users WHERE id = ? LIMIT 1";
}

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user || (int)$user['is_active'] === 0) {
    session_unset();
    session_destroy();
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$_SESSION['login_time'] = time();
echo json_encode(['success' => true, 'data' => [
    'id' => (int)$user['id'],
    'username' => $user['username'],
    'full_name' => $user['full_name'],
    'role_id' => isset($user['role_id']) ? (int)$user['role_id'] : null,
    'role' => $user['role'] ?: 'admin',
]]);
