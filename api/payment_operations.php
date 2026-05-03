<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

require_admin_role(['admin', 'administrator', 'finance'], 'Akses ditolak. Hanya admin/finance yang boleh mengelola pembayaran.');

// Export CSV via GET operation
if (isset($_GET['action']) && $_GET['action'] === 'export') {
    $router_id = trim($_GET['router_id'] ?? '');
    $month = intval($_GET['month'] ?? date('n'));
    $year = intval($_GET['year'] ?? date('Y'));
    $search = trim($_GET['search'] ?? '');
    
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment;filename="billing_export_'.$year.'_'.$month.'.csv"');
    $output = fopen('php://output', 'w');
    fputcsv($output, ['Username', 'Nama', 'Profile', 'Tanggal Tagihan', 'Nominal Tagihan', 'Status Bayar', 'Tanggal Bayar', 'Nominal Bayar']);
    
    $where = ["u.router_id = ?"];
    $params = [$router_id];
    $types = "s";
    
    if ($search !== '') {
        $where[] = "(u.username LIKE ? OR u.nama LIKE ? OR u.wa LIKE ?)";
        $like = "%$search%";
        $params = array_merge($params, [$like, $like, $like]);
        $types .= "sss";
    }
    
    $whereSQL = "WHERE " . implode(" AND ", $where);
    
    $tables = "users u 
               LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
               LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id";
               
    array_unshift($params, $year);
    array_unshift($params, $month);
    $types = "ii" . $types;
    
    $sql = "SELECT u.username, u.alamat as nama, u.profile, u.tanggal_tagihan, 
                   IF(p.id IS NOT NULL, 'Lunas', 'Belum Bayar') as status_bayar,
                   p.payment_date as tanggal_bayar, p.amount as nominal_bayar,
                   pr.price as nominal_tagihan
            FROM $tables $whereSQL ORDER BY u.username ASC";
            
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        fputcsv($output, [
            $row['username'], $row['nama'], $row['profile'], $row['tanggal_tagihan'], 
            $row['nominal_tagihan'] ?: 0, $row['status_bayar'], 
            $row['tanggal_bayar'] ?: '-', $row['nominal_bayar'] ?: 0
        ]);
    }
    fclose($output);
    exit;
}

// Write Operations via POST json
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No JSON data']);
        exit;
    }
    
    $action = $data['action'] ?? '';
    $router_id = trim($data['router_id'] ?? '');
    
    if ($action === 'mark_paid') {
        $username = trim($data['username'] ?? '');
        $user_id = intval($data['payment_id'] ?? 0); // billing.html sends user_id as payment_id if unpaid
        $amount = floatval($data['amount'] ?? 0);
        $date = trim($data['paid_date'] ?? date('Y-m-d'));
        $method = trim($data['method'] ?? 'cash');
        $note = trim($data['note'] ?? '');
        $month = intval($data['month'] ?? date('n'));
        $year = intval($data['year'] ?? date('Y'));
        
        // Find user_id if we only have username
        if (!$user_id && $username) {
            $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND router_id = ?");
            $stmt->bind_param("ss", $username, $router_id);
            $stmt->execute();
            $u = $stmt->get_result()->fetch_assoc();
            $user_id = $u['id'] ?? 0;
            $stmt->close();
        }
        
        if (!$user_id) {
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit;
        }
        
        // Prevent duplicate payments
        $checkStmt = $conn->prepare("SELECT id FROM payments WHERE router_id = ? AND user_id = ? AND payment_month = ? AND payment_year = ?");
        $checkStmt->bind_param("siii", $router_id, $user_id, $month, $year);
        $checkStmt->execute();
        $res = $checkStmt->get_result();
        
        if ($res->num_rows > 0) {
            // Update exist
            $pid = $res->fetch_assoc()['id'];
            $sql = "UPDATE payments SET amount = ?, payment_date = ?, method = ?, note = ? WHERE id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("dsssi", $amount, $date, $method, $note, $pid);
        } else {
            // Insert new
            $sql = "INSERT INTO payments (router_id, user_id, amount, payment_date, payment_month, payment_year, method, note) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("sidsiiss", $router_id, $user_id, $amount, $date, $month, $year, $method, $note);
        }
        $checkStmt->close();
        
        if ($stmt->execute()) {
            log_admin_activity($conn, 'payment_mark_paid', "Menandai lunas user_id {$user_id} periode {$month}/{$year}", (int)($_SESSION['admin_id'] ?? 0));
            $openResult = open_isolated_customer($conn, $router_id, $user_id, $username);
            echo json_encode(['success' => true, 'open_isolate' => $openResult]);
        } else {
            echo json_encode(['success' => false, 'message' => $stmt->error]);
        }
        $stmt->close();
        
    } elseif ($action === 'mark_unpaid') {
        $payment_id = intval($data['payment_id'] ?? 0);
        
        if ($payment_id) {
            $sql = "DELETE FROM payments WHERE id = ? AND router_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("is", $payment_id, $router_id);
            if ($stmt->execute()) {
                log_admin_activity($conn, 'payment_mark_unpaid', 'Membatalkan pembayaran ID ' . $payment_id, (int)($_SESSION['admin_id'] ?? 0));
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => $stmt->error]);
            }
            $stmt->close();
        } else {
            echo json_encode(['success' => false, 'message' => 'Missing payment ID']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }
}

function open_isolated_customer(mysqli $conn, string $router_id, int $user_id, string $username = ''): array
{
    $stmt = $conn->prepare('SELECT id, host, port, username, password, software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
    $ridInt = intval($router_id);
    $stmt->bind_param('is', $ridInt, $router_id);
    $stmt->execute();
    $router = $stmt->get_result()->fetch_assoc();
    if (!$router) return ['success' => false, 'message' => 'Router tidak ditemukan'];

    if ($username === '') {
        $softwareId = $router['software_id'] ?: (string)$router['id'];
        $u = $conn->prepare('SELECT username FROM users WHERE id = ? AND (router_id = ? OR router_id = ?) LIMIT 1');
        $u->bind_param('iss', $user_id, $softwareId, $router_id);
        $u->execute();
        $username = trim($u->get_result()->fetch_assoc()['username'] ?? '');
    }
    if ($username === '') return ['success' => false, 'message' => 'Username tidak ditemukan'];

    $api = new RouterosAPI();
    $api->port = intval($router['port']) ?: 8728;
    $api->timeout = 8;
    if (!$api->connect($router['host'], $router['username'], $router['password'])) return ['success' => false, 'message' => 'Gagal koneksi MikroTik'];

    $found = $api->comm('/ppp/secret/print', ['?name' => $username]);
    $secretId = $found[0]['.id'] ?? null;
    if (!$secretId) { $api->disconnect(); return ['success' => false, 'message' => 'PPP secret tidak ditemukan']; }

    $disabled = (($found[0]['disabled'] ?? 'false') === 'true');
    if ($disabled) $api->comm('/ppp/secret/enable', ['.id' => $secretId]);
    $api->disconnect();

    $cache = new MikrotikCache($conn);
    $cache->invalidate('mt_' . $router['host'] . '_' . (intval($router['port']) ?: 8728) . '_ppp_secret');
    log_admin_activity($conn, 'auto_open_isolate', 'Auto buka isolir setelah bayar: ' . $username, (int)($_SESSION['admin_id'] ?? 0));
    return ['success' => true, 'message' => $disabled ? 'PPP secret di-enable' : 'PPP secret sudah aktif', 'username' => $username, 'was_disabled' => $disabled];
}
?>