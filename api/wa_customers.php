<?php
/**
 * WhatsApp Customers Lookup API
 * Mengambil nama dan nomor WhatsApp pelanggan secara cepat dan aman untuk form Quick Sender
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Proteksi akses untuk admin/operator
require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak.');

try {
    // Ambil pelanggan yang memiliki nomor WA aktif
    $query = "SELECT username, wa, profile FROM users WHERE wa IS NOT NULL AND wa != '' ORDER BY username ASC";
    $result = $conn->query($query);
    
    $customers = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $customers[] = [
                'name' => $row['username'],
                'phone' => $row['wa'],
                'profile' => $row['profile']
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => $customers
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
