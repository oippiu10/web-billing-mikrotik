<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
require __DIR__ . '/../config.php';
require __DIR__ . '/activity_log.php';

if (isset($_SESSION['admin_id'])) {
    log_admin_activity(
        $conn,
        'logout',
        'Logout: ' . ($_SESSION['username'] ?? 'admin'),
        (int)$_SESSION['admin_id']
    );
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();
echo json_encode(['success' => true]);
