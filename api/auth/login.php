<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
require __DIR__ . '/../config.php';
require __DIR__ . '/activity_log.php';

function login_fail(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function table_exists(mysqli $conn, string $table): bool {
    $table = $conn->real_escape_string($table);
    $res = $conn->query("SHOW TABLES LIKE '{$table}'");
    return $res && $res->num_rows > 0;
}

try {
    $json = json_decode(file_get_contents('php://input'), true) ?: [];
    $username = trim($json['username'] ?? $_POST['username'] ?? '');
    $password = $json['password'] ?? $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        login_fail(422, 'Lengkapi form username dan password!');
    }

    $usingAdministrators = table_exists($conn, 'administrators');
    $usingAdminUsers = table_exists($conn, 'admin_users');

    if (!$usingAdministrators && !$usingAdminUsers) {
        login_fail(500, 'Tabel admin tidak ditemukan. Import schema database terlebih dahulu.');
    }

    if ($usingAdministrators) {
        $stmt = $conn->prepare("SELECT id, username, password_hash AS password_hash, full_name, role_id, is_active FROM administrators WHERE username = ? LIMIT 1");
    } else {
        $stmt = $conn->prepare("SELECT id, username, password AS password_hash, full_name, role AS role_name, is_active FROM admin_users WHERE username = ? LIMIT 1");
    }
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();
    $user = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        login_fail(401, 'Username atau password salah!');
    }

    if ((int)$user['is_active'] === 0) {
        login_fail(403, 'Akun dinonaktifkan! Hubungi Super Admin.');
    }

    $roleName = $user['role_name'] ?? 'admin';
    $roleId = isset($user['role_id']) ? (int)$user['role_id'] : null;
    if ($usingAdministrators && table_exists($conn, 'admin_roles')) {
        $roleStmt = $conn->prepare("SELECT role_name FROM admin_roles WHERE id = ? LIMIT 1");
        $roleStmt->bind_param("i", $user['role_id']);
        $roleStmt->execute();
        $roleRes = $roleStmt->get_result();
        $roleRow = $roleRes ? $roleRes->fetch_assoc() : null;
        $roleStmt->close();
        if ($roleRow && !empty($roleRow['role_name'])) {
            $roleName = $roleRow['role_name'];
        }
    }

    session_regenerate_id(true);
    $_SESSION['logged_in'] = true;
    $_SESSION['admin_id'] = (int)$user['id'];
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['admin_table'] = $usingAdministrators ? 'administrators' : 'admin_users';
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['role_id'] = $roleId;
    $_SESSION['role_name'] = $roleName;
    $_SESSION['role'] = $roleName;
    $_SESSION['login_time'] = time();

    $table = $usingAdministrators ? 'administrators' : 'admin_users';
    $updateStmt = $conn->prepare("UPDATE {$table} SET last_login = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $user['id']);
    $updateStmt->execute();
    $updateStmt->close();

    log_admin_activity(
        $conn,
        'login',
        'Login berhasil: ' . $user['username'],
        (int)$user['id']
    );

    echo json_encode(['success' => true, 'message' => 'Login berhasil, mengalihkan...', 'data' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'role_id' => $roleId,
        'role' => $roleName,
    ]]);
} catch (Throwable $e) {
    error_log('[auth/login] ' . $e->getMessage());
    login_fail(500, 'Login error: ' . $e->getMessage());
}
