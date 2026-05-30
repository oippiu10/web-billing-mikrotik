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
$sql = "SELECT p.id, p.amount, p.payment_date, p.payment_month, p.payment_year, p.method, p.note, p.created_at, 
               COALESCE(p.target_amount, inv.amount, pr.price, 0) as harga
        FROM payments p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN invoices inv ON inv.user_id = p.user_id AND inv.month = p.payment_month AND inv.year = p.payment_year
        LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
        WHERE p.user_id = ?
        ORDER BY p.payment_year DESC, p.payment_month DESC, p.payment_date DESC, p.id DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$history = [];
while ($row = $result->fetch_assoc()) {
    $row['amount'] = floatval($row['amount']);
    $row['harga'] = floatval($row['harga'] ?? 0);
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
