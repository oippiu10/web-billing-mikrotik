<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh bulk update ODP.');

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['ids']) || !isset($data['updates'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid input"]);
    exit();
}

$ids = $data['ids'];
$updates = $data['updates'];

if (empty($ids) || empty($updates)) {
    echo json_encode(["success" => false, "error" => "No ODP or updates provided"]);
    exit();
}

try {
    $set_parts = [];
    $types = "";
    $params = [];
    foreach ($updates as $key => $val) {
        $set_parts[] = "$key = ?";
        if (is_int($val)) $types .= "i";
        else $types .= "s";
        $params[] = $val;
    }
    
    $sql = "UPDATE odp SET " . implode(", ", $set_parts) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    
    $success_count = 0;
    foreach ($ids as $id) {
        $current_params = array_merge($params, [$id]);
        $current_types = $types . "i";
        $stmt->bind_param($current_types, ...$current_params);
        if ($stmt->execute()) {
            $success_count++;
        }
    }
    
    $stmt->close();
    echo json_encode([
        "success" => true,
        "message" => "Berhasil memperbarui $success_count ODP.",
        "count" => $success_count
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
$conn->close();
?>
