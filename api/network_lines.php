<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit();

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh mengubah network map.');
}

try {
    switch ($method) {
        case 'GET':
            $router_id = $_GET['router_id'] ?? '';
            if (!$router_id) throw new Exception("router_id wajib");
            
            $stmt = $conn->prepare("SELECT * FROM network_lines WHERE router_id = ?");
            $stmt->bind_param("s", $router_id);
            $stmt->execute();
            $res = $stmt->get_result();
            $data = [];
            while($row = $res->fetch_assoc()) {
                $row['path'] = json_decode($row['path'], true);
                $data[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $data]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $path = json_encode($input['path']);
            $stmt = $conn->prepare("INSERT INTO network_lines (router_id, name, type, path, color) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("sssss", $input['router_id'], $input['name'], $input['type'], $path, $input['color']);
            $stmt->execute();
            echo json_encode(['success' => true, 'id' => $conn->insert_id]);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? 0;
            $stmt = $conn->prepare("DELETE FROM network_lines WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            echo json_encode(['success' => true]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
