<?php
session_start();

// config.php set $conn (MySQLi) dan beberapa variabel DB ($host, $user, $pass, $db)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

// Override Content-Type agar konsisten JSON
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh menjalankan aksi MikroTik.');

// ─── Parse Input ───────────────────────────────────────────────────────────────
$rawInput = file_get_contents('php://input');
$input    = json_decode($rawInput, true);

$router_id = intval($input['router_id'] ?? 0);
$action    = trim($input['action'] ?? '');
$params    = $input['params'] ?? [];

if ($router_id <= 0 || empty($action)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter router_id dan action wajib diisi']);
    exit;
}

$adminOnlyActions = ['secret_remove', 'profile_add', 'profile_edit', 'profile_remove'];
if (in_array($action, $adminOnlyActions, true)) {
    require_admin_role(['admin', 'administrator'], 'Akses ditolak. Aksi ini hanya untuk admin.');
}

// ─── Ambil Kredensial Router dari DB ──────────────────────────────────────────
// Pakai prefix "rt" agar tidak konflik dengan variabel DB dari config.php ($host, $user, $pass)
$stmt = $conn->prepare("SELECT host, port, username, password FROM mikrotik_routers WHERE id = ?");
$stmt->bind_param("i", $router_id);
$stmt->execute();
$routerRes = $stmt->get_result();
if ($routerRes->num_rows === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Router tidak ditemukan di database']);
    exit;
}
$routerData = $routerRes->fetch_assoc();
$rtHost = $routerData['host'];
$rtPort = intval($routerData['port']) ?: 8728;
$rtUser = $routerData['username'];
$rtPass = $routerData['password'];

// ─── Koneksi ke Mikrotik ───────────────────────────────────────────────────────
$api          = new RouterosAPI();
$api->port    = $rtPort;
$api->timeout = 5;

if (!$api->connect($rtHost, $rtUser, $rtPass)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => "Gagal koneksi ke Mikrotik $rtHost:$rtPort"]);
    exit;
}

$cache       = new MikrotikCache($conn);
$cachePrefix = "mt_{$rtHost}_{$rtPort}";
$response    = ['success' => true, 'message' => 'Aksi berhasil dieksekusi'];

try {
    switch ($action) {

        // ── SECRETS ──────────────────────────────────────────────────────────
        case 'secret_add':
            $req = [
                'name'     => $params['name'],
                'password' => $params['password'] ?? '',
                'service'  => $params['service']  ?? 'pppoe',
                'profile'  => $params['profile']  ?? 'default',
            ];
            $res = $api->comm('/ppp/secret/add', $req);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menambah secret');
            $cache->invalidate("{$cachePrefix}_ppp_secret");
            break;

        case 'secret_edit':
            $req = [
                '.id'     => $params['id'],
                'name'    => $params['name'],
                'service' => $params['service'] ?? 'pppoe',
                'profile' => $params['profile'] ?? 'default',
            ];
            // Jangan kirim password kosong — artinya user tidak mau mengubah password
            if (!empty($params['password']))
                $req['password'] = $params['password'];

            $res = $api->comm('/ppp/secret/set', $req);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal mengedit secret');
            $cache->invalidate("{$cachePrefix}_ppp_secret");
            break;

        case 'secret_remove':
            $res = $api->comm('/ppp/secret/remove', ['.id' => $params['id']]);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menghapus secret');
            $cache->invalidate("{$cachePrefix}_ppp_secret");
            break;

        case 'secret_enable':
            $res = $api->comm('/ppp/secret/enable', ['.id' => $params['id']]);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal mengaktifkan secret');
            $cache->invalidate("{$cachePrefix}_ppp_secret");
            break;

        case 'secret_disable':
            $res = $api->comm('/ppp/secret/disable', ['.id' => $params['id']]);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menonaktifkan secret');
            $cache->invalidate("{$cachePrefix}_ppp_secret");
            break;

        // ── PROFILES ─────────────────────────────────────────────────────────
        case 'profile_add':
            $req = ['name' => $params['name']];
            if (!empty($params['local-address']))
                $req['local-address'] = $params['local-address'];
            if (!empty($params['remote-address']))
                $req['remote-address'] = $params['remote-address'];
            if (!empty($params['rate-limit']))
                $req['rate-limit'] = $params['rate-limit'];

            $res = $api->comm('/ppp/profile/add', $req);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menambah profil');
            $cache->invalidate("{$cachePrefix}_ppp_profile");
            break;

        case 'profile_edit':
            $req = [
                '.id'  => $params['id'],
                'name' => $params['name'],
            ];
            if (!empty($params['local-address']))
                $req['local-address'] = $params['local-address'];
            if (!empty($params['remote-address']))
                $req['remote-address'] = $params['remote-address'];
            if (!empty($params['rate-limit']))
                $req['rate-limit'] = $params['rate-limit'];

            $res = $api->comm('/ppp/profile/set', $req);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal mengedit profil');
            $cache->invalidate("{$cachePrefix}_ppp_profile");
            break;

        case 'profile_remove':
            $res = $api->comm('/ppp/profile/remove', ['.id' => $params['id']]);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menghapus profil');
            $cache->invalidate("{$cachePrefix}_ppp_profile");
            break;

        // ── ACTIVE SESSIONS ───────────────────────────────────────────────────
        case 'active_remove':
            $res = $api->comm('/ppp/active/remove', ['.id' => $params['id']]);
            if (isset($res['!trap']))
                throw new Exception($res['!trap'][0]['message'] ?? 'Gagal menendang koneksi');
            $cache->invalidate("{$cachePrefix}_ppp_active");
            break;

        case 'ping':
            $address = $params['address'] ?? '';
            if (empty($address)) throw new Exception("IP Address wajib untuk ping");
            $res = $api->comm('/ping', [
                'address' => $address,
                'count'   => 3
            ]);
            $response['data'] = $res;
            break;

        default:
            throw new Exception("Aksi '$action' tidak dikenali.");
    }

} catch (Exception $e) {
    http_response_code(500);
    $response = [
        'success' => false,
        'message' => $e->getMessage(),
    ];
}

$api->disconnect();
if (($response['success'] ?? false) === true) {
    log_admin_activity($conn, 'mikrotik_action', 'Menjalankan aksi MikroTik: ' . $action . ' pada router ID ' . $router_id, (int)($_SESSION['admin_id'] ?? 0));
}

echo json_encode($response, JSON_UNESCAPED_UNICODE);
?>