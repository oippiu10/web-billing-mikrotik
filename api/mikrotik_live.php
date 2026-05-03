<?php
/**
 * Mikrotik Live Data API — dengan caching
 *
 * Query yang didukung (?cmd=...):
 *   ppp_active    — daftar PPPoE active connections
 *   ppp_secret    — daftar PPPoE secrets (user list)
 *   interface     — daftar interface + traffic
 *   resource      — CPU, RAM, uptime router
 *   log           — system log Mikrotik (TTL pendek)
 *   cache_status  — lihat status cache (debug)
 *   cache_clear   — hapus cache spesifik / semua
 *
 * Params: host, port, user, pass, cmd, ttl (opsional, default per cmd)
 */

session_start();

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

require_once __DIR__ . '/config.php';          // DB connection ($conn)
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';     // RouterosAPI class
require_once __DIR__ . '/mikrotik_cache.php';  // MikrotikCache class

// ─── Ambil parameter ────────────────────────────────────────────────────────
$router_id = intval($_GET['router_id'] ?? 0);
$cmd = trim($_GET['cmd'] ?? 'ppp_active');
$ttl = intval($_GET['ttl'] ?? 0); // 0 = gunakan default per cmd

// TTL default per command (detik) - Diperbesar untuk mencegah log spam login di Mikrotik
$defaultTtl = [
    'ppp_active' => 30, // 30 detik
    'ppp_secret' => 300, // 5 menit
    'ppp_profile' => 600, // 10 menit
    'interface' => 15,
    'resource' => 30,
    'license' => 86400,
    'log' => 30,
    'ip_address' => 600,
    'monitor_traffic' => 0,
];
if ($ttl <= 0 && !isset($_GET['ttl']))
    $ttl = $defaultTtl[$cmd] ?? 15;

// Command mapping ke Mikrotik API path
$cmdMap = [
    'ppp_active' => '/ppp/active/print',
    'ppp_secret' => '/ppp/secret/print',
    'ppp_profile' => '/ppp/profile/print',
    'interface' => '/interface/print',
    'resource' => '/system/resource/print',
    'license' => '/system/license/print',
    'log' => '/log/print',
    'ip_address' => '/ip/address/print',
    'identity' => '/system/identity/print',
    'dhcp_lease' => '/ip/dhcp-server/lease/print',
    'monitor_traffic' => '/interface/monitor-traffic',
    'summary' => 'summary', // Custom logic handle below
];

// ─── Cache status / clear (tidak perlu host) ────────────────────────────────
$cache = new MikrotikCache($conn);

