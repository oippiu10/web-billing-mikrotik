<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Body JSON tidak valid.']);
    exit;
}

$routerId = trim($input['router_id'] ?? '');
$updates  = $input['updates'] ?? [];

if (!is_array($updates) || count($updates) === 0) {
    echo json_encode(['success' => false, 'message' => 'Tidak ada data yang dikirim.']);
    exit;
}

$successCount = 0;
$errorCount   = 0;
$errors       = [];

foreach ($updates as $row) {
    $username = trim($row['username'] ?? '');
    if (empty($username)) { $errorCount++; continue; }

    // Bangun SET dinamis: hanya update field yang dikirim (tidak null)
    $fields  = ['wa', 'alamat', 'maps', 'redaman', 'tanggal_tagihan'];
    $setParts = [];
    $params   = [];
    $types    = '';

    foreach ($fields as $f) {
        if (array_key_exists($f, $row)) {
            // Update field ini (termasuk jika string kosong — user sengaja menghapus)
            $setParts[] = "`$f` = ?";
            
            $val = $row[$f];
            // Fix untuk MySQL Strict Mode: Date tidak boleh string kosong, harus NULL
            if ($f === 'tanggal_tagihan' && trim((string)$val) === '') {
                $val = null;
            }
            
            $params[]   = $val;
            $types      .= 's';
        }
    }

    // Khusus foto: hanya update jika base64 dikirim dan tidak kosong
    if (!empty($row['foto'])) {
        $setParts[] = '`foto` = ?';
        $params[]   = $row['foto'];
        $types      .= 's';
    }

    if (empty($setParts)) { $errorCount++; continue; }

    // Tambahkan WHERE params
    $params[] = $username;
    $params[] = $routerId;
    $types   .= 'ss';

    $sql  = "UPDATE users SET " . implode(', ', $setParts) . " WHERE username = ? AND router_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        $successCount++;
    } else {
        $errorCount++;
        $errors[] = "username=$username: " . $stmt->error;
    }
    $stmt->close();
}

echo json_encode([
    'success'      => true,
    'message'      => "Berhasil diperbarui: $successCount, Gagal: $errorCount.",
    'updated'      => $successCount,
    'failed'       => $errorCount,
    'error_detail' => $errors
]);
?>
