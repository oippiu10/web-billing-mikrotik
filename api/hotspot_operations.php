<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';

require_admin_role(['admin','administrator','operator','super_admin','super admin','superadministrator'], 'Akses hotspot ditolak.');
ensure_hotspot_tables($conn);

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $_GET['action'] ?? $_POST['action'] ?? $input['action'] ?? '';
$router_id = trim($_GET['router_id'] ?? $_POST['router_id'] ?? $input['router_id'] ?? '');
if ($router_id === '') { echo json_encode(['success'=>false,'message'=>'Router ID wajib']); exit; }

$stmt = $conn->prepare('SELECT id, host, port, username, password, software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
$ridInt = intval($router_id); $ridStr = (string)$router_id;
$stmt->bind_param('is', $ridInt, $ridStr); $stmt->execute(); $r = $stmt->get_result()->fetch_assoc();
if (!$r) { echo json_encode(['success'=>false,'message'=>'Router tidak ditemukan']); exit; }
$dbRouterId = intval($r['id']);

$api = new RouterosAPI(); $api->debug = false; $api->timeout = 8; $api->port = intval($r['port']) ?: 8728;

switch ($action) {
    case 'list_active':
        if (!connectApi($api, $r)) fail('Gagal koneksi ke MikroTik', 503);
        $active = $api->comm('/ip/hotspot/active/print'); $api->disconnect();
        echo json_encode(['success'=>true,'data'=>is_array($active)?$active:[]]); break;

    case 'kick':
        $id = trim($_POST['id'] ?? $input['id'] ?? '');
        if ($id === '') fail('ID user aktif tidak valid');
        if (!connectApi($api, $r)) fail('Gagal koneksi ke MikroTik', 503);
        $api->comm('/ip/hotspot/active/remove', ['.id'=>$id]); $api->disconnect();
        log_admin_activity($conn, 'hotspot_kick', 'Kick hotspot active ID '.$id, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>true,'message'=>'User berhasil dikeluarkan']); break;

    case 'get_profiles':
        if (!connectApi($api, $r)) fail('Gagal koneksi ke MikroTik', 503);
        $profiles = $api->comm('/ip/hotspot/user/profile/print');
        $servers = $api->comm('/ip/hotspot/print'); $api->disconnect();
        echo json_encode(['success'=>true,'profiles'=>is_array($profiles)?$profiles:[],'servers'=>is_array($servers)?$servers:[]]); break;

    case 'generate':
        $qty = min(500, max(1, intval($_POST['qty'] ?? $input['qty'] ?? 10)));
        $server = cleanText($_POST['server'] ?? $input['server'] ?? 'all', 64);
        $profile = cleanText($_POST['profile'] ?? $input['profile'] ?? 'default', 64);
        $mode = ($_POST['mode'] ?? $input['mode'] ?? 'vc') === 'up' ? 'up' : 'vc';
        $len = min(16, max(4, intval($_POST['length'] ?? $input['length'] ?? 6)));
        $prefix = cleanText($_POST['prefix'] ?? $input['prefix'] ?? '', 16);
        if (!connectApi($api, $r)) fail('Gagal koneksi ke MikroTik', 503);
        $generated = [];
        $stmtIns = $conn->prepare('INSERT INTO hotspot_vouchers (router_id, username, password, profile, server, comment, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for ($i=0; $i<$qty; $i++) {
            $user = uniqueVoucherName($conn, $api, $dbRouterId, $prefix, $len);
            $pass = $mode === 'vc' ? $user : generateRandomString($len);
            $comm = 'Voucher Generated '.date('Y-m-d H:i');
            $params = ['name'=>$user,'password'=>$pass,'profile'=>$profile,'server'=>$server,'comment'=>$comm];
            $res = $api->comm('/ip/hotspot/user/add', $params);
            if (isset($res['!trap'])) continue;
            $adminId = intval($_SESSION['admin_id'] ?? 0);
            $stmtIns->bind_param('isssssi', $dbRouterId, $user, $pass, $profile, $server, $comm, $adminId);
            $stmtIns->execute();
            $generated[] = ['username'=>$user,'password'=>$pass,'profile'=>$profile,'server'=>$server,'comment'=>$comm];
        }
        $api->disconnect();
        log_admin_activity($conn, 'hotspot_generate', 'Generate '.count($generated).' voucher router '.$dbRouterId, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>true,'data'=>$generated]); break;

    case 'list_vouchers':
        $limit = min(500, max(1, intval($_GET['limit'] ?? $input['limit'] ?? 100)));
        $stmtList = $conn->prepare('SELECT * FROM hotspot_vouchers WHERE router_id = ? ORDER BY id DESC LIMIT ?');
        $stmtList->bind_param('ii', $dbRouterId, $limit); $stmtList->execute();
        $data = []; $res = $stmtList->get_result(); while ($row=$res->fetch_assoc()) $data[]=$row;
        echo json_encode(['success'=>true,'data'=>$data]); break;

    case 'delete':
        $ids = $_POST['ids'] ?? $input['ids'] ?? [];
        if (is_string($ids)) $ids = array_filter(array_map('intval', explode(',', $ids)));
        $ids = array_values(array_unique(array_filter(array_map('intval', (array)$ids))));
        if (!$ids) fail('Tidak ada voucher dipilih');
        if (!connectApi($api, $r)) fail('Gagal koneksi ke MikroTik', 503);
        $deleted = 0;
        $sel = $conn->prepare('SELECT username FROM hotspot_vouchers WHERE id = ? AND router_id = ?');
        $del = $conn->prepare('DELETE FROM hotspot_vouchers WHERE id = ? AND router_id = ?');
        foreach ($ids as $id) {
            $sel->bind_param('ii', $id, $dbRouterId); $sel->execute(); $v = $sel->get_result()->fetch_assoc();
            if (!$v) continue;
            $find = $api->comm('/ip/hotspot/user/print', ['?name'=>$v['username']]);
            if (!empty($find[0]['.id'])) $api->comm('/ip/hotspot/user/remove', ['.id'=>$find[0]['.id']]);
            $del->bind_param('ii', $id, $dbRouterId); if ($del->execute()) $deleted++;
        }
        $api->disconnect();
        log_admin_activity($conn, 'hotspot_delete', 'Hapus '.$deleted.' voucher router '.$dbRouterId, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>true,'message'=>'Voucher berhasil dihapus','deleted'=>$deleted]); break;

    default: echo json_encode(['success'=>false,'message'=>'Aksi tidak valid']);
}

