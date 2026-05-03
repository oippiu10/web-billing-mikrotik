<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
require_admin_role(['admin','administrator','super_admin','super admin','superadministrator','operator'], 'Akses OLT ditolak.');

function input_data(): array { return json_decode(file_get_contents('php://input'), true) ?: $_POST; }
function ensure_tables(mysqli $conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS olts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        brand VARCHAR(80) NOT NULL DEFAULT 'Generic',
        host VARCHAR(120) NOT NULL,
        port INT NOT NULL DEFAULT 23,
        protocol ENUM('snmp','telnet','ssh','api','manual') NOT NULL DEFAULT 'manual',
        username VARCHAR(120) NULL,
        password VARCHAR(190) NULL,
        snmp_community VARCHAR(120) NULL,
        pon_ports INT NOT NULL DEFAULT 0,
        total_onu INT NOT NULL DEFAULT 0,
        online_onu INT NOT NULL DEFAULT 0,
        offline_onu INT NOT NULL DEFAULT 0,
        status ENUM('unknown','online','offline','maintenance') NOT NULL DEFAULT 'unknown',
        location VARCHAR(190) NULL,
        note TEXT NULL,
        last_checked_at DATETIME NULL,
        last_check_message VARCHAR(255) NULL,
        response_ms INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status), INDEX idx_brand (brand)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
ensure_tables($conn);
ensure_column($conn, 'olts', 'last_checked_at', 'DATETIME NULL');
ensure_column($conn, 'olts', 'last_check_message', 'VARCHAR(255) NULL');
ensure_column($conn, 'olts', 'response_ms', 'INT NULL');
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

switch ($action) {
    case 'list':
        $res = $conn->query('SELECT id,name,brand,host,port,protocol,pon_ports,total_onu,online_onu,offline_onu,status,location,note,last_checked_at,last_check_message,response_ms,created_at,updated_at FROM olts ORDER BY id DESC');
        $rows = [];$summary = ['total'=>0,'online'=>0,'offline'=>0,'maintenance'=>0,'unknown'=>0,'onu_total'=>0,'onu_online'=>0,'onu_offline'=>0];
        while ($row = $res->fetch_assoc()) { $summary['total']++; if(isset($summary[$row['status']])) $summary[$row['status']]++; $summary['onu_total'] += intval($row['total_onu']); $summary['onu_online'] += intval($row['online_onu']); $summary['onu_offline'] += intval($row['offline_onu']); $rows[]=$row; }
        echo json_encode(['success'=>true,'data'=>$rows,'summary'=>$summary]);
        break;
    case 'add':
        $d = input_data();
        $name = trim($d['name'] ?? ''); $host = trim($d['host'] ?? '');
        if ($name === '' || $host === '') { echo json_encode(['success'=>false,'message'=>'Nama dan host wajib diisi']); break; }
        $brand = trim($d['brand'] ?? 'Generic'); $port = intval($d['port'] ?? 23); $protocol = in_array(($d['protocol'] ?? 'manual'), ['snmp','telnet','ssh','api','manual'], true) ? $d['protocol'] : 'manual';
        $username = trim($d['username'] ?? ''); $password = trim($d['password'] ?? ''); $community = trim($d['snmp_community'] ?? 'public');
        $pon = intval($d['pon_ports'] ?? 0); $total = intval($d['total_onu'] ?? 0); $online = intval($d['online_onu'] ?? 0); $offline = max(0, $total - $online);
        $status = in_array(($d['status'] ?? 'unknown'), ['unknown','online','offline','maintenance'], true) ? $d['status'] : 'unknown'; $location = trim($d['location'] ?? ''); $note = trim($d['note'] ?? '');
        $stmt = $conn->prepare('INSERT INTO olts (name,brand,host,port,protocol,username,password,snmp_community,pon_ports,total_onu,online_onu,offline_onu,status,location,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->bind_param('sssissssiiiisss', $name,$brand,$host,$port,$protocol,$username,$password,$community,$pon,$total,$online,$offline,$status,$location,$note);
        $ok = $stmt->execute(); if($ok) log_admin_activity($conn,'olt_add','Tambah OLT '.$name, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'message'=>$ok?'OLT berhasil ditambahkan':$conn->error]);
        break;
    case 'update_status':
        $d = input_data(); $id = intval($d['id'] ?? 0); $status = in_array(($d['status'] ?? 'unknown'), ['unknown','online','offline','maintenance'], true) ? $d['status'] : 'unknown';
        $stmt = $conn->prepare('UPDATE olts SET status=? WHERE id=?'); $stmt->bind_param('si',$status,$id); $ok=$stmt->execute();
        if($ok) log_admin_activity($conn,'olt_status','Update status OLT ID '.$id.' ke '.$status, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'message'=>$ok?'Status OLT diperbarui':$conn->error]);
        break;
    case 'check_status':
        $d = input_data(); $id = intval($d['id'] ?? 0);
        $stmt = $conn->prepare('SELECT id,name,host,port,protocol,status FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $start = microtime(true); $errno = 0; $errstr = '';
        $port = intval($olt['port']) ?: (($olt['protocol'] === 'snmp') ? 161 : 23);
        $fp = @fsockopen($olt['host'], $port, $errno, $errstr, 3.0);
        $ms = intval((microtime(true) - $start) * 1000);
        $status = $fp ? 'online' : 'offline'; if ($fp) fclose($fp);
        $message = $fp ? 'TCP port reachable' : ('Tidak terhubung: '.($errstr ?: 'timeout'));
        $up = $conn->prepare('UPDATE olts SET status=?, last_checked_at=NOW(), last_check_message=?, response_ms=? WHERE id=?');
        $up->bind_param('ssii', $status, $message, $ms, $id); $ok = $up->execute();
        if($ok) log_admin_activity($conn,'olt_check','Check OLT ID '.$id.' hasil '.$status, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'status'=>$status,'response_ms'=>$ms,'message'=>$message]);
        break;
    case 'delete':
        $d = input_data(); $id = intval($d['id'] ?? 0); $stmt = $conn->prepare('DELETE FROM olts WHERE id=?'); $stmt->bind_param('i',$id); $ok=$stmt->execute();
        if($ok) log_admin_activity($conn,'olt_delete','Hapus OLT ID '.$id, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'message'=>$ok?'OLT dihapus':$conn->error]);
        break;
    default: echo json_encode(['success'=>false,'message'=>'Aksi tidak valid']);
}

function ensure_column(mysqli $conn, string $table, string $column, string $definition): void {
    $safeTable = preg_replace('/[^A-Za-z0-9_]/', '', $table);
    $safeColumn = preg_replace('/[^A-Za-z0-9_]/', '', $column);
    $res = $conn->query("SHOW COLUMNS FROM `$safeTable` LIKE '$safeColumn'");
    if ($res && $res->num_rows === 0) $conn->query("ALTER TABLE `$safeTable` ADD COLUMN `$safeColumn` $definition");
}
