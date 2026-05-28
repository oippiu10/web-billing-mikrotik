<?php
/**
 * WhatsApp Receiver Webhook API
 * Menerima pesan masuk dari Node.js Baileys gateway dan menyimpannya ke database wa_queue dengan status 'received'
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';

// Pastikan request berasal dari internal localhost (Node.js Gateway local) demi alasan keamanan
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
$isLocalhost = ($clientIp === '127.0.0.1' || $clientIp === '::1' || $clientIp === 'localhost' || $clientIp === '127.0.0.1');

if (!$isLocalhost) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Webhook hanya menerima koneksi loopback lokal.']);
    exit;
}

try {
    // Jalankan ALTER secara otomatis agar status mendukung 'received'
    $conn->query("ALTER TABLE wa_queue MODIFY COLUMN status ENUM('pending', 'sending', 'sent', 'failed', 'received') DEFAULT 'pending'");

    // Ambil data POST input JSON
    $input = json_decode(file_get_contents('php://input'), true);
    $phone = trim($input['phone'] ?? '');
    $message = trim($input['message'] ?? '');

    if (empty($phone) || empty($message)) {
        echo json_encode(['success' => false, 'message' => 'Parameter phone dan message tidak boleh kosong']);
        exit;
    }

    // Format nomor HP agar standar internasional 628xxx
    $formattedPhone = preg_replace('/[^0-9]/', '', $phone);
    if (strpos($formattedPhone, '0') === 0) {
        $formattedPhone = '62' . substr($formattedPhone, 1);
    }

    // Masukkan pesan masuk ke database wa_queue dengan status 'received'
    $stmt = $conn->prepare("INSERT INTO wa_queue (router_id, phone, message, status, sent_at) VALUES (?, ?, ?, 'received', NOW())");
    $routerId = 'received_msg';
    $stmt->bind_param('sss', $routerId, $formattedPhone, $message);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Pesan masuk berhasil disimpan ke database']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Gagal menyimpan pesan masuk: ' . $stmt->error]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
