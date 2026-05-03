<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang boleh bulk delete ODP.');

$data = json_decode(file_get_contents("php://input"));

if (!$data || !isset($data->ids)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid input"]);
    exit();
}

$ids = $data->ids; // Array of ODP IDs

if (empty($ids)) {
    echo json_encode(["success" => true, "message" => "No ODP selected"]);
    exit();
}

try {
    $conn->begin_transaction();
    
    // Siapkan statement hapus
    $delStmt = $conn->prepare("DELETE FROM odp WHERE id = ?");
    
    $deleted_count = 0;
    foreach ($ids as $id) {
        $delStmt->bind_param("i", $id);
        if ($delStmt->execute() && $delStmt->affected_rows > 0) {
            $deleted_count++;
        }
    }

    $conn->commit();
    $delStmt->close();

    echo json_encode([
        "success" => true,
        "message" => "Berhasil menghapus $deleted_count ODP.",
        "deleted_count" => $deleted_count
    ]);

} catch (Exception $e) {
    if ($conn) $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
$conn->close();
?>
