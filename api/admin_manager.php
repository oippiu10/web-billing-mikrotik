<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/auth/require_auth.php';
require __DIR__ . '/auth/activity_log.php';

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Akses ditolak. Hanya admin yang boleh mengelola akun admin.');

function table_exists(mysqli $conn, string $table): bool {
    $table = $conn->real_escape_string($table);
    $res = $conn->query("SHOW TABLES LIKE '{$table}'");
    return $res && $res->num_rows > 0;
}

function input_data(): array {
    $json = json_decode(file_get_contents('php://input'), true);
    return is_array($json) ? array_merge($_POST, $json) : $_POST;
}

function resolve_role_id(mysqli $conn, string $role): int {
    $role = trim($role) ?: 'operator';
    if (!table_exists($conn, 'admin_roles')) {
        return in_array($role, ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], true) ? 1 : 3;
    }

    $stmt = $conn->prepare("SELECT id FROM admin_roles WHERE LOWER(role_name) = LOWER(?) LIMIT 1");
    $stmt->bind_param('s', $role);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row) return (int)$row['id'];

    $description = 'Auto-created role: ' . $role;
    $stmt = $conn->prepare("INSERT INTO admin_roles (role_name, description) VALUES (?, ?)");
    if ($stmt) {
        $stmt->bind_param('ss', $role, $description);
        if ($stmt->execute()) {
            $id = (int)$conn->insert_id;
            $stmt->close();
            return $id;
        }
        $stmt->close();
    }

    return in_array($role, ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], true) ? 1 : 3;
}

$action = $_REQUEST['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$useAdminUsers = table_exists($conn, 'admin_users');
$useAdministrators = table_exists($conn, 'administrators');

if (!$useAdminUsers && !$useAdministrators) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Tabel admin tidak ditemukan']);
    exit;
}

if ($method === 'GET') {
    $data = [];
    if ($useAdminUsers) {
        $res = $conn->query("SELECT id, username, email, full_name, role, is_active, last_login FROM admin_users ORDER BY id ASC");
    } else {
        $res = $conn->query("SELECT a.id, a.username, '' AS email, a.full_name, COALESCE(r.role_name, 'admin') AS role, a.is_active, a.last_login FROM administrators a LEFT JOIN admin_roles r ON a.role_id = r.id ORDER BY a.id ASC");
    }

    if ($res) {
        while ($row = $res->fetch_assoc()) {
            if (!$row['last_login']) $row['last_login'] = 'Belum pernah login';
            $data[] = $row;
        }
    }
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

if ($method === 'POST' && ($action === 'add' || $action === '')) {
    $input = input_data();
    $username = trim($input['username'] ?? '');
    $password = (string)($input['password'] ?? '');
    $fullName = trim($input['full_name'] ?? $input['fullName'] ?? '');
    $role = trim($input['role'] ?? 'operator');

    if ($username === '' || $password === '' || $fullName === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Username, password, dan nama wajib diisi']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    if ($useAdminUsers) {
        $email = $input['email'] ?? ($username . '@local');
        $stmt = $conn->prepare("INSERT INTO admin_users (username, password, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)");
        $stmt->bind_param("sssss", $username, $hash, $email, $fullName, $role);
    } else {
        $roleId = isset($input['role_id']) ? (int)$input['role_id'] : resolve_role_id($conn, $role);
        $stmt = $conn->prepare("INSERT INTO administrators (username, password_hash, full_name, role_id, is_active) VALUES (?, ?, ?, ?, 1)");
        $stmt->bind_param("sssi", $username, $hash, $fullName, $roleId);
    }

    if ($stmt->execute()) {
        log_admin_activity($conn, 'admin_add', 'Menambah admin: ' . $username, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Admin berhasil ditambahkan']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if (($method === 'PATCH' || $method === 'POST') && $action === 'update') {
    $input = input_data();
    $id = (int)($input['id'] ?? 0);
    $username = trim($input['username'] ?? '');
    $fullName = trim($input['full_name'] ?? $input['fullName'] ?? '');
    $email = trim($input['email'] ?? '');
    $role = trim($input['role'] ?? 'operator');

    if ($id <= 0 || $username === '' || $fullName === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID, username, dan nama wajib diisi']);
        exit;
    }

    if ($useAdminUsers) {
        $stmt = $conn->prepare("UPDATE admin_users SET username = ?, email = ?, full_name = ?, role = ? WHERE id = ?");
        $stmt->bind_param("ssssi", $username, $email, $fullName, $role, $id);
    } else {
        $roleId = isset($input['role_id']) ? (int)$input['role_id'] : resolve_role_id($conn, $role);
        $stmt = $conn->prepare("UPDATE administrators SET username = ?, full_name = ?, role_id = ? WHERE id = ?");
        $stmt->bind_param("ssii", $username, $fullName, $roleId, $id);
    }

    if ($stmt->execute()) {
        log_admin_activity($conn, 'admin_update', 'Mengubah admin: ' . $username, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Admin berhasil diperbarui']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if (($method === 'PATCH' || $method === 'POST') && $action === 'reset_password') {
    $input = input_data();
    $id = (int)($input['id'] ?? 0);
    $password = (string)($input['password'] ?? '');
    if ($id <= 0 || strlen($password) < 6) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Password minimal 6 karakter']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $table = $useAdminUsers ? 'admin_users' : 'administrators';
    $field = $useAdminUsers ? 'password' : 'password_hash';
    $stmt = $conn->prepare("UPDATE {$table} SET {$field} = ? WHERE id = ?");
    $stmt->bind_param("si", $hash, $id);
    if ($stmt->execute()) {
        log_admin_activity($conn, 'admin_reset_password', 'Reset password admin ID ' . $id, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Password admin berhasil direset']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if (($method === 'DELETE' || $method === 'POST') && $action === 'delete') {
    $input = input_data();
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID admin wajib']);
        exit;
    }
    if ($id === (int)($_SESSION['admin_id'] ?? 0)) {
        echo json_encode(['success' => false, 'message' => 'Tidak bisa menghapus akun sendiri']);
        exit;
    }

    $table = $useAdminUsers ? 'admin_users' : 'administrators';
    $stmt = $conn->prepare("DELETE FROM {$table} WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        log_admin_activity($conn, 'admin_delete', 'Menghapus admin ID ' . $id, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Admin berhasil dihapus']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

if (($method === 'PATCH' || $method === 'POST') && $action === 'toggle') {
    $input = input_data();
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID admin wajib']);
        exit;
    }
    if ($id === (int)($_SESSION['admin_id'] ?? 0)) {
        echo json_encode(['success' => false, 'message' => 'Tidak bisa menonaktifkan akun sendiri']);
        exit;
    }

    $table = $useAdminUsers ? 'admin_users' : 'administrators';
    $res = $conn->query("SELECT is_active FROM {$table} WHERE id = {$id}");
    $row = $res ? $res->fetch_assoc() : null;
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Admin tidak ditemukan']);
        exit;
    }
    $newStatus = (int)$row['is_active'] ? 0 : 1;
    $conn->query("UPDATE {$table} SET is_active = {$newStatus} WHERE id = {$id}");
    log_admin_activity($conn, 'admin_toggle', 'Mengubah status admin ID ' . $id . ' menjadi ' . ($newStatus ? 'aktif' : 'nonaktif'), (int)($_SESSION['admin_id'] ?? 0));
    echo json_encode(['success' => true, 'message' => 'Status admin berhasil diubah']);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Action tidak valid']);
