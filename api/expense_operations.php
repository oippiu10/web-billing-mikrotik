<?php
require_once 'config.php';
require_once 'router_id_helper.php';

$router_id = requireRouterIdFromGet($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $month = $_GET['month'] ?? date('m');
        $year = $_GET['year'] ?? date('Y');
        $stmt = $conn->prepare("SELECT * FROM expenses WHERE router_id = ? AND MONTH(spent_at) = ? AND YEAR(spent_at) = ? ORDER BY spent_at DESC");
        $stmt->bind_param("iii", $router_id, $month, $year);
        $stmt->execute();
        $res = $stmt->get_result();
        $expenses = [];
        while ($row = $res->fetch_assoc()) {
            $expenses[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $expenses]);
        break;

    case 'add':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("INSERT INTO expenses (router_id, category, amount, note, spent_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("isdss", $router_id, $data['category'], $data['amount'], $data['note'], $data['spent_at']);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Pengeluaran berhasil dicatat']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'delete':
        $id = $_GET['id'] ?? 0;
        $stmt = $conn->prepare("DELETE FROM expenses WHERE id = ? AND router_id = ?");
        $stmt->bind_param("ii", $id, $router_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Pengeluaran berhasil dihapus']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
$conn->close();
?>