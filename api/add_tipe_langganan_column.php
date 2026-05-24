<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/config.php';

try {
    // Cek apakah kolom sudah ada
    $check = $conn->query("SHOW COLUMNS FROM users LIKE 'tipe_langganan'");
    if ($check->num_rows === 0) {
        // Tambahkan kolom baru
        $sql = "ALTER TABLE users ADD COLUMN tipe_langganan VARCHAR(20) DEFAULT 'pascabayar' AFTER tanggal_tagihan";
        if ($conn->query($sql)) {
            echo json_encode([
                'success' => true,
                'message' => 'Kolom tipe_langganan berhasil ditambahkan ke tabel users.'
            ]);
        } else {
            throw new Exception($conn->error);
        }
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Kolom tipe_langganan sudah ada di tabel users.'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal menjalankan migrasi: ' . $e->getMessage()
    ]);
}
?>
