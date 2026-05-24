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

$user_id = intval($_GET['user_id'] ?? 0);
$username = trim($_GET['username'] ?? '');
$router_id = trim($_GET['router_id'] ?? '');

if (!$user_id && $username !== '') {
    // Cari user_id berdasarkan username
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    if ($u = $stmt->get_result()->fetch_assoc()) {
        $user_id = intval($u['id']);
    }
    $stmt->close();
}

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter user_id atau username tidak valid.']);
    exit();
}

// Fetch payment history
$sql = "SELECT id, amount, payment_date, payment_month, payment_year, method, note, created_at
        FROM payments 
        WHERE user_id = ?
        ORDER BY payment_year DESC, payment_month DESC, payment_date DESC, id DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$history = [];
while ($row = $result->fetch_assoc()) {
    $row['amount'] = floatval($row['amount']);
    $row['payment_month'] = intval($row['payment_month']);
    $row['payment_year'] = intval($row['payment_year']);
    $history[] = $row;
}
$stmt->close();

echo json_encode([
    'success' => true,
    'user_id' => $user_id,
    'data' => $history
], JSON_UNESCAPED_UNICODE);
?>