function connectApi($api, array $r): bool { return $api->connect($r['host'], $r['username'], $r['password'], intval($r['port']) ?: 8728); }
function fail(string $message, int $code = 400): void { http_response_code($code); echo json_encode(['success'=>false,'message'=>$message]); exit; }
function cleanText($value, int $max): string { return substr(preg_replace('/[^A-Za-z0-9_\-\. ]/', '', trim((string)$value)), 0, $max); }
function generateRandomString($length = 6): string { $c='23456789abcdefghjkmnpqrstuvwxyz'; $s=''; for($i=0;$i<$length;$i++) $s.=$c[random_int(0, strlen($c)-1)]; return $s; }
function uniqueVoucherName(mysqli $conn, $api, int $routerId, string $prefix, int $len): string {
    for ($i=0; $i<20; $i++) {
        $name = $prefix.generateRandomString($len);
        $st = $conn->prepare('SELECT id FROM hotspot_vouchers WHERE router_id = ? AND username = ? LIMIT 1');
        $st->bind_param('is', $routerId, $name); $st->execute();
        if ($st->get_result()->num_rows === 0) return $name;
    }
    return $prefix.generateRandomString($len).substr((string)time(), -3);
}
function ensure_hotspot_tables(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS hotspot_vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL,
        profile VARCHAR(100) DEFAULT 'default',
        server VARCHAR(100) DEFAULT 'all',
        comment VARCHAR(255) DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_router (router_id),
        UNIQUE KEY uniq_router_username (router_id, username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
