<?php
require_once 'db.php';
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Auto-create table
$conn->query("
    CREATE TABLE IF NOT EXISTS finance_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$action = $_REQUEST['action'] ?? '';
$router_id = isset($_REQUEST['router_id']) ? intval($_REQUEST['router_id']) : 0;

if (!$router_id) {
    echo json_encode(['success' => false, 'message' => 'Router ID diperlukan']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        $stmt = $conn->prepare("SELECT * FROM finance_notes WHERE router_id = ? ORDER BY created_at DESC");
        $stmt->bind_param('i', $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $data = [];
        while ($row = $res->fetch_assoc()) {
            $data[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $data]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) $input = $_POST;
    
    $action = $input['action'] ?? $action;
    
    if ($action === 'add') {
        $content = $input['content'] ?? '';
        
        if (trim($content) === '') {
            echo json_encode(['success' => false, 'message' => 'Catatan tidak boleh kosong']);
            exit;
        }
        
        $stmt = $conn->prepare("INSERT INTO finance_notes (router_id, content) VALUES (?, ?)");
        $stmt->bind_param('is', $router_id, $content);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Catatan tersimpan']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal menyimpan catatan']);
        }
        exit;
    }
    
    if ($action === 'delete') {
        $id = isset($input['id']) ? intval($input['id']) : 0;
        
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'ID catatan tidak valid']);
            exit;
        }
        
        $stmt = $conn->prepare("DELETE FROM finance_notes WHERE id = ? AND router_id = ?");
        $stmt->bind_param('ii', $id, $router_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Catatan dihapus']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal menghapus catatan']);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
