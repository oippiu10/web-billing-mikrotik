<?php
require_once 'config.php';
require_once 'router_id_helper.php';

$router_id = requireRouterIdFromGet($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $stmt = $conn->prepare("SELECT * FROM inventory WHERE router_id = ? ORDER BY category, name");
        $stmt->bind_param("i", $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $items = [];
        while ($row = $res->fetch_assoc()) {
            $items[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $items]);
        break;

    case 'add':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("INSERT INTO inventory (router_id, name, category, stock, unit, price, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("isssis s", $router_id, $data['name'], $data['category'], $data['stock'], $data['unit'], $data['price'], $data['description']);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Item berhasil ditambah']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'update':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("UPDATE inventory SET name=?, category=?, stock=?, unit=?, price=?, description=? WHERE id=? AND router_id=?");
        $stmt->bind_param("ssisds ii", $data['name'], $data['category'], $data['stock'], $data['unit'], $data['price'], $data['description'], $data['id'], $router_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Item berhasil diupdate']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'delete':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("DELETE FROM inventory WHERE id=? AND router_id=?");
        $stmt->bind_param("ii", $data['id'], $router_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Item berhasil dihapus']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
$conn->close();
?>