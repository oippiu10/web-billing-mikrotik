<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

$router_id = trim($_GET['router_id'] ?? '');
$month = max(1, min(12, intval($_GET['month'] ?? date('n'))));
$year = intval($_GET['year'] ?? date('Y'));
$page = max(1, intval($_GET['page'] ?? 1));
$per_page = max(5, intval($_GET['per_page'] ?? 25));
$search = trim($_GET['search'] ?? '');
$status = trim($_GET['status'] ?? '');
$profile = trim($_GET['profile'] ?? '');
$tipe = trim($_GET['tipe'] ?? '');
$offset = ($page - 1) * $per_page;

// Normalisasi id router numeric ke software_id karena tabel users/payments memakai software_id.
if ($router_id !== '') {
    $stmtRouter = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtRouter->bind_param('ss', $router_id, $router_id);
    $stmtRouter->execute();
    if ($routerRow = $stmtRouter->get_result()->fetch_assoc()) {
        if (!empty($routerRow['software_id'])) {
            $router_id = $routerRow['software_id'];
        }
    }
    $stmtRouter->close();
}

$where = ["u.router_id = ?"];
$params = [$router_id];
$types = "s";

if ($search !== '') {
    $where[] = "(u.username LIKE ? OR u.alamat LIKE ? OR u.wa LIKE ?)";
    $like = "%$search%";
    $params = array_merge($params, [$like, $like, $like]);
    $types .= "sss";
}

if ($profile !== '') {
    $where[] = "u.profile = ?";
    $params[] = $profile;
    $types .= "s";
}

if ($tipe !== '') {
    if ($tipe === 'prabayar') {
        $where[] = "u.tipe_langganan = 'prabayar'";
    } else {
        $where[] = "(u.tipe_langganan = 'pascabayar' OR u.tipe_langganan IS NULL OR u.tipe_langganan = '')";
    }
}

if ($status === 'paid') {
    $where[] = "p.id IS NOT NULL";
} elseif ($status === 'unpaid') {
    $where[] = "p.id IS NULL";
}

$whereSQL = "WHERE " . implode(" AND ", $where);

// Base tables
$tables = "users u 
           LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
           LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id";

// Prepend month and year to params for LEFT JOIN
array_unshift($params, $year);
array_unshift($params, $month);
$types = "ii" . $types;

// 1. Total Filtered
$cntSQL = "SELECT COUNT(*) as total FROM $tables $whereSQL";
$cntStmt = $conn->prepare($cntSQL);
if ($types) {
    // bind_param requires references in some versions, but ...$params works in PHP 5.6+
    $cntStmt->bind_param($types, ...$params);
}
$cntStmt->execute();
$totalFiltered = $cntStmt->get_result()->fetch_assoc()['total'] ?? 0;
$cntStmt->close();

// 2. Data Pagination
$dataSQL = "SELECT u.id as user_id, u.username, u.alamat, u.profile, u.tanggal_tagihan, u.wa, u.tipe_langganan,
                   IFNULL(p.id, u.id) as id, p.id as payment_id, p.amount as paid_amount, p.payment_date as paid_at,
                   p.method, p.note,
                   IF(p.id IS NOT NULL, 'paid', 'unpaid') as status,
                   pr.price as harga
            FROM $tables 
            $whereSQL 
            ORDER BY u.username ASC 
            LIMIT ? OFFSET ?";
$dataStmt = $conn->prepare($dataSQL);
$dataParams = array_merge($params, [$per_page, $offset]);
$dataTypes = $types . "ii";
$dataStmt->bind_param($dataTypes, ...$dataParams);
$dataStmt->execute();
$result = $dataStmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) {
    $row['amount'] = $row['paid_amount'] ?: $row['harga'] ?: 0;
    $data[] = $row;
}
$dataStmt->close();

// 3. Summary (Dynamic based on search and filters)
$sumSQL = "SELECT 
             SUM(IF(p.id IS NOT NULL, 1, 0)) as total_paid,
             SUM(IF(p.id IS NULL, 1, 0)) as total_unpaid,
             SUM(IFNULL(p.amount, 0)) as collected,
             SUM(IF(p.id IS NULL, IFNULL(pr.price, 0), 0)) as receivable,
             SUM(IFNULL(pr.price, 0)) as target_amount
           FROM $tables 
           $whereSQL";
$sumStmt = $conn->prepare($sumSQL);
if ($types) {
    $sumStmt->bind_param($types, ...$params);
}
$sumStmt->execute();
$sumResult = $sumStmt->get_result()->fetch_assoc();
$paid = (int)($sumResult['total_paid'] ?? 0);
$unpaid = (int)($sumResult['total_unpaid'] ?? 0);
$targetAmount = (float)($sumResult['target_amount'] ?? 0);
$summary = [
    'paid' => $paid,
    'unpaid' => $unpaid,
    'collected' => (float)($sumResult['collected'] ?? 0),
    'receivable' => (float)($sumResult['receivable'] ?? 0),
    'target_amount' => $targetAmount,
    'collection_rate' => ($paid + $unpaid) > 0 ? round(($paid / ($paid + $unpaid)) * 100, 1) : 0
];
$sumStmt->close();

$profileStmt = $conn->prepare("SELECT DISTINCT profile FROM users WHERE router_id = ? AND profile IS NOT NULL AND profile != '' ORDER BY profile ASC");
$profileStmt->bind_param('s', $router_id);
$profileStmt->execute();
$profileRes = $profileStmt->get_result();
$profiles = [];
while ($p = $profileRes->fetch_assoc()) {
    $profiles[] = $p['profile'];
}
$profileStmt->close();
echo json_encode([
    'success' => true,
    'data' => $data,
    'total' => $totalFiltered,
    'page' => $page,
    'per_page' => $per_page,
    'summary' => $summary,
    'profiles' => $profiles
], JSON_UNESCAPED_UNICODE);
?>