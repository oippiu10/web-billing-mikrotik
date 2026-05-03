<?php
/**
 * Script sementara untuk reset password admin
 * HAPUS FILE INI setelah selesai digunakan!
 */
require_once __DIR__ . '/config.php';

$newPassword = 'admin123';
$hashed = password_hash($newPassword, PASSWORD_BCRYPT);

$stmt = $conn->prepare("UPDATE admin_users SET password = ? WHERE username = 'admin'");
$stmt->bind_param("s", $hashed);
$result = $stmt->execute();

if ($result) {
    echo json_encode([
        'success' => true,
        'message' => 'Password admin berhasil direset ke: admin123',
        'hash' => $hashed
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Gagal reset password: ' . $conn->error
    ]);
}

$conn->close();
?>
