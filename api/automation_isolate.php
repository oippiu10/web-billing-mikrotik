<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Akses ditolak. Auto isolir hanya untuk admin.');
ensure_automation_logs_table($conn);

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$router_id = intval($input['router_id'] ?? 0);
$month = intval($input['month'] ?? date('n'));
$year = intval($input['year'] ?? date('Y'));
$grace_days = max(0, intval($input['grace_days'] ?? 7));
$dry_run = filter_var($input['dry_run'] ?? true, FILTER_VALIDATE_BOOLEAN);

if ($router_id <= 0 || $month < 1 || $month > 12 || $year < 2020) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter router_id, month, year tidak valid']);
    exit;
}

$dueDate = new DateTime(sprintf('%04d-%02d-01', $year, $month));
$dueDate->modify('last day of this month')->modify("+{$grace_days} days");
if (new DateTime('today') <= $dueDate) {
    echo json_encode(['success' => true, 'message' => 'Belum melewati grace period', 'total_candidates' => 0, 'total_processed' => 0, 'data' => []]);
    exit;
}

$stmt = $conn->prepare('SELECT host, port, username, password FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
$rid = (string)$router_id;
$stmt->bind_param('is', $router_id, $rid);
$stmt->execute();
$routerRes = $stmt->get_result();
if ($routerRes->num_rows === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Router tidak ditemukan']);
    exit;
}
$router = $routerRes->fetch_assoc();

// payments schema project ini memakai payment_month/payment_year.
// Fallback harga mengambil kolom users.harga/users.amount jika ada, jika tidak 0.
$hasHarga = ($conn->query("SHOW COLUMNS FROM users LIKE 'harga'")?->num_rows ?? 0) > 0;
$hasAmount = ($conn->query("SHOW COLUMNS FROM users LIKE 'amount'")?->num_rows ?? 0) > 0;
$hargaExpr = $hasHarga ? 'u.harga' : ($hasAmount ? 'u.amount' : '0');

$sql = "SELECT u.id, u.username, u.profile, COALESCE($hargaExpr, 0) AS harga
        FROM users u
        LEFT JOIN payments p ON (p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ?)
        WHERE p.id IS NULL
          AND u.username IS NOT NULL
          AND u.username <> ''";
$params = [$month, $year];
$types = 'ii';

// Jika tabel users punya router_id, filter agar tidak lintas router. Dibungkus aman.
$hasRouterId = false;
$colCheck = $conn->query("SHOW COLUMNS FROM users LIKE 'router_id'");
if ($colCheck && $colCheck->num_rows > 0) $hasRouterId = true;
if ($hasRouterId) {
    $sql .= " AND (u.router_id = ? OR u.router_id = ?)";
    $params[] = $router_id;
    $params[] = $rid;
    $types .= 'is';
}
$sql .= ' ORDER BY u.username ASC LIMIT 500';

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();
$candidates = [];
while ($row = $res->fetch_assoc()) $candidates[] = $row;

$responseRows = [];
$processed = 0;

if (!$dry_run && count($candidates) > 0) {
    $api = new RouterosAPI();
    $api->port = intval($router['port']) ?: 8728;
    $api->timeout = 8;
    if (!$api->connect($router['host'], $router['username'], $router['password'])) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        exit;
    }

    foreach ($candidates as $row) {
        $found = $api->comm('/ppp/secret/print', ['?name' => $row['username']]);
        $secretId = $found[0]['.id'] ?? null;
        if ($secretId) {
            $disabled = ($found[0]['disabled'] ?? 'false') === 'true';
            if (!$disabled) {
                $r = $api->comm('/ppp/secret/disable', ['.id' => $secretId]);
                if (!isset($r['!trap'])) $processed++;
            }
            $status = $disabled ? 'already_disabled' : 'disabled';
            $responseRows[] = ['username' => $row['username'], 'secret_id' => $secretId, 'status' => $status];
            insert_automation_log($conn, $router_id, $month, $year, 'isolate', $dry_run, $row['username'], $status, intval($_SESSION['admin_id'] ?? 0), $secretId);
        } else {
            $responseRows[] = ['username' => $row['username'], 'secret_id' => null, 'status' => 'secret_not_found'];
            insert_automation_log($conn, $router_id, $month, $year, 'isolate', $dry_run, $row['username'], 'secret_not_found', intval($_SESSION['admin_id'] ?? 0), null);
        }
    }
    $api->disconnect();

    $cache = new MikrotikCache($conn);
    $cache->invalidate("mt_{$router_id}_ppp_secret");
    $cache->invalidate('mt_' . $router['host'] . '_' . (intval($router['port']) ?: 8728) . '_ppp_secret');
    log_admin_activity($conn, 'auto_isolate', 'Menjalankan auto isolir periode ' . $month . '/' . $year . ' router ID ' . $router_id, (int)($_SESSION['admin_id'] ?? 0));
} else {
    foreach ($candidates as $row) {
        $responseRows[] = ['username' => $row['username'], 'status' => 'candidate', 'harga' => $row['harga']];
        insert_automation_log($conn, $router_id, $month, $year, 'isolate', $dry_run, $row['username'], 'candidate', intval($_SESSION['admin_id'] ?? 0), null);
    }
}

echo json_encode([
    'success' => true,
    'dry_run' => $dry_run,
    'total_candidates' => count($candidates),
    'total_processed' => $processed,
    'data' => $responseRows,
], JSON_UNESCAPED_UNICODE);

function ensure_automation_logs_table(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS automation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id VARCHAR(64) NOT NULL,
        period_month INT DEFAULT NULL,
        period_year INT DEFAULT NULL,
        action VARCHAR(50) NOT NULL,
        dry_run TINYINT(1) DEFAULT 1,
        username VARCHAR(150) DEFAULT NULL,
        status VARCHAR(80) DEFAULT NULL,
        secret_id VARCHAR(80) DEFAULT NULL,
        admin_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_router_created (router_id, created_at),
        INDEX idx_period (period_month, period_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function insert_automation_log(mysqli $conn, $routerId, int $month, int $year, string $action, bool $dryRun, string $username, string $status, int $adminId, $secretId): void {
    $stmt = $conn->prepare('INSERT INTO automation_logs (router_id, period_month, period_year, action, dry_run, username, status, secret_id, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $rid = (string)$routerId; $dry = $dryRun ? 1 : 0; $sid = $secretId ? (string)$secretId : null;
    $stmt->bind_param('siisisssi', $rid, $month, $year, $action, $dry, $username, $status, $sid, $adminId);
    @$stmt->execute();
}
?>
