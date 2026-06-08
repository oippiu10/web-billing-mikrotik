<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Akses Manajemen Klien ditolak.');

// ── Auto-create tabel jika belum ada ──────────────────────────────────────
$conn->query("CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    domain VARCHAR(150) DEFAULT '',
    contact_name VARCHAR(100) DEFAULT '',
    contact_email VARCHAR(150) DEFAULT '',
    contact_phone VARCHAR(30) DEFAULT '',
    plan ENUM('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
    status ENUM('trial','active','suspended') NOT NULL DEFAULT 'trial',
    max_routers INT NOT NULL DEFAULT 3,
    max_users INT NOT NULL DEFAULT 1,
    api_key VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ── Helper ──────────────────────────────────────────────────────────────
function input_json(): array {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function generate_api_key(): string {
    return bin2hex(random_bytes(32));
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// ── GET: list all tenants ────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $conn->query("SELECT * FROM tenants ORDER BY created_at DESC");
    $tenants = [];
    while ($row = $stmt->fetch_assoc()) {
        $row['id']          = (int)$row['id'];
        $row['max_routers'] = (int)$row['max_routers'];
        $row['max_users']   = (int)$row['max_users'];
        $tenants[] = $row;
    }

    // Summary
    $summary = ['total' => count($tenants), 'active' => 0, 'trial' => 0, 'suspended' => 0];
    foreach ($tenants as $t) {
        if (isset($summary[$t['status']])) $summary[$t['status']]++;
    }

    echo json_encode(['success' => true, 'data' => $tenants, 'summary' => $summary]);
    exit;
}

// ── POST: tambah tenant baru ─────────────────────────────────────────────
if ($method === 'POST') {
    $data = input_json();
    $name         = trim($data['name'] ?? '');
    if ($name === '') {
        echo json_encode(['success' => false, 'message' => 'Nama klien wajib diisi']);
        exit;
    }
    $domain       = trim($data['domain'] ?? '');
    $contact_name = trim($data['contact_name'] ?? '');
    $contact_email= trim($data['contact_email'] ?? '');
    $contact_phone= trim($data['contact_phone'] ?? '');
    $plan         = in_array($data['plan'] ?? '', ['starter','pro','enterprise']) ? $data['plan'] : 'starter';
    $status       = in_array($data['status'] ?? '', ['trial','active','suspended']) ? $data['status'] : 'trial';
    $max_routers  = max(1, (int)($data['max_routers'] ?? 3));
    $max_users    = max(1, (int)($data['max_users'] ?? 1));
    $api_key      = generate_api_key();

    $stmt = $conn->prepare("INSERT INTO tenants (name, domain, contact_name, contact_email, contact_phone, plan, status, max_routers, max_users, api_key) VALUES (?,?,?,?,?,?,?,?,?,?)");
    $stmt->bind_param("sssssssiis", $name, $domain, $contact_name, $contact_email, $contact_phone, $plan, $status, $max_routers, $max_users, $api_key);
    $ok = $stmt->execute();
    $newId = $conn->insert_id;

    if ($ok) {
        log_admin_activity($conn, 'tenant_add', "Tambah klien: {$name}", (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Klien berhasil ditambahkan', 'id' => $newId, 'api_key' => $api_key]);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit;
}

// ── PUT: update tenant ───────────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID tidak valid']);
        exit;
    }
    $data = input_json();

    // Bangun query dinamis hanya dari field yang dikirim
    $fields = [];
    $types  = '';
    $params = [];

    if (isset($data['name']))         { $fields[] = 'name=?';          $types .= 's'; $params[] = trim($data['name']); }
    if (isset($data['domain']))       { $fields[] = 'domain=?';        $types .= 's'; $params[] = trim($data['domain']); }
    if (isset($data['contact_name'])) { $fields[] = 'contact_name=?';  $types .= 's'; $params[] = trim($data['contact_name']); }
    if (isset($data['contact_email'])){ $fields[] = 'contact_email=?'; $types .= 's'; $params[] = trim($data['contact_email']); }
    if (isset($data['contact_phone'])){ $fields[] = 'contact_phone=?'; $types .= 's'; $params[] = trim($data['contact_phone']); }
    if (isset($data['plan']) && in_array($data['plan'], ['starter','pro','enterprise'])) {
        $fields[] = 'plan=?'; $types .= 's'; $params[] = $data['plan'];
    }
    if (isset($data['status']) && in_array($data['status'], ['trial','active','suspended'])) {
        $fields[] = 'status=?'; $types .= 's'; $params[] = $data['status'];
    }
    if (isset($data['max_routers'])) { $fields[] = 'max_routers=?'; $types .= 'i'; $params[] = max(1, (int)$data['max_routers']); }
    if (isset($data['max_users']))   { $fields[] = 'max_users=?';   $types .= 'i'; $params[] = max(1, (int)$data['max_users']); }

    if (empty($fields)) {
        echo json_encode(['success' => false, 'message' => 'Tidak ada field yang diubah']);
        exit;
    }

    $types  .= 'i';
    $params[] = $id;

    $stmt = $conn->prepare("UPDATE tenants SET " . implode(', ', $fields) . " WHERE id=?");
    $stmt->bind_param($types, ...$params);
    $ok = $stmt->execute();

    if ($ok) {
        log_admin_activity($conn, 'tenant_update', "Update klien ID: {$id}", (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Klien berhasil diperbarui']);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit;
}

// ── DELETE: hapus tenant ─────────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) {
        echo json_encode(['success' => false, 'message' => 'ID tidak valid']);
        exit;
    }
    $stmt = $conn->prepare("DELETE FROM tenants WHERE id=?");
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();

    if ($ok) {
        log_admin_activity($conn, 'tenant_delete', "Hapus klien ID: {$id}", (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Klien berhasil dihapus']);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Method tidak diizinkan']);
