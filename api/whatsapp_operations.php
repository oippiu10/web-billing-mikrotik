<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=UTF-8');

$action = $_GET['action'] ?? '';

// Ambil settings WA dari database
$resSettings = $conn->query("SELECT setting_key, setting_value FROM web_settings WHERE setting_key IN ('wahaUrl', 'wahaKey', 'wahaSess')");
$waSettings = [];
while ($row = $resSettings->fetch_assoc()) {
    $waSettings[$row['setting_key']] = $row['setting_value'];
}

$apiUrl = $waSettings['wahaUrl'] ?? '';
$apiKey = $waSettings['wahaKey'] ?? '';
$session = $waSettings['wahaSess'] ?? 'default';

switch ($action) {
    case 'get_recipients':
        $filter = $_GET['filter'] ?? 'all';
        $sql = "SELECT full_name, phone FROM customers";
        if ($filter === 'active') {
            $sql .= " WHERE status = 'active'";
        } else if ($filter === 'expired') {
            $sql .= " WHERE status = 'expired'";
        }

        $res = $conn->query($sql);
        $recipients = [];
        while ($row = $res->fetch_assoc()) {
            if (!empty($row['phone'])) {
                $recipients[] = [
                    'name' => $row['full_name'],
                    'phone' => preg_replace('/[^0-9]/', '', $row['phone'])
                ];
            }
        }
        echo json_encode(['success' => true, 'data' => $recipients]);
        break;

    case 'send':
        $data = json_decode(file_get_contents('php://input'), true);
        $phone = $data['phone'] ?? '';
        $message = $data['message'] ?? '';

        if (empty($apiUrl)) {
            echo json_encode(['success' => false, 'message' => 'API WhatsApp belum dikonfigurasi di Settings']);
            exit();
        }

        // Contoh integrasi dengan WAHA (WhatsApp HTTP API) atau sejenisnya
        // Sesuaikan dengan API yang anda gunakan (Fonnte, Waba, dsb.)

        // Pseudo-logic kirim
        /*
        $ch = curl_init($apiUrl . '/api/sendText');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'chatId' => $phone . '@c.us',
            'text' => $message,
            'session' => 'default'
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Api-Key: ' . $apiKey
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        */

        // Simulator sukses agar UI bisa berjalan
        echo json_encode(['success' => true, 'message' => "Pesan ke $phone terkirim (Simulasi)"]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}

$conn->close();
