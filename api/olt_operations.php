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
    $conn->query("CREATE TABLE IF NOT EXISTS olt_onus (
        id INT AUTO_INCREMENT PRIMARY KEY,
        olt_id INT NOT NULL,
        pon VARCHAR(20) NULL,
        onu_no VARCHAR(20) NULL,
        onu_id VARCHAR(30) NULL,
        name VARCHAR(120) NULL,
        mac VARCHAR(32) NULL,
        status VARCHAR(30) NULL,
        auth_state VARCHAR(30) NULL,
        register_time VARCHAR(40) NULL,
        last_deregister_time VARCHAR(40) NULL,
        last_deregister_reason VARCHAR(80) NULL,
        device_type VARCHAR(40) NULL,
        onu_type VARCHAR(40) NULL,
        round_trip_time VARCHAR(40) NULL,
        receive_power VARCHAR(40) NULL,
        raw_line TEXT NULL,
        last_seen_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_olt_onu (olt_id, onu_id),
        INDEX idx_olt_status (olt_id, status), INDEX idx_mac (mac), INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
ensure_tables($conn);
ensure_column($conn, 'olts', 'last_checked_at', 'DATETIME NULL');
ensure_column($conn, 'olts', 'last_check_message', 'VARCHAR(255) NULL');
ensure_column($conn, 'olts', 'response_ms', 'INT NULL');
ensure_column($conn, 'olts', 'sys_name', 'VARCHAR(190) NULL');
ensure_column($conn, 'olts', 'sys_descr', 'TEXT NULL');
ensure_column($conn, 'olts', 'sys_uptime', 'VARCHAR(190) NULL');
ensure_column($conn, 'olts', 'last_snmp_at', 'DATETIME NULL');
ensure_column($conn, 'olts', 'web_username', 'VARCHAR(120) NULL');
ensure_column($conn, 'olts', 'web_password', 'VARCHAR(190) NULL');
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

switch ($action) {
    case 'list':
        $res = $conn->query('SELECT id,name,brand,host,port,protocol,snmp_community,pon_ports,total_onu,online_onu,offline_onu,status,location,note,last_checked_at,last_check_message,response_ms,sys_name,sys_descr,sys_uptime,last_snmp_at,created_at,updated_at FROM olts ORDER BY id DESC');
        $rows = [];$summary = ['total'=>0,'online'=>0,'offline'=>0,'maintenance'=>0,'unknown'=>0,'onu_total'=>0,'onu_online'=>0,'onu_offline'=>0];
        while ($row = $res->fetch_assoc()) { $summary['total']++; if(isset($summary[$row['status']])) $summary[$row['status']]++; $summary['onu_total'] += intval($row['total_onu']); $summary['onu_online'] += intval($row['online_onu']); $summary['onu_offline'] += intval($row['offline_onu']); $rows[]=$row; }
        echo json_encode(['success'=>true,'data'=>$rows,'summary'=>$summary]);
        break;
    case 'test_connection':
        $d = input_data();
        $host = trim($d['host'] ?? ''); $port = intval($d['port'] ?? 23); $protocol = trim($d['protocol'] ?? 'snmp');
        if ($host === '') { echo json_encode(['success'=>false,'message'=>'IP/Host wajib diisi']); break; }
        $result = olt_connectivity_test($host, $port, $protocol);
        echo json_encode($result);
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
    case 'update_snmp':
        $d = input_data(); $id = intval($d['id'] ?? 0); $community = trim($d['snmp_community'] ?? 'public-read');
        if ($id <= 0 || $community === '') { echo json_encode(['success'=>false,'message'=>'ID dan SNMP community wajib diisi']); break; }
        $stmt = $conn->prepare('UPDATE olts SET snmp_community=? WHERE id=?'); $stmt->bind_param('si',$community,$id); $ok=$stmt->execute();
        if($ok) log_admin_activity($conn,'olt_snmp_update','Update SNMP community OLT ID '.$id, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'message'=>$ok?'SNMP community diperbarui':$conn->error]);
        break;
    case 'update_status':
        $d = input_data(); $id = intval($d['id'] ?? 0); $status = in_array(($d['status'] ?? 'unknown'), ['unknown','online','offline','maintenance'], true) ? $d['status'] : 'unknown';
        $stmt = $conn->prepare('UPDATE olts SET status=? WHERE id=?'); $stmt->bind_param('si',$status,$id); $ok=$stmt->execute();
        if($ok) log_admin_activity($conn,'olt_status','Update status OLT ID '.$id.' ke '.$status, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>$ok,'message'=>$ok?'Status OLT diperbarui':$conn->error]);
        break;
    case 'snmp_probe':
        $d = input_data(); $id = intval($d['id'] ?? 0); $group = preg_replace('/[^a-z0-9_-]/i', '', $d['group'] ?? 'fast');
        $stmt = $conn->prepare('SELECT id,name,host,snmp_community FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $probe = olt_snmp_probe($olt['host'], $olt['snmp_community'] ?: 'public', $group);
        if ($probe['success']) log_admin_activity($conn,'olt_snmp_probe','SNMP probe OLT ID '.$id.' group '.$group, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode($probe);
        break;
    case 'snmp_interfaces':
        $d = input_data(); $id = intval($d['id'] ?? 0);
        $stmt = $conn->prepare('SELECT id,name,host,snmp_community FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $ifs = olt_snmp_interfaces($olt['host'], $olt['snmp_community'] ?: 'public');
        if ($ifs['success']) {
            $totalOnu = intval($ifs['customer_total'] ?? 0); $onlineOnu = intval($ifs['customer_online'] ?? 0);
            $ponPorts = intval($ifs['pon_total'] ?? 0);
            $up = $conn->prepare('UPDATE olts SET total_onu=?, online_onu=?, pon_ports=?, status="online", last_checked_at=NOW(), last_check_message=?, response_ms=0 WHERE id=?');
            $msg = 'Interface monitor OK: '.$onlineOnu.'/'.$totalOnu.' customer online';
            $up->bind_param('iiisi', $totalOnu, $onlineOnu, $ponPorts, $msg, $id); $up->execute();
            log_admin_activity($conn,'olt_snmp_interfaces','SNMP interfaces OLT ID '.$id.' '.$onlineOnu.'/'.$totalOnu.' online', intval($_SESSION['admin_id'] ?? 0));
        }
        echo json_encode($ifs);
        break;
    case 'onu_list':
        $d = input_data(); $id = intval($d['id'] ?? ($_GET['id'] ?? 0));
        $rows = [];
        $stmt = $conn->prepare('SELECT * FROM olt_onus WHERE olt_id=? ORDER BY CAST(SUBSTRING_INDEX(onu_id,"/",1) AS UNSIGNED), CAST(SUBSTRING_INDEX(onu_id,"/",-1) AS UNSIGNED), id');
        $stmt->bind_param('i', $id); $stmt->execute(); $res = $stmt->get_result();
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        $online = count(array_filter($rows, fn($r) => strtolower($r['status'] ?? '') === 'online'));
        echo json_encode(['success'=>true,'count'=>count($rows),'online'=>$online,'offline'=>count($rows)-$online,'data'=>$rows]);
        break;
    case 'onu_import_text':
        $d = input_data(); $id = intval($d['id'] ?? 0); $text = trim($d['text'] ?? '');
        if ($id <= 0 || $text === '') { echo json_encode(['success'=>false,'message'=>'ID OLT dan text tabel ONU wajib diisi']); break; }
        $parsed = parse_hsgq_onu_text($text);
        if (empty($parsed)) { echo json_encode(['success'=>false,'message'=>'Tidak ada baris ONU terbaca. Paste baris tabel mulai dari ONU ID, contoh: 1/1 pck@inul 94:bf:... Online ... -16 dBm']); break; }
        $conn->begin_transaction();
        $stmt = $conn->prepare('INSERT INTO olt_onus (olt_id,pon,onu_no,onu_id,name,mac,status,auth_state,register_time,last_deregister_time,last_deregister_reason,device_type,onu_type,round_trip_time,receive_power,raw_line,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE pon=VALUES(pon),onu_no=VALUES(onu_no),name=VALUES(name),mac=VALUES(mac),status=VALUES(status),auth_state=VALUES(auth_state),register_time=VALUES(register_time),last_deregister_time=VALUES(last_deregister_time),last_deregister_reason=VALUES(last_deregister_reason),device_type=VALUES(device_type),onu_type=VALUES(onu_type),round_trip_time=VALUES(round_trip_time),receive_power=VALUES(receive_power),raw_line=VALUES(raw_line),last_seen_at=NOW()');
        foreach ($parsed as $r) { $stmt->bind_param('issssssssssssssss', $id,$r['pon'],$r['onu_no'],$r['onu_id'],$r['name'],$r['mac'],$r['status'],$r['auth_state'],$r['register_time'],$r['last_deregister_time'],$r['last_deregister_reason'],$r['device_type'],$r['onu_type'],$r['round_trip_time'],$r['receive_power'],$r['raw_line']); $stmt->execute(); }
        $online = count(array_filter($parsed, fn($r) => strtolower($r['status']) === 'online'));
        $total = count($parsed); $offline = max(0, $total-$online); $pon = count(array_unique(array_map(fn($r) => $r['pon'], $parsed)));
        $up = $conn->prepare('UPDATE olts SET total_onu=?, online_onu=?, offline_onu=?, pon_ports=?, status="online", last_checked_at=NOW(), last_check_message=? WHERE id=?');
        $msg = 'ONU import OK: '.$online.'/'.$total.' online'; $up->bind_param('iiiisi',$total,$online,$offline,$pon,$msg,$id); $up->execute();
        $conn->commit(); log_admin_activity($conn,'olt_onu_import','Import ONU table OLT ID '.$id.' '.$online.'/'.$total.' online', intval($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success'=>true,'message'=>'Import ONU berhasil','count'=>$total,'online'=>$online,'offline'=>$offline,'pon_total'=>$pon,'data'=>$parsed]);
        break;
    case 'snmp_walk':
        $d = input_data(); $id = intval($d['id'] ?? 0); $baseOid = trim($d['oid'] ?? '1.3.6.1.2.1.1'); $limit = max(1, min(200, intval($d['limit'] ?? 50)));
        $stmt = $conn->prepare('SELECT id,name,host,snmp_community FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $walk = olt_snmp_walk_limited($olt['host'], $olt['snmp_community'] ?: 'public', $baseOid, $limit);
        if ($walk['success']) log_admin_activity($conn,'olt_snmp_walk','SNMP walk OLT ID '.$id.' OID '.$baseOid, intval($_SESSION['admin_id'] ?? 0));
        echo json_encode($walk);
        break;
    case 'snmp_basic':
        $d = input_data(); $id = intval($d['id'] ?? 0);
        $stmt = $conn->prepare('SELECT id,name,host,snmp_community FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $snmp = olt_snmp_basic($olt['host'], $olt['snmp_community'] ?: 'public');
        if ($snmp['success']) {
            $up = $conn->prepare('UPDATE olts SET sys_name=?, sys_descr=?, sys_uptime=?, last_snmp_at=NOW(), status="online", last_checked_at=NOW(), last_check_message=? WHERE id=?');
            $msg = 'SNMP OK';
            $up->bind_param('ssssi', $snmp['sys_name'], $snmp['sys_descr'], $snmp['sys_uptime'], $msg, $id); $up->execute();
            log_admin_activity($conn,'olt_snmp_basic','SNMP basic OLT ID '.$id.' OK', intval($_SESSION['admin_id'] ?? 0));
        }
        echo json_encode($snmp);
        break;
    case 'check_status':
        $d = input_data(); $id = intval($d['id'] ?? 0);
        $stmt = $conn->prepare('SELECT id,name,host,port,protocol,status FROM olts WHERE id=? LIMIT 1');
        $stmt->bind_param('i', $id); $stmt->execute(); $olt = $stmt->get_result()->fetch_assoc();
        if (!$olt) { echo json_encode(['success'=>false,'message'=>'OLT tidak ditemukan']); break; }
        $test = olt_connectivity_test($olt['host'], intval($olt['port']), $olt['protocol']);
        $ms = intval($test['response_ms']);
        $status = $test['status'];
        $message = $test['message'];
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

function parse_hsgq_onu_text(string $text): array {
    $rows = [];
    foreach (preg_split('/\r?\n/', $text) as $line) {
        $line = trim(preg_replace('/\s+/', ' ', $line));
        if ($line === '' || !preg_match('/^(\d+)\/(\d+)\s+(.+)$/', $line, $m)) continue;
        $onuId = $m[1].'/'.$m[2]; $rest = $m[3];
        if (!preg_match('/\b([0-9a-f]{2}(?::[0-9a-f]{2}){5})\b/i', $rest, $mm, PREG_OFFSET_CAPTURE)) continue;
        $mac = strtolower($mm[1][0]); $name = trim(substr($rest, 0, $mm[0][1])); $after = trim(substr($rest, $mm[0][1] + strlen($mm[0][0])));
        $status = preg_match('/\b(Online|Offline)\b/i', $after, $sm) ? ucfirst(strtolower($sm[1])) : '';
        $auth = preg_match('/\b(true|false)\b/i', $after, $am) ? strtolower($am[1]) : '';
        $rx = preg_match('/(-?inf|-?\d+(?:\.\d+)?)\s*dBm/i', $after, $rm) ? $rm[1].' dBm' : '';
        $reason = '';
        foreach (['Dying gasp','Laser out','LOS','LOSi','Not Down Before'] as $cand) if (stripos($after, $cand) !== false) { $reason = $cand; break; }
        $dev = preg_match('/\b(HGU|SFU|MDU|ONU)\b/i', $after, $dm) ? strtoupper($dm[1]) : '';
        $type = preg_match('/\b(\d+ge\d+fe|\d+ge|\d+fe|\d+ge\d+pots|\d+ge\d+fe\d+pots)\b/i', $after, $tm) ? strtolower($tm[1]) : '';
        $rtt = preg_match('/\b(\d{2,5})\b\s+'.preg_quote($rx, '/').'/i', $after, $rtm) ? $rtm[1] : '';
        preg_match_all('/\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}|Not Down Before/i', $after, $times);
        $reg = $times[0][0] ?? ''; $last = $times[0][1] ?? '';
        $rows[] = ['pon'=>$m[1], 'onu_no'=>$m[2], 'onu_id'=>$onuId, 'name'=>$name, 'mac'=>$mac, 'status'=>$status, 'auth_state'=>$auth, 'register_time'=>$reg, 'last_deregister_time'=>$last, 'last_deregister_reason'=>$reason, 'device_type'=>$dev, 'onu_type'=>$type, 'round_trip_time'=>$rtt, 'receive_power'=>$rx, 'raw_line'=>$line];
    }
    return $rows;
}

function olt_snmp_probe(string $host, string $community, string $group = 'fast'): array {
    $groups = [
        'fast' => [
            '1.3.6.1.2.1.1.1.0' => 'Standard sysDescr',
            '1.3.6.1.2.1.1.2.0' => 'Standard sysObjectID / enterprise hint',
            '1.3.6.1.2.1.1.3.0' => 'Standard sysUpTime',
            '1.3.6.1.2.1.1.5.0' => 'Standard sysName',
            '1.3.6.1.2.1.2.1.0' => 'Standard ifNumber / jumlah interface',
        ],
        'interface' => [
            '1.3.6.1.2.1.2.2.1.2.1' => 'ifDescr index 1',
            '1.3.6.1.2.1.2.2.1.2.2' => 'ifDescr index 2',
            '1.3.6.1.2.1.2.2.1.8.1' => 'ifOperStatus index 1',
            '1.3.6.1.2.1.2.2.1.8.2' => 'ifOperStatus index 2',
        ],
        'hsgq' => [
            '1.3.6.1.4.1.50224.3.1.1' => 'HSGQ enterprise sysObjectID root',
            '1.3.6.1.4.1.50224.3.1.1.0' => 'HSGQ enterprise root scalar candidate',
            '1.3.6.1.4.1.50224.3.1.2.1.1.1' => 'HSGQ candidate table 3.1.2',
            '1.3.6.1.4.1.50224.3.1.3.1.1.1' => 'HSGQ candidate table 3.1.3',
            '1.3.6.1.4.1.50224.3.1.4.1.1.1' => 'HSGQ candidate table 3.1.4',
            '1.3.6.1.4.1.50224.3.1.5.1.1.1' => 'HSGQ candidate table 3.1.5',
            '1.3.6.1.4.1.50224.3.1.10.1.1.1' => 'HSGQ ONU/Optic candidate 3.1.10',
            '1.3.6.1.4.1.34592.1.3.1.1.1.1' => 'VSOL/HSGQ candidate',
            '1.3.6.1.4.1.37950.1.1.5.1.1.1.1' => 'Old HSGQ/XPON candidate',
        ],
        'vendor' => [
            '1.3.6.1.4.1.3320.1.1.1.0' => 'BDCOM/EPON candidate',
            '1.3.6.1.4.1.3320.101.10.1.1.1.1' => 'BDCOM ONU candidate',
            '1.3.6.1.4.1.17409.2.3.1.1.1.1' => 'C-Data/EPON candidate',
            '1.3.6.1.4.1.5875.800.3.9.3.3.1.1.2.1' => 'Fiberhome candidate',
            '1.3.6.1.4.1.3902.1012.3.50.11.2.1.1.1' => 'ZTE GPON candidate',
            '1.3.6.1.4.1.2011.6.128.1.1.2.21.1.1.1' => 'Huawei GPON candidate',
        ],
    ];
    $candidates = $groups[$group] ?? $groups['fast'];
    $rows = [];
    try {
        foreach ($candidates as $oid => $label) {
            $value = raw_snmp_get($host, $community, $oid, 0.35);
            $rows[] = ['oid'=>$oid, 'label'=>$label, 'status'=>($value !== false && $value !== '') ? 'reply' : 'no_response', 'value'=>($value !== false ? (string)$value : '')];
        }
        $hits = array_values(array_filter($rows, fn($r) => $r['status'] === 'reply'));
        return ['success'=>true,'message'=>'SNMP probe selesai','group'=>$group,'count'=>count($rows),'hits'=>count($hits),'data'=>$rows];
    } catch (Throwable $e) {
        return ['success'=>true,'message'=>'SNMP probe selesai dengan error: '.$e->getMessage(),'group'=>$group,'count'=>count($rows),'hits'=>0,'data'=>$rows,'warning'=>$e->getMessage()];
    }
}

function olt_snmp_walk_limited(string $host, string $community, string $baseOid, int $limit = 50): array {
    $baseOid = preg_replace('/[^0-9.]/', '', $baseOid) ?: '1.3.6.1.2.1.1';
    $rows = [];
    if (function_exists('snmp2_real_walk')) {
        @snmp_set_quick_print(true);
        $data = @snmp2_real_walk($host, $community, $baseOid, 2000000, 1);
        if (is_array($data)) {
            foreach ($data as $oid => $value) { $rows[] = ['oid'=>(string)$oid, 'value'=>trim((string)$value)]; if (count($rows) >= $limit) break; }
        }
    }
    if (empty($rows) && function_exists('exec')) {
        $cmd = 'snmpwalk -v2c -c '.escapeshellarg($community).' -On '.escapeshellarg($host).' '.escapeshellarg($baseOid).' 2>&1';
        $out = []; $code = 1; @exec($cmd, $out, $code);
        foreach ($out as $line) {
            $badLine = stripos($line, 'Timeout') !== false
                || stripos($line, 'No Response') !== false
                || stripos($line, 'not recognized') !== false
                || stripos($line, 'operable program') !== false
                || stripos($line, 'batch file') !== false
                || stripos($line, 'not found') !== false;
            if ($badLine) continue;
            $parts = preg_split('/\s+=\s+/', $line, 2);
            $oidText = trim($parts[0] ?? '');
            if ($oidText === '' || !preg_match('/^(\.|iso|SNMP|[0-9])/', $oidText)) continue;
            $rows[] = ['oid'=>$oidText, 'value'=>$parts[1] ?? $line];
            if (count($rows) >= $limit) break;
        }
    }
    if (empty($rows)) {
        // Fallback native SNMP GETNEXT: bisa walk subtree terbatas tanpa php-snmp/snmpwalk.
        $rows = raw_snmp_walk_limited($host, $community, $baseOid, $limit, 0.7);
    }
    if (empty($rows)) {
        $rows = olt_native_known_oid_scan($host, $community, $baseOid, $limit);
    }
    if (empty($rows)) return ['success'=>false,'message'=>'SNMP walk belum menemukan data pada OID '.$baseOid.'. System OID sudah OK, tapi walk vendor penuh tetap paling akurat jika install Net-SNMP/PHP SNMP.'];
    return ['success'=>true,'message'=>'SNMP walk OK','oid'=>$baseOid,'count'=>count($rows),'data'=>$rows];
}

function olt_snmp_interfaces(string $host, string $community): array {
    $rows = [];
    for ($i=1; $i<=256; $i++) {
        $descr = raw_snmp_get($host, $community, '1.3.6.1.2.1.2.2.1.2.'.$i, 0.35);
        if ($descr === false || $descr === '') continue;
        $oper = raw_snmp_get($host, $community, '1.3.6.1.2.1.2.2.1.8.'.$i, 0.25);
        $admin = raw_snmp_get($host, $community, '1.3.6.1.2.1.2.2.1.7.'.$i, 0.25);
        $type = raw_snmp_get($host, $community, '1.3.6.1.2.1.2.2.1.3.'.$i, 0.25);
        $speed = raw_snmp_get($host, $community, '1.3.6.1.2.1.2.2.1.5.'.$i, 0.25);
        $name = trim((string)$descr);
        if (preg_match('/^1\.3\.6\.1\./', $name) || $name === '0') continue;
        $kind = preg_match('/^GE/i', $name) ? 'GE/Uplink' : (preg_match('/^PON|GPON|EPON|ONU\d+/i', $name) ? 'PON/ONU port' : (strpos($name, '@') !== false ? 'ONU/Customer logical' : 'Other'));
        $rows[] = ['index'=>$i,'name'=>$name,'kind'=>$kind,'admin_status'=>(string)$admin,'oper_status'=>(string)$oper,'type'=>(string)$type,'speed'=>(string)$speed,'online'=>((string)$oper === '1')];
    }
    $online = count(array_filter($rows, fn($r) => $r['online']));
    $customers = array_values(array_filter($rows, fn($r) => $r['kind'] === 'ONU/Customer logical'));
    $pons = array_values(array_filter($rows, fn($r) => $r['kind'] === 'PON/ONU port'));
    $ge = array_values(array_filter($rows, fn($r) => $r['kind'] === 'GE/Uplink'));
    return ['success'=>true,'message'=>'Interface monitor OK','count'=>count($rows),'online'=>$online,'offline'=>count($rows)-$online,'customer_total'=>count($customers),'customer_online'=>count(array_filter($customers, fn($r) => $r['online'])),'pon_total'=>count($pons),'ge_total'=>count($ge),'ge_online'=>count(array_filter($ge, fn($r) => $r['online'])),'data'=>$rows];
}

function olt_native_known_oid_scan(string $host, string $community, string $baseOid, int $limit = 80): array {
    $baseOid = rtrim($baseOid, '.');
    $known = [
        '1.3.6.1.2.1.1.1.0' => 'sysDescr', '1.3.6.1.2.1.1.2.0' => 'sysObjectID', '1.3.6.1.2.1.1.3.0' => 'sysUpTime', '1.3.6.1.2.1.1.4.0' => 'sysContact', '1.3.6.1.2.1.1.5.0' => 'sysName', '1.3.6.1.2.1.1.6.0' => 'sysLocation',
        '1.3.6.1.2.1.2.1.0' => 'ifNumber',
    ];
    for ($i=1; $i<=32; $i++) {
        $known['1.3.6.1.2.1.2.2.1.1.'.$i] = 'ifIndex '.$i;
        $known['1.3.6.1.2.1.2.2.1.2.'.$i] = 'ifDescr '.$i;
        $known['1.3.6.1.2.1.2.2.1.3.'.$i] = 'ifType '.$i;
        $known['1.3.6.1.2.1.2.2.1.5.'.$i] = 'ifSpeed '.$i;
        $known['1.3.6.1.2.1.2.2.1.7.'.$i] = 'ifAdminStatus '.$i;
        $known['1.3.6.1.2.1.2.2.1.8.'.$i] = 'ifOperStatus '.$i;
    }
    $vendorRoots = ['50224','3320','17409','5875','34592','37950','3902','2011','14988','45555','4413'];
    foreach ($vendorRoots as $root) {
        $known['1.3.6.1.4.1.'.$root] = 'enterprise root '.$root;
        $known['1.3.6.1.4.1.'.$root.'.1.1.1.0'] = 'vendor candidate '.$root;
        $known['1.3.6.1.4.1.'.$root.'.1.1.5.1.1.1.1'] = 'vendor candidate '.$root.' onu/pon';
    }
    $rows = [];
    foreach ($known as $oid => $label) {
        if (strpos($oid.'.', $baseOid.'.') !== 0 && $oid !== $baseOid) continue;
        $v = raw_snmp_get($host, $community, $oid, 0.45);
        if ($v !== false && $v !== '') $rows[] = ['oid'=>$oid.' ('.$label.')', 'value'=>(string)$v];
        if (count($rows) >= $limit) break;
    }
    return $rows;
}

function olt_snmp_basic(string $host, string $community = 'public'): array {
    $oids = [
        'sys_descr' => '1.3.6.1.2.1.1.1.0',
        'sys_uptime' => '1.3.6.1.2.1.1.3.0',
        'sys_name' => '1.3.6.1.2.1.1.5.0',
    ];
    $result = [];
    foreach ($oids as $key => $oid) {
        $value = false;
        if (function_exists('snmp2_get')) {
            @snmp_set_quick_print(true);
            $value = @snmp2_get($host, $community, $oid, 2000000, 1);
        }
        if (($value === false || $value === '') && function_exists('stream_socket_client')) {
            $raw = raw_snmp_get($host, $community, $oid);
            if ($raw !== false) $value = $raw;
        }
        if (($value === false || $value === '') && function_exists('exec')) {
            $cmd = 'snmpget -v2c -c '.escapeshellarg($community).' -Oqv '.escapeshellarg($host).' '.escapeshellarg($oid).' 2>&1';
            $out = []; $code = 1; @exec($cmd, $out, $code);
            if ($code === 0 && isset($out[0])) $value = implode(' ', $out);
        }
        if ($value === false || $value === '' || stripos((string)$value, 'Timeout') !== false || stripos((string)$value, 'No Response') !== false) {
            $methods = [];
            $methods[] = function_exists('snmp2_get') ? 'php-snmp:ada' : 'php-snmp:tidak ada';
            $methods[] = 'native-udp:dicoba';
            $methods[] = function_exists('exec') ? 'exec:ada' : 'exec:tidak ada';
            $methods[] = trim((string)$value) !== '' ? 'output='.substr(trim((string)$value), 0, 180) : 'output=kosong';
            if ($key === 'sys_name' && !empty($result)) {
                $result[$key] = '';
                $result['_warning'] = 'sysName tidak dibalas OLT. '.implode('; ', $methods);
                continue;
            }
            return ['success'=>false,'message'=>'SNMP gagal/timeout untuk OID '.$oid.'. '.implode('; ', $methods).'. Cek Read Community, UDP 161, ACL SNMP OLT, firewall, atau install Net-SNMP/PHP SNMP.'];
        }
        $result[$key] = trim(preg_replace('/^(STRING:|Timeticks:|OID:|INTEGER:)\s*/i', '', (string)$value), ' "');
    }
    $name = $result['sys_name'] ?? '';
    if ($name === '') $name = substr($result['sys_descr'] ?? 'OLT', 0, 80);
    return ['success'=>true,'message'=>isset($result['_warning']) ? ('SNMP basic OK, warning: '.$result['_warning']) : 'SNMP basic OK','sys_name'=>$name, 'sys_descr'=>$result['sys_descr'] ?? '', 'sys_uptime'=>$result['sys_uptime'] ?? ''];
}

function raw_snmp_get(string $host, string $community, string $oid, float $timeout = 2.0) {
    $res = raw_snmp_request($host, $community, $oid, "\xa0", $timeout);
    return $res ? $res['value'] : false;
}

function raw_snmp_getnext(string $host, string $community, string $oid, float $timeout = 1.0) {
    return raw_snmp_request($host, $community, $oid, "\xa1", $timeout);
}

function raw_snmp_walk_limited(string $host, string $community, string $baseOid, int $limit = 50, float $timeout = 0.7): array {
    $rows = []; $current = rtrim($baseOid, '.');
    for ($i = 0; $i < $limit; $i++) {
        $next = raw_snmp_getnext($host, $community, $current, $timeout);
        if (!$next || empty($next['oid'])) break;
        $oid = ltrim((string)$next['oid'], '.');
        if (strpos($oid.'.', $baseOid.'.') !== 0 && $oid !== $baseOid) break;
        $rows[] = ['oid'=>$oid, 'value'=>(string)($next['value'] ?? '')];
        $current = $oid;
    }
    return $rows;
}

function raw_snmp_request(string $host, string $community, string $oid, string $pduType, float $timeout = 2.0) {
    $reqId = random_int(1000, 999999);
    $varbind = ber_seq(ber_oid($oid)."\x05\x00");
    $pdu = $pduType.ber_len(strlen(ber_int($reqId).ber_int(0).ber_int(0).ber_seq($varbind))).ber_int($reqId).ber_int(0).ber_int(0).ber_seq($varbind);
    $packet = ber_seq(ber_int(1).ber_str($community).$pdu); // SNMP v2c
    $sock = @stream_socket_client('udp://'.$host.':161', $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
    if (!$sock) return false;
    $sec = (int) floor($timeout); $usec = (int) (($timeout - $sec) * 1000000);
    stream_set_timeout($sock, $sec, $usec);
    fwrite($sock, $packet);
    $resp = fread($sock, 8192);
    fclose($sock);
    if (!$resp) return false;
    return snmp_decode_first_varbind($resp);
}

function ber_len(int $len): string { if ($len < 128) return chr($len); $out=''; while($len>0){$out=chr($len&255).$out;$len>>=8;} return chr(128|strlen($out)).$out; }
function ber_seq(string $v): string { return "\x30".ber_len(strlen($v)).$v; }
function ber_str(string $v): string { return "\x04".ber_len(strlen($v)).$v; }
function ber_int(int $v): string { $out=''; do { $out=chr($v&255).$out; $v >>= 8; } while($v>0); if ((ord($out[0]) & 0x80) !== 0) $out="\x00".$out; return "\x02".ber_len(strlen($out)).$out; }
function ber_oid(string $oid): string { $p=array_map('intval', explode('.', $oid)); $out=chr(($p[0]*40)+$p[1]); for($i=2;$i<count($p);$i++){ $n=$p[$i]; $stack=[chr($n&0x7f)]; $n >>= 7; while($n>0){ array_unshift($stack, chr(($n&0x7f)|0x80)); $n >>= 7; } $out.=implode('', $stack); } return "\x06".ber_len(strlen($out)).$out; }
function ber_read_len(string $d, int &$i): int { $l=ord($d[$i++]); if($l<128) return $l; $n=$l&127; $l=0; for($x=0;$x<$n;$x++) $l=($l<<8)|ord($d[$i++]); return $l; }
function ber_decode_oid_value(string $v): string { $bytes = array_map('ord', str_split($v)); if (count($bytes) < 1) return ''; $first = array_shift($bytes); $parts = [intdiv($first, 40), $first % 40]; $n = 0; foreach ($bytes as $b) { $n = ($n << 7) | ($b & 0x7f); if (($b & 0x80) === 0) { $parts[] = $n; $n = 0; } } return implode('.', $parts); }
function snmp_decode_value_by_tag(int $tag, string $val) {
    if ($tag === 4) return trim($val);
    if ($tag === 6) return ber_decode_oid_value($val);
    if ($tag === 5 || in_array($tag, [128,129,130], true)) return '';
    if (in_array($tag, [2, 65, 66, 67, 70], true)) { $num = 0; for($k=0;$k<strlen($val);$k++) $num=($num<<8)|ord($val[$k]); return (string)$num; }
    return trim($val);
}
function snmp_decode_first_varbind(string $d) {
    $pos = 0;
    while (($pos = strpos($d, "\x06", $pos)) !== false) {
        $i = $pos + 1; $l = ber_read_len($d, $i); $oidRaw = substr($d, $i, $l); $afterOid = $i + $l;
        if ($afterOid < strlen($d)) {
            $tag = ord($d[$afterOid]); $j = $afterOid + 1; $vl = ber_read_len($d, $j); $val = substr($d, $j, $vl);
            if (in_array($tag, [2,4,5,6,65,66,67,70,128,129,130], true)) return ['oid'=>ber_decode_oid_value($oidRaw), 'value'=>snmp_decode_value_by_tag($tag, $val), 'tag'=>$tag];
        }
        $pos++;
    }
    return false;
}
function snmp_decode_first_value(string $d) {
    $res = snmp_decode_first_varbind($d);
    return $res ? $res['value'] : false;
}

function olt_connectivity_test(string $host, int $port, string $protocol = 'snmp'): array {
    $host = trim($host); $port = $port > 0 ? $port : (($protocol === 'snmp') ? 161 : 23);
    $start = microtime(true); $tcpOk = false; $tcpMsg = ''; $errno = 0; $errstr = '';

    if ($protocol !== 'snmp') {
        $fp = @fsockopen($host, $port, $errno, $errstr, 3.0);
        $tcpOk = (bool)$fp;
        if ($fp) fclose($fp);
        $tcpMsg = $tcpOk ? "TCP port $port reachable" : ('TCP gagal: '.($errstr ?: 'timeout'));
    } else {
        // SNMP memakai UDP/161, jadi TCP connect sering gagal. Untuk test awal, gunakan ICMP ping.
        $tcpMsg = 'SNMP memakai UDP/161; test memakai ICMP ping.';
    }

    $pingOk = null; $pingMsg = 'Ping tidak tersedia di server';
    if (function_exists('exec')) {
        $safeHost = escapeshellarg($host);
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $cmd = $isWindows ? "ping -n 1 -w 2000 $safeHost" : "ping -c 1 -W 2 $safeHost";
        $out = []; $code = 1; @exec($cmd, $out, $code);
        $pingOk = ($code === 0);
        $pingMsg = $pingOk ? 'Ping reply OK' : 'Ping gagal/timeout';
    }

    $ms = intval((microtime(true) - $start) * 1000);
    $online = ($pingOk === true) || $tcpOk;
    return [
        'success' => true,
        'online' => $online,
        'status' => $online ? 'online' : 'offline',
        'response_ms' => $ms,
        'message' => trim($pingMsg.'; '.$tcpMsg),
        'ping_ok' => $pingOk,
        'tcp_ok' => $tcpOk,
    ];
}
