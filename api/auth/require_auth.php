<?php
/**
 * JSON API auth guard for admin-only endpoints.
 * Include this file near the top of protected PHP APIs.
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function current_admin_role(): string
{
    return strtolower(trim((string)($_SESSION['role'] ?? $_SESSION['role_name'] ?? '')));
}

function is_super_admin_role(?string $role = null): bool
{
    $role = strtolower(trim((string)($role ?? current_admin_role())));
    return in_array($role, ['super_admin', 'super admin', 'superadministrator'], true);
}

function admin_has_role(array $allowedRoles): bool
{
    $role = current_admin_role();
    $normalized = array_map(fn($r) => strtolower(trim((string)$r)), $allowedRoles);
    return in_array($role, $normalized, true) || is_super_admin_role($role);
}

function require_admin_role(array $allowedRoles, string $message = 'Akses ditolak untuk role Anda'): void
{
    if (!admin_has_role($allowedRoles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => $message]);
        exit;
    }
}

function require_admin_auth(): void
{
    $allowDevBypass = ($_ENV['ALLOW_DEV_API_NO_AUTH'] ?? getenv('ALLOW_DEV_API_NO_AUTH') ?: 'false') === 'true';
    if ($allowDevBypass) {
        return;
    }

    if (!isset($_SESSION['admin_id']) || ($_SESSION['logged_in'] ?? false) !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: silakan login terlebih dahulu']);
        exit;
    }

    $timeout = 1800;
    if (isset($_SESSION['login_time']) && (time() - (int)$_SESSION['login_time'] > $timeout)) {
        session_unset();
        session_destroy();
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session expired']);
        exit;
    }

    $_SESSION['login_time'] = time();
}

require_admin_auth();
