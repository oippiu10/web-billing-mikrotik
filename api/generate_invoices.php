<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$router_id = trim($input['router_id'] ?? '');
$month = intval($input['month'] ?? date('n'));
$year = intval($input['year'] ?? date('Y'));

if (!$router_id) {
    echo json_encode(['success' => false, 'message' => 'Router ID is required']);
    exit();
}

// Get correct software_id if router_id is numeric ID
$stmtRouter = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
$stmtRouter->bind_param('ss', $router_id, $router_id);
$stmtRouter->execute();
if ($routerRow = $stmtRouter->get_result()->fetch_assoc()) {
    if (!empty($routerRow['software_id'])) {
        $router_id = $routerRow['software_id'];
    }
}
$stmtRouter->close();

// Fetch all users and their current prices
$sql = "SELECT u.id, u.profile, IFNULL(pr.price, 0) as current_price
        FROM users u
        LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
        WHERE u.router_id = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param('s', $router_id);
$stmt->execute();
$usersRes = $stmt->get_result();

$inserted = 0;

$conn->begin_transaction();
try {
    $insertStmt = $conn->prepare("INSERT IGNORE INTO invoices (user_id, router_id, month, year, amount, status) VALUES (?, ?, ?, ?, ?, ?)");
    
    while ($user = $usersRes->fetch_assoc()) {
        $amount = floatval($user['current_price']);
        $status = 'unpaid';
        
        // Cek jika isolir
        if (stripos($user['profile'], 'isolir') !== false) {
            $status = 'isolir';
            $amount = 0;
        }

        $user_id = $user['id'];
        $insertStmt->bind_param("isiids", $user_id, $router_id, $month, $year, $amount, $status);
        $insertStmt->execute();
        
        if ($insertStmt->affected_rows > 0) {
            $inserted++;
        }
    }
    $insertStmt->close();
    $conn->commit();

    echo json_encode(['success' => true, 'message' => 'Invoices generated', 'inserted' => $inserted]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Failed to generate invoices: ' . $e->getMessage()]);
}
?>
