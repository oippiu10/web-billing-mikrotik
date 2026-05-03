<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/router_id_helper.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'], 'Akses ticketing ditolak.');

function ensure_ticket_tables(mysqli $conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        username VARCHAR(120) NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Gangguan',
        priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
        status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_router_status (router_id, status),
        INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS spk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        technician_name VARCHAR(120) NOT NULL,
        task_description TEXT NULL,
        status ENUM('Assigned','On Progress','Done','Canceled') NOT NULL DEFAULT 'Assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function json_input(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }

ensure_ticket_tables($conn);
$router_id = requireRouterIdFromGet($conn);
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        $status = trim($_GET['status'] ?? '');
        $search = '%' . trim($_GET['search'] ?? '') . '%';
        if ($status !== '') {
            $stmt = $conn->prepare("SELECT * FROM tickets WHERE router_id = ? AND status = ? AND (username LIKE ? OR category LIKE ? OR description LIKE ?) ORDER BY created_at DESC");
            $stmt->bind_param("issss", $router_id, $status, $search, $search, $search);
        } else {
            $stmt = $conn->prepare("SELECT * FROM tickets WHERE router_id = ? AND (username LIKE ? OR category LIKE ? OR description LIKE ?) ORDER BY created_at DESC");
            $stmt->bind_param("isss", $router_id, $search, $search, $search);
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $tickets = [];
        $summary = ['Open' => 0, 'In Progress' => 0, 'Resolved' => 0, 'Closed' => 0];
        while ($row = $res->fetch_assoc()) {
            if (isset($summary[$row['status']])) $summary[$row['status']]++;
            $tickets[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $tickets, 'summary' => $summary]);
        break;

    case 'add':
        $data = json_input();
        $username = trim($data['username'] ?? '');
        if ($username === '') throw new Exception('Username pelanggan wajib diisi');
        $category = trim($data['category'] ?? 'Gangguan');
        $priority = in_array(($data['priority'] ?? 'Normal'), ['Low','Normal','High','Urgent'], true) ? $data['priority'] : 'Normal';
        $description = trim($data['description'] ?? '');
        $stmt = $conn->prepare("INSERT INTO tickets (router_id, username, category, priority, description) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("issss", $router_id, $username, $category, $priority, $description);
        $ok = $stmt->execute();
        if ($ok) log_admin_activity($conn, 'ticket_add', 'Membuat tiket untuk ' . $username, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => $ok, 'message' => $ok ? 'Tiket berhasil dibuat' : $conn->error]);
        break;

    case 'update_status':
        $data = json_input();
        $status = in_array(($data['status'] ?? 'Open'), ['Open','In Progress','Resolved','Closed'], true) ? $data['status'] : 'Open';
        $id = intval($data['id'] ?? 0);
        $stmt = $conn->prepare("UPDATE tickets SET status = ? WHERE id = ? AND router_id = ?");
        $stmt->bind_param("sii", $status, $id, $router_id);
        $ok = $stmt->execute();
        if ($ok) log_admin_activity($conn, 'ticket_status', 'Update status tiket ID ' . $id . ' ke ' . $status, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => $ok, 'message' => $ok ? 'Status tiket diperbarui' : $conn->error]);
        break;

    case 'assign_spk':
        $data = json_input();
        $ticketId = intval($data['ticket_id'] ?? 0);
        $tech = trim($data['technician_name'] ?? 'Teknisi');
        $task = trim($data['task_description'] ?? '');
        $conn->begin_transaction();
        try {
            $stmt1 = $conn->prepare("INSERT INTO spk (ticket_id, technician_name, task_description) VALUES (?, ?, ?)");
            $stmt1->bind_param("iss", $ticketId, $tech, $task);
            $stmt1->execute();
            $stmt2 = $conn->prepare("UPDATE tickets SET status = 'In Progress' WHERE id = ? AND router_id = ?");
            $stmt2->bind_param("ii", $ticketId, $router_id);
            $stmt2->execute();
            $conn->commit();
            log_admin_activity($conn, 'ticket_assign', 'Assign SPK tiket ID ' . $ticketId . ' ke ' . $tech, (int)($_SESSION['admin_id'] ?? 0));
            echo json_encode(['success' => true, 'message' => 'SPK berhasil ditugaskan']);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'list_spk':
        $stmt = $conn->prepare("SELECT s.*, t.username, t.category, t.priority FROM spk s JOIN tickets t ON s.ticket_id = t.id WHERE t.router_id = ? ORDER BY s.created_at DESC");
        $stmt->bind_param("i", $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $spks = [];
        while ($row = $res->fetch_assoc()) $spks[] = $row;
        echo json_encode(['success' => true, 'data' => $spks]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
?>
