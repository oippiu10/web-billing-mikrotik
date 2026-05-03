<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'], 'Akses backup MikroTik ditolak.');

function input_data(): array { return json_decode(file_get_contents('php://input'), true) ?: $_POST; }
function fail_json(string $msg, int $code = 200) { http_response_code($code); echo json_encode(['success' => false, 'message' => $msg]); exit; }
function ensure_backup_table(mysqli $conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS mikrotik_backups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL,
        backup_type ENUM('backup','export') NOT NULL DEFAULT 'export',
        filename VARCHAR(190) NOT NULL,
        status ENUM('success','failed') NOT NULL DEFAULT 'success',
        message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_router_created (router_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function get_router(mysqli $conn, int $routerId): array {
    $stmt = $conn->prepare('SELECT id, host, port, username, password, name FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
    $stmt->bind_param('ii', $routerId, $routerId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) fail_json('Router tidak ditemukan');
    return $row;
}
function connect_router(array $r): RouterosAPI {
    $api = new RouterosAPI();
    $api->debug = false;
    if (!$api->connect($r['host'], $r['username'], $r['password'], intval($r['port']) ?: 8728)) fail_json('Gagal koneksi ke MikroTik');
    return $api;
}

ensure_backup_table($conn);
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$routerId = intval($_GET['router_id'] ?? $_POST['router_id'] ?? 0);
if ($routerId <= 0) fail_json('Router ID wajib diisi');
$router = get_router($conn, $routerId);
$realRouterId = intval($router['id']);

switch ($action) {
    case 'list':
        $stmt = $conn->prepare('SELECT * FROM mikrotik_backups WHERE router_id = ? ORDER BY created_at DESC LIMIT 100');
        $stmt->bind_param('i', $realRouterId);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        echo json_encode(['success' => true, 'data' => $rows]);
        break;

    case 'create':
        $data = input_data();
        $type = ($data['type'] ?? 'export') === 'backup' ? 'backup' : 'export';
        $prefix = preg_replace('/[^A-Za-z0-9_-]/', '', $data['prefix'] ?? 'router');
        $base = $prefix . '-' . $realRouterId . '-' . date('Ymd-His');
        $filename = $type === 'backup' ? $base . '.backup' : $base . '.rsc';
        $api = connect_router($router);
        try {
            if ($type === 'backup') {
                $api->comm('/system/backup/save', ['name' => $base]);
            } else {
                $api->comm('/export', ['file' => $base]);
            }
            $api->disconnect();
            $stmt = $conn->prepare('INSERT INTO mikrotik_backups (router_id, backup_type, filename, status, message) VALUES (?, ?, ?, "success", ?)');
            $msg = 'File dibuat di storage MikroTik. Download via Winbox/Files atau FTP: ' . $filename;
            $stmt->bind_param('isss', $realRouterId, $type, $filename, $msg);
            $stmt->execute();
            log_admin_activity($conn, 'mikrotik_backup', 'Membuat ' . $type . ' ' . $filename, intval($_SESSION['admin_id'] ?? 0));
            echo json_encode(['success' => true, 'message' => $msg, 'filename' => $filename]);
        } catch (Exception $e) {
            $api->disconnect();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'files':
        $api = connect_router($router);
        $files = $api->comm('/file/print');
        $api->disconnect();
        $filtered = [];
        foreach ($files as $f) {
            $name = $f['name'] ?? '';
            if (preg_match('/\.(backup|rsc)$/i', $name)) $filtered[] = ['id' => $f['.id'] ?? '', 'name' => $name, 'size' => $f['size'] ?? '', 'creation_time' => $f['creation-time'] ?? ''];
        }
        echo json_encode(['success' => true, 'data' => $filtered]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
