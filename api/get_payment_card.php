<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

$user_id = intval($_GET['user_id'] ?? 0);
$router_id = trim($_GET['router_id'] ?? '');
$year = intval($_GET['year'] ?? date('Y'));

if (!$user_id || !$router_id) {
    echo json_encode(['success' => false, 'message' => 'Missing user_id or router_id']);
    exit;
}

// Normalisasi id router
$stmtRouter = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
$stmtRouter->bind_param('ss', $router_id, $router_id);
$stmtRouter->execute();
if ($routerRow = $stmtRouter->get_result()->fetch_assoc()) {
    if (!empty($routerRow['software_id'])) {
        $router_id = $routerRow['software_id'];
    }
}
$stmtRouter->close();

// Get user info
$stmtUser = $conn->prepare("
    SELECT u.username, u.alamat, u.profile, pr.price as current_price
    FROM users u
    LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
    WHERE u.id = ? AND u.router_id = ?
");
$stmtUser->bind_param('is', $user_id, $router_id);
$stmtUser->execute();
$user = $stmtUser->get_result()->fetch_assoc();
$stmtUser->close();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'User not found', 'debug' => ['user_id' => $user_id, 'router_id' => $router_id]]);
    exit;
}

// Auto-generate invoices for the requested year (Jan - Dec)
// We only generate up to the current month if it's the current year, or all 12 if it's a past year.
// Actually, it's safer to just generate for all 12 months so the card shows the full expected year.
$genSql = "INSERT IGNORE INTO invoices (user_id, router_id, month, year, amount, status)
           VALUES (?, ?, ?, ?, ?, ?)";
$genStmt = $conn->prepare($genSql);
$basePrice = floatval($user['current_price'] ?? 0);
$isIsolir = stripos($user['profile'], 'isolir') !== false;
$genAmount = $isIsolir ? 0 : $basePrice;
$genStatus = $isIsolir ? 'isolir' : 'unpaid';

$conn->begin_transaction();
for ($m = 1; $m <= 12; $m++) {
    // Only auto-generate if we haven't passed the current month/year to avoid future phantom debts
    // Wait, generating for the whole year is fine, but it might create debt for future months.
    // Let's only generate up to the current month in the current year.
    if ($year == date('Y') && $m > date('n')) {
        continue;
    }
    if ($year > date('Y')) {
        continue;
    }
    $genStmt->bind_param('isiids', $user_id, $router_id, $m, $year, $genAmount, $genStatus);
    $genStmt->execute();
}
$conn->commit();
$genStmt->close();

// Calculate prior debt (carry over from Y-1)
$priorStmt = $conn->prepare("
    SELECT 
        (SELECT IFNULL(SUM(amount), 0) FROM invoices WHERE user_id = ? AND router_id = ? AND year < ?) as prior_billed,
        (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE user_id = ? AND router_id = ? AND payment_year < ?) as prior_paid
");
$priorStmt->bind_param('isiisi', $user_id, $router_id, $year, $user_id, $router_id, $year);
$priorStmt->execute();
$priorRes = $priorStmt->get_result()->fetch_assoc();
$priorStmt->close();

$carry_over = max(0, floatval($priorRes['prior_billed']) - floatval($priorRes['prior_paid']));

// Fetch all invoices and payments for the year
$dataStmt = $conn->prepare("
    SELECT 
        inv.month,
        inv.amount as tagihan_bulan_ini,
        inv.status as inv_status,
        (SELECT IFNULL(SUM(p.amount), 0) FROM payments p WHERE p.user_id = ? AND p.router_id = ? AND p.payment_year = ? AND p.payment_month = inv.month) as bayar,
        (SELECT GROUP_CONCAT(p.note SEPARATOR ', ') FROM payments p WHERE p.user_id = ? AND p.router_id = ? AND p.payment_year = ? AND p.payment_month = inv.month) as keterangan
    FROM invoices inv
    WHERE inv.user_id = ? AND inv.router_id = ? AND inv.year = ?
    ORDER BY inv.month ASC
");
$dataStmt->bind_param('isiisiisi', $user_id, $router_id, $year, $user_id, $router_id, $year, $user_id, $router_id, $year);
$dataStmt->execute();
$result = $dataStmt->get_result();

$monthsData = [];
while ($row = $result->fetch_assoc()) {
    $monthsData[$row['month']] = $row;
}
$dataStmt->close();

$card = [];
$monthsMap = [1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember'];

for ($m = 1; $m <= 12; $m++) {
    $inv = $monthsData[$m] ?? null;
    
    // If no invoice yet (e.g. future month), use 0
    $iuran_bulanan = $inv ? floatval($inv['tagihan_bulan_ini']) : 0;
    $bayar = $inv ? floatval($inv['bayar']) : 0;
    $keterangan = $inv ? $inv['keterangan'] : '';
    $status = $inv ? $inv['inv_status'] : 'unpaid';
    
    // Tagihan Bulan Ini = Iuran Bulanan + Tunggakan Bulan Kemarin
    $tagihan_total = $iuran_bulanan + $carry_over;
    
    // Sisa Tagihan = Tagihan Total - Bayar
    $sisa_tagihan = $tagihan_total - $bayar;
    
    if ($status === 'isolir') {
        $keterangan = trim("ISOLIR. " . $keterangan);
    }
    
    $card[] = [
        'no' => $m,
        'bulan' => $monthsMap[$m],
        'iuran_bulanan' => $iuran_bulanan,
        'kekurangan_kemarin' => $carry_over,
        'tagihan_bulan_ini' => $tagihan_total,
        'bayar' => $bayar,
        'sisa_tagihan' => $sisa_tagihan,
        'keterangan' => $keterangan
    ];
    
    // Set carry over for next month (cannot be negative carry over, unless they overpaid. We allow negative if they overpaid as 'deposit')
    $carry_over = $sisa_tagihan;
}

echo json_encode([
    'success' => true,
    'user' => [
        'username' => $user['username'],
        'alamat' => $user['alamat'],
        'profile' => $user['profile'],
        'base_price' => $basePrice
    ],
    'year' => $year,
    'data' => $card,
    'summary' => [
        'total_iuran' => array_sum(array_column($card, 'iuran_bulanan')),
        'total_bayar' => array_sum(array_column($card, 'bayar')),
        'sisa_akhir' => $carry_over
    ]
]);
?>
