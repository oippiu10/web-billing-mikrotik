<?php
require_once 'config.php';
require_once 'router_id_helper.php';

$router_id = requireRouterIdFromGet($conn);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $stmt = $conn->prepare("SELECT * FROM tickets WHERE router_id = ? ORDER BY created_at DESC");
        $stmt->bind_param("i", $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $tickets = [];
        while ($row = $res->fetch_assoc()) {
            $tickets[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $tickets]);
        break;

    case 'add':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("INSERT INTO tickets (router_id, username, category, priority, description) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("issss", $router_id, $data['username'], $data['category'], $data['priority'], $data['description']);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Tiket berhasil dibuat']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'update_status':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("UPDATE tickets SET status = ? WHERE id = ? AND router_id = ?");
        $stmt->bind_param("sii", $data['status'], $data['id'], $router_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Status tiket diperbarui']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'assign_spk':
        $data = json_decode(file_get_contents('php://input'), true);
        $conn->begin_transaction();
        try {
            $stmt1 = $conn->prepare("INSERT INTO spk (ticket_id, technician_name, task_description) VALUES (?, ?, ?)");
            $stmt1->bind_param("iss", $data['ticket_id'], $data['technician_name'], $data['task_description']);
            $stmt1->execute();

            $stmt2 = $conn->prepare("UPDATE tickets SET status = 'In Progress' WHERE id = ?");
            $stmt2->bind_param("i", $data['ticket_id']);
            $stmt2->execute();

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'SPK berhasil ditugaskan']);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'list_spk':
        $stmt = $conn->prepare("SELECT s.*, t.username, t.category FROM spk s JOIN tickets t ON s.ticket_id = t.id WHERE t.router_id = ? ORDER BY s.created_at DESC");
        $stmt->bind_param("i", $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $spks = [];
        while ($row = $res->fetch_assoc()) {
            $spks[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $spks]);
        break;

    case 'update_spk_status':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("UPDATE spk SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $data['status'], $data['id']);
        if ($stmt->execute()) {
            // Jika SPK selesai, set tiket jadi resolved
            if ($data['status'] === 'Done') {
                $stmt2 = $conn->prepare("UPDATE tickets SET status = 'Resolved' WHERE id = (SELECT ticket_id FROM spk WHERE id = ?)");
                $stmt2->bind_param("i", $data['id']);
                $stmt2->execute();
            }
            echo json_encode(['success' => true, 'message' => 'Status SPK diperbarui']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
$conn->close();
?>