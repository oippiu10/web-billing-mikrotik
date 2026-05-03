<?php
/**
 * Web Settings API — GET/POST pengaturan web
 * GET  → Ambil semua settings sebagai key-value object
 * POST → Simpan/update settings (upsert)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang boleh mengubah web settings.');
}

try {
    switch ($method) {
        // ===================================
        // GET — Ambil semua settings
        // ===================================
        case 'GET':
            $result = $conn->query("SELECT setting_key, setting_value FROM web_settings");
            $settings = [];
            while ($row = $result->fetch_assoc()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
            echo json_encode(['success' => true, 'data' => $settings]);
            break;

        // ===================================
        // POST — Simpan settings (upsert)
        // Body: { "settings": { "key1": "val1", "key2": "val2" } }
        // ===================================
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['settings'])) {
                echo json_encode(['success' => false, 'message' => 'Data settings wajib']);
                exit();
            }

            $stmt = $conn->prepare("INSERT INTO web_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

            $saved = 0;
            foreach ($input['settings'] as $key => $value) {
                $k = strval($key);
                $v = strval($value);
                $stmt->bind_param("ss", $k, $v);
                $stmt->execute();
                $saved++;
            }

            echo json_encode(['success' => true, 'message' => "$saved setting disimpan"]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
