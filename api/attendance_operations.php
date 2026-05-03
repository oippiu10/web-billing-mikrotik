<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        $date = $_GET['date'] ?? date('Y-m-d');
        $stmt = $conn->prepare("SELECT a.*, au.full_name, au.username FROM attendance a JOIN admin_users au ON a.admin_id = au.id WHERE a.date = ? ORDER BY a.check_in DESC");
        $stmt->bind_param("s", $date);
        $stmt->execute();
        $res = $stmt->get_result();
        $logs = [];
        while ($row = $res->fetch_assoc()) {
            $logs[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $logs]);
        break;

    case 'list_technicians':
        $res = $conn->query("SELECT id, username, full_name, role FROM admin_users ORDER BY full_name ASC");
        $users = [];
        while ($row = $res->fetch_assoc()) {
            $users[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $users]);
        break;

    case 'clock_in':
        $data = json_decode(file_get_contents('php://input'), true);
        $admin_id = $data['admin_id'];
        $date = date('Y-m-d');

        // Cek apakah sudah absen hari ini
        $check = $conn->prepare("SELECT id FROM attendance WHERE admin_id = ? AND date = ?");
        $check->bind_param("is", $admin_id, $date);
        $check->execute();
        if ($check->get_result()->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Anda sudah melakukan absen hari ini']);
            break;
        }

        $now = date('Y-m-d H:i:s');
        $status = $data['status'] ?? 'Hadir';
        $note = $data['note'] ?? '';

        $stmt = $conn->prepare("INSERT INTO attendance (admin_id, check_in, status, note, date) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("issss", $admin_id, $now, $status, $note, $date);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Absen hadir berhasil']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    case 'clock_out':
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'];
        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("UPDATE attendance SET check_out = ? WHERE id = ?");
        $stmt->bind_param("si", $now, $id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Clock out berhasil']);
        } else {
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
$conn->close();
?>