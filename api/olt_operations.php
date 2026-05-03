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
ensure_column($conn, 'olts', 'sys_name', 'VARCHAR(190) NULL');
ensure_column($conn, 'olts', 'sys_descr', 'TEXT NULL');
ensure_column($conn, 'olts', 'sys_uptime', 'VARCHAR(190) NULL');
ensure_column($conn, 'olts', 'last_snmp_at', 'DATETIME NULL');
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
            $methods[] = function_exists('exec') ? 'exec:ada' : 'exec:tidak ada';
            $methods[] = trim((string)$value) !== '' ? 'output='.substr(trim((string)$value), 0, 180) : 'output=kosong';
            return ['success'=>false,'message'=>'SNMP gagal/timeout untuk OID '.$oid.'. '.implode('; ', $methods).'. Cek Read Community, UDP 161, ACL SNMP OLT, firewall, atau install Net-SNMP/PHP SNMP.'];
        }
        $result[$key] = trim(preg_replace('/^(STRING:|Timeticks:|OID:|INTEGER:)\s*/i', '', (string)$value), ' "');
    }
    return ['success'=>true,'message'=>'SNMP basic OK','sys_name'=>$result['sys_name'] ?? '', 'sys_descr'=>$result['sys_descr'] ?? '', 'sys_uptime'=>$result['sys_uptime'] ?? ''];
}

function raw_snmp_get(string $host, string $community, string $oid) {
    $reqId = random_int(1000, 999999);
    $varbind = ber_seq(ber_oid($oid)."\x05\x00");
    $pdu = "\xa0".ber_len(strlen(ber_int($reqId).ber_int(0).ber_int(0).ber_seq($varbind))).ber_int($reqId).ber_int(0).ber_int(0).ber_seq($varbind);
    $packet = ber_seq(ber_int(1).ber_str($community).$pdu); // SNMP v2c
    $sock = @stream_socket_client('udp://'.$host.':161', $errno, $errstr, 2, STREAM_CLIENT_CONNECT);
    if (!$sock) return false;
    stream_set_timeout($sock, 2);
    fwrite($sock, $packet);
    $resp = fread($sock, 8192);
    fclose($sock);
    if (!$resp) return false;
    return snmp_decode_first_value($resp);
}

function ber_len(int $len): string { if ($len < 128) return chr($len); $out=''; while($len>0){$out=chr($len&255).$out;$len>>=8;} return chr(128|strlen($out)).$out; }
function ber_seq(string $v): string { return "\x30".ber_len(strlen($v)).$v; }
function ber_str(string $v): string { return "\x04".ber_len(strlen($v)).$v; }
function ber_int(int $v): string { $out=''; do { $out=chr($v&255).$out; $v >>= 8; } while($v>0); if ((ord($out[0]) & 0x80) !== 0) $out="\x00".$out; return "\x02".ber_len(strlen($out)).$out; }
function ber_oid(string $oid): string { $p=array_map('intval', explode('.', $oid)); $out=chr(($p[0]*40)+$p[1]); for($i=2;$i<count($p);$i++){ $n=$p[$i]; $stack=[chr($n&0x7f)]; $n >>= 7; while($n>0){ array_unshift($stack, chr(($n&0x7f)|0x80)); $n >>= 7; } $out.=implode('', $stack); } return "\x06".ber_len(strlen($out)).$out; }
function ber_read_len(string $d, int &$i): int { $l=ord($d[$i++]); if($l<128) return $l; $n=$l&127; $l=0; for($x=0;$x<$n;$x++) $l=($l<<8)|ord($d[$i++]); return $l; }
function snmp_decode_first_value(string $d) {
    $needle = "\x06";
    $pos = 0;
    while (($pos = strpos($d, $needle, $pos)) !== false) {
        $i = $pos + 1; $l = ber_read_len($d, $i); $afterOid = $i + $l;
        if ($afterOid < strlen($d)) {
            $tag = ord($d[$afterOid]); $j = $afterOid + 1; $vl = ber_read_len($d, $j); $val = substr($d, $j, $vl);
            if (in_array($tag, [4, 6, 67, 2], true)) {
                if ($tag === 4 || $tag === 6) return trim($val);
                $num = 0; for($k=0;$k<strlen($val);$k++) $num=($num<<8)|ord($val[$k]); return (string)$num;
            }
        }
        $pos++;
    }
    return false;
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