if ($cmd === 'cache_status') {
    $daemonStatus = $cache->get("daemon_status_{$router_id}");
    echo json_encode([
        'success' => true,
        'router_id' => $router_id,
        'daemon_active' => ($daemonStatus !== null),
        'last_sync' => $daemonStatus['last_sync'] ?? null,
        'time' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($cmd === 'cache_clear') {
    $key = $_GET['key'] ?? '';
    if ($key) {
        $cache->invalidate($key);
        echo json_encode(['success' => true, 'message' => "Cache '$key' dihapus"]);
    } else {
        $cleaned = $cache->cleanup();
        echo json_encode(['success' => true, 'message' => "$cleaned cache expired dihapus"]);
    }
    exit;
}

// ─── Validasi ────────────────────────────────────────────────────────────────
if ($router_id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
    exit;
}

if (!isset($cmdMap[$cmd])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "Command '$cmd' tidak dikenal. Pilihan: " . implode(', ', array_keys($cmdMap))]);
    exit;
}

// ─── Ambil kredensial dari Database ──────────────────────────────────────────
$stmt = $conn->prepare("SELECT host, port, username, password FROM mikrotik_routers WHERE id = ?");
$stmt->bind_param("i", $router_id);
$stmt->execute();
$routerRes = $stmt->get_result();
if ($routerRes->num_rows === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Router tidak ditemukan di database']);
    exit;
}
$routerData = $routerRes->fetch_assoc();
$host = $routerData['host'];
$port = intval($routerData['port']) ?: 8728;
$user = $routerData['username'];
$pass = $routerData['password'];

// ─── Fetch dengan cache ──────────────────────────────────────────────────────
$cacheKey = "mt_{$router_id}_{$cmd}";

$lockName = "mt_conn_" . md5($host);
$conn->query("SELECT GET_LOCK('$lockName', 20)");

try {
    // 1. Cek apakah daemon aktif (toleransi 5 menit)
    $daemonStatus = $cache->getStale("daemon_status_{$router_id}");
    $isDaemonRecent = false;
    if ($daemonStatus) {
        $lastSync = strtotime($daemonStatus['last_sync'] ?? '2000-01-01');
        $isDaemonRecent = (time() - $lastSync) < 300; // Aktif dalam 5 menit terakhir
    }

    // 2. Jika daemon aktif/baru saja aktif, prioritaskan cache (meskipun stale/expired)
    // agar tidak membebani MikroTik dengan login/logout.
    $isRealtime = (isset($_GET['ttl']) && $_GET['ttl'] <= 2) || (isset($_GET['direct']) && $_GET['direct'] == 1);
    $forceDirect = isset($_GET['direct']) && $_GET['direct'] == 1;

    // Command yang boleh direct-connect meski daemon aktif (jarang diminta, tidak flood log)
    // identity: diminta hanya sekali per menit, daemon sudah cache di warm-up
    // license: sangat jarang, 1x per hari
    $allowDirectWhenDaemon = in_array($cmd, ['license']);

    if ($isDaemonRecent && !$forceDirect && !$allowDirectWhenDaemon) {
        $staleData = $cache->getStale($cacheKey);
        if ($staleData !== null) {
            echo json_encode([
                'success'    => true,
                'cmd'        => $cmd,
                'host'       => $host,
                'from_cache' => true,
                'via_daemon' => true,
                'is_stale'   => true,
                'realtime'   => $isRealtime,
                'time'       => date('Y-m-d H:i:s'),
                'data'       => $staleData
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Daemon aktif tapi cache belum ada (baru start / warm-up)
        // JANGAN konek langsung — kembalikan data kosong dengan flag initializing
        // agar tidak membanjiri log MikroTik selama daemon belum mengisi cache
        echo json_encode([
            'success'      => true,
            'cmd'          => $cmd,
            'host'         => $host,
            'from_cache'   => false,
            'via_daemon'   => true,
            'initializing' => true,
            'message'      => 'Daemon aktif, menunggu data pertama dari daemon...',
            'time'         => date('Y-m-d H:i:s'),
            'data'         => []
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }


    $result = $cache->getOrFetch($cacheKey, $ttl, function () use ($host, $port, $user, $pass, $cmdMap, $cmd) {
        $api = new RouterosAPI();
        $api->port = $port ?: 8728;
        $api->timeout = 5;

        if (!$api->connect($host, $user, $pass)) {
            throw new Exception("Gagal konek ke Mikrotik $host:$api->port");
        }

        if ($cmd === 'summary') {
            $identity = $api->comm('/system/identity/print');
            $resource = $api->comm('/system/resource/print');
            $interfaces = $api->comm('/interface/print');
            
            $topIf = null;
            $maxBytes = -1;
            if (is_array($interfaces)) {
                foreach ($interfaces as $if) {
                    $total = (int)($if['rx-byte'] ?? 0) + (int)($if['tx-byte'] ?? 0);
                    if ($total > $maxBytes) {
                        $maxBytes = $total;
                        $topIf = $if;
                    }
                }
            }

            // $api->disconnect(); // Moved logic to ensure all commands complete
            
            // Reconnect for monitor-traffic (if needed or just use current session if possible)
            // But summary already has a connected session.
            $ping = $api->comm('/ping', ['address' => '8.8.8.8', 'count' => '1']);
            $internetStatus = (isset($ping[0]['received']) && $ping[0]['received'] > 0) ? 'OK' : 'Error';

            $trafficData = null;
            if ($topIf) {
                $trafficData = $api->comm('/interface/monitor-traffic', [
                    'interface' => $topIf['name'],
                    'once'      => ''
                ]);
            }

            return [
                'identity' => $identity[0]['name'] ?? 'MikroTik',
                'resource' => $resource[0] ?? [],
                'internet' => $internetStatus,
                'top_interface' => $topIf ? [
                    'name' => $topIf['name'],
                    'rx'   => $topIf['rx-byte'] ?? 0,
                    'tx'   => $topIf['tx-byte'] ?? 0,
                    'bps_rx' => $trafficData[0]['rx-bits-per-second'] ?? 0,
                    'bps_tx' => $trafficData[0]['tx-bits-per-second'] ?? 0
                ] : null
            ];
        }

        $params = [];
        if ($cmd === 'monitor_traffic') {
            $params = [
                'interface' => $_GET['interface'] ?? 'ether1',
                'once' => ''
            ];
        }

        $data = $api->comm($cmdMap[$cmd], $params);

        // --- DATA MERGING: Khusus untuk ppp_active agar throughput tidak 0 ---
        if ($cmd === 'ppp_active' && !empty($data)) {
            $interfaces = $api->comm('/interface/print');
            if (!empty($interfaces)) {
                $ifMap = [];
                foreach ($interfaces as $if) {
                    $ifMap[trim($if['name'] ?? '')] = [
                        'rx' => $if['rx-byte'] ?? 0,
                        'tx' => $if['tx-byte'] ?? 0
                    ];
                }
                foreach ($data as &$s) {
                    $uname = trim($s['name'] ?? '');
                    $possibleNames = [$uname, "<pppoe-$uname>", "pppoe-$uname"];
                    foreach ($possibleNames as $pif) {
                        if (isset($ifMap[$pif])) {
                            $s['bytes-in'] = $ifMap[$pif]['rx'];
                            $s['bytes-out'] = $ifMap[$pif]['tx'];
                            break;
                        }
                    }
                }
            }
        }

        $api->disconnect();
        return $data;
    }, $forceDirect); // Kirim flag forceDirect ke getOrFetch jika library mendukungnya (saya cek mikrotik_cache.php nanti)

    echo json_encode([
        'success' => true,
        'cmd' => $cmd,
        'host' => $host,
        'from_cache' => $result['from_cache'],
        'stale' => $result['stale'] ?? false,
        'via_daemon' => false,
        'ttl_sec' => $ttl,
        'cache_key' => $cacheKey,
        'count' => count($result['data'] ?? []),
        'data' => $result['data'],
        'time' => date('Y-m-d H:i:s'),
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    $isConnError = (strpos($e->getMessage(), 'Gagal konek') !== false || strpos($e->getMessage(), 'timeout') !== false);
    http_response_code($isConnError ? 503 : 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'type'    => $isConnError ? 'connection_error' : 'internal_error',
        'cmd'     => $cmd,
        'host'    => $host,
    ]);
}
 finally {
    $conn->query("SELECT RELEASE_LOCK('$lockName')");
}
?>