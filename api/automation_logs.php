<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
require_admin_role(['admin','administrator','operator','finance','super_admin','super admin','superadministrator'], 'Akses log automation ditolak.');
ensure_automation_logs_table($conn);
$router_id = trim($_GET['router_id'] ?? '');
$month = intval($_GET['month'] ?? 0); $year = intval($_GET['year'] ?? 0); $limit = min(300, max(10, intval($_GET['limit'] ?? 100)));
$where=[]; $params=[]; $types='';
if ($router_id !== '') { $where[]='router_id = ?'; $params[]=$router_id; $types.='s'; }
if ($month > 0) { $where[]='period_month = ?'; $params[]=$month; $types.='i'; }
if ($year > 0) { $where[]='period_year = ?'; $params[]=$year; $types.='i'; }
$sql='SELECT * FROM automation_logs'.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY id DESC LIMIT ?';
$params[]=$limit; $types.='i';
$stmt=$conn->prepare($sql); $stmt->bind_param($types, ...$params); $stmt->execute();
$data=[]; $res=$stmt->get_result(); while($row=$res->fetch_assoc()) $data[]=$row;
echo json_encode(['success'=>true,'data'=>$data]);
function ensure_automation_logs_table(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS automation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id VARCHAR(64) NOT NULL,
        period_month INT DEFAULT NULL,
        period_year INT DEFAULT NULL,
        action VARCHAR(50) NOT NULL,
        dry_run TINYINT(1) DEFAULT 1,
        username VARCHAR(150) DEFAULT NULL,
        status VARCHAR(80) DEFAULT NULL,
        secret_id VARCHAR(80) DEFAULT NULL,
        admin_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_router_created (router_id, created_at),
        INDEX idx_period (period_month, period_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
