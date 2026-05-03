<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh import/bulk upsert pelanggan.');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if (!$input) {
        throw new Exception('Body JSON tidak valid.');
    }

    $routerId = trim($input['router_id'] ?? '');
    $updates = $input['updates'] ?? [];

    if (empty($routerId)) {
        throw new Exception('Parameter router_id wajib.');
    }

    $successCount = 0;
    $errorCount = 0;
    $errors = [];

    foreach ($updates as $row) {
        $id = $row['id'] ?? null;
        $username = trim($row['username'] ?? '');
        
        if (empty($username) && empty($id)) continue;

        try {
            // Check if user exists using ID first, then username+router_id
            $exists = false;
            $userId = null;
            
            if ($id) {
                $stmtChk = $conn->prepare("SELECT id FROM users WHERE id = ?");
                $stmtChk->bind_param("i", $id);
                $stmtChk->execute();
                $resChk = $stmtChk->get_result();
                if ($resChk->num_rows > 0) {
                    $exists = true;
                    $userId = $id;
                }
                $stmtChk->close();
            } else {
                $stmtChk = $conn->prepare("SELECT id FROM users WHERE username = ? AND router_id = ?");
                $stmtChk->bind_param("ss", $username, $routerId);
                $stmtChk->execute();
                $resChk = $stmtChk->get_result();
                if ($resChk->num_rows > 0) {
                    $exists = true;
                    $userId = $resChk->fetch_assoc()['id'];
                }
                $stmtChk->close();
            }

            if ($exists) {
                // UPDATE
                $fields = ['profile', 'password', 'wa', 'alamat', 'maps', 'redaman', 'tanggal_tagihan', 'odp_id'];
                $setParts = [];
                $params = [];
                $types = '';

                foreach ($fields as $f) {
                    if (array_key_exists($f, $row)) {
                        $val = $row[$f];
                        
                        if (($f === 'tanggal_tagihan' || $f === 'odp_id') && ($val === '' || $val === 'none' || $val === null)) {
                            $val = null;
                        }

                        $setParts[] = "`$f` = ?";
                        $params[] = $val;
                        $types .= 's';
                    }
                }

                if (!empty($setParts)) {
                    $sql = "UPDATE users SET " . implode(', ', $setParts) . ", updated_at = NOW() WHERE id = ?";
                    $stmt = $conn->prepare($sql);
                    
                    $params[] = $userId;
                    $types .= 'i';
                    
                    $stmt->bind_param($types, ...$params);
                    $stmt->execute();
                    $successCount++;
                    $stmt->close();
                }
            } else {
                // INSERT
                $password = $row['password'] ?? $username;
                $profile = $row['profile'] ?? 'default';
                $wa = $row['wa'] ?? '';
                $alamat = $row['alamat'] ?? '';
                $maps = $row['maps'] ?? '';
                $redaman = $row['redaman'] ?? '';
                $tagihan = $row['tanggal_tagihan'] ?? null;
                $odp_id = $row['odp_id'] ?? null;
                
                if ($tagihan === '' || $tagihan === 'none') $tagihan = null;
                if ($odp_id === '' || $odp_id === 'none') $odp_id = null;

                $stmt = $conn->prepare("INSERT INTO users (router_id, username, password, profile, wa, alamat, maps, redaman, tanggal_tagihan, odp_id, tanggal_dibuat, on_router) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)");
                $stmt->bind_param("sssssssssi", $routerId, $username, $password, $profile, $wa, $alamat, $maps, $redaman, $tagihan, $odp_id);
                $stmt->execute();
                $successCount++;
                $stmt->close();
            }
        } catch (Exception $e) {
            $errorCount++;
            $errors[] = ($username ?: "ID $id") . ": " . $e->getMessage();
        }
    }

    echo json_encode([
        'success' => true,
        'message' => "Proses selesai. Berhasil: $successCount, Gagal: $errorCount.",
        'details' => [
            'success' => $successCount,
            'errors' => $errorCount,
            'messages' => $errors
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage(),
        'error' => $e->getMessage()
    ]);
}
?>
