<?php
/**
 * Helper kecil untuk menulis log aktivitas admin ke tabel admin_activity_logs.
 * Aman dipanggil walaupun tabel belum ada atau kolom FK user_id tidak cocok.
 */
if (!function_exists('admin_activity_table_exists')) {
    function admin_activity_table_exists(mysqli $conn, string $table): bool
    {
        $stmt = $conn->prepare('SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        if (!$stmt) return false;
        $stmt->bind_param('s', $table);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return ((int)($row['cnt'] ?? 0)) > 0;
    }
}

if (!function_exists('log_admin_activity')) {
    function log_admin_activity(mysqli $conn, string $action, string $description = '', ?int $userId = null): void
    {
        if (!admin_activity_table_exists($conn, 'admin_activity_logs')) {
            return;
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

        // Tabel admin_activity_logs di schema lama punya FK ke admin_users.
        // Jika login memakai tabel administrators, simpan user_id NULL agar tidak kena FK error.
        $sessionTable = $_SESSION['admin_table'] ?? '';
        if ($sessionTable !== 'admin_users') {
            $userId = null;
        }

        $stmt = $conn->prepare("INSERT INTO admin_activity_logs (user_id, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) return;

        $stmt->bind_param('issss', $userId, $action, $description, $ip, $ua);
        @$stmt->execute();
        $stmt->close();
    }
}
