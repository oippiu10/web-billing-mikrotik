<?php
/**
 * Get All Users Paginated — Web Admin Panel
 * Membaca dari tabel users MySQL, digabung dengan data Mikrotik live.
 */
ob_start(); // Mencegah output tidak sengaja merusak JSON
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

// Clean output buffer if something was echoed in includes
while (ob_get_level() > 1)
    ob_end_clean();

file_put_contents(__DIR__ . '/api_debug.log', "[" . date('Y-m-d H:i:s') . "] API Called: " . ($_SERVER['REQUEST_URI'] ?? 'CLI') . "\n", FILE_APPEND);

$page = max(1, intval($_GET['page'] ?? 1));
$perPage = max(1, intval($_GET['per_page'] ?? 20));
$search = trim($_GET['search'] ?? '');
$profile = trim($_GET['profile'] ?? '');
$odp = trim($_GET['odp'] ?? '');
$statusFilter = trim($_GET['status'] ?? ''); // 'active'/'disabled'/''

// Sorting logic
$validSorts = ['id', 'username', 'tanggal_dibuat', 'redaman', 'wa', 'tanggal_tagihan', 'profile', 'odp_id', 'status'];
$sortBy = isset($_GET['sort_by']) && in_array(strtolower($_GET['sort_by']), $validSorts) ? strtolower($_GET['sort_by']) : 'username';
$sortOrder = isset($_GET['sort_order']) && strtolower($_GET['sort_order']) === 'desc' ? 'DESC' : 'ASC';

// --- Mikrotik Fetch ---
$mtSecrets = [];
$mtActive = [];
$mtProfiles = [];
$routerHost = trim($_GET['router_host'] ?? '');
$routerId = trim($_GET['router_id'] ?? '');

if (empty($routerId)) {
    echo json_encode([
        'success' => false,
        'message' => 'Parameter router_id wajib untuk memisahkan data antar router.'
    ]);
    exit;
}

if ($routerHost === '' && $routerId !== '') {
    $routerInternalId = $routerId;
    $stmtP = $conn->prepare("SELECT id, host, username, password, port, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtP->bind_param("ss", $routerId, $routerId);
    $stmtP->execute();
    $resP = $stmtP->get_result();
    if ($rowP = $resP->fetch_assoc()) {
        $routerHost = $rowP['host'];
        $routerUser = $rowP['username'];
        $routerPass = $rowP['password'];
        $routerPort = $rowP['port'] ?: (intval($_GET['router_port'] ?? 8728));
        $routerInternalId = $rowP['id'];
        
        // Jika input routerId adalah numeric ID, ganti dengan software_id agar filter ke tabel users akurat
        if (!empty($rowP['software_id'])) {
            $routerId = $rowP['software_id'];
        }
    }
    $stmtP->close();
}

if ($routerHost !== '') {
    $routerPort = isset($routerPort) ? $routerPort : intval($_GET['router_port'] ?? 8728);
    $routerUser = isset($routerUser) ? $routerUser : trim($_GET['router_user'] ?? 'admin');
    $routerPass = isset($routerPass) ? $routerPass : trim($_GET['router_pass'] ?? '');

    if ($routerPass === '') {
        $stmtP = $conn->prepare("SELECT username, password, port FROM mikrotik_routers WHERE host = ? LIMIT 1");
        $stmtP->bind_param("s", $routerHost);
        $stmtP->execute();
        $resP = $stmtP->get_result();
        if ($rowP = $resP->fetch_assoc()) {
            $routerUser = $rowP['username'];
            $routerPass = $rowP['password'];
            $routerPort = $rowP['port'] ?: $routerPort;
        }
        $stmtP->close();
    }

    $cache = new MikrotikCache($conn);

    // 1. Cek apakah daemon aktif
    $isDaemonActive = false;
    if ($routerInternalId) {
        $daemonStatus = $cache->get("daemon_status_{$routerInternalId}");
        $isDaemonActive = ($daemonStatus !== null);
    }

    $sharedApi = null;
    $apiCall = function ($cmd) use (&$sharedApi, $routerHost, $routerPort, $routerUser, $routerPass) {
        if ($sharedApi === null) {
            $sharedApi = new RouterosAPI();
            $sharedApi->port = $routerPort;
            $sharedApi->timeout = 5;
            if (!$sharedApi->connect($routerHost, $routerUser, $routerPass)) {
                $sharedApi = false;
                throw new Exception("Koneksi gagal ke Mikrotik ($routerHost). Periksa alat/konfigurasi.");
            }
        }
        if ($sharedApi) {
            return $sharedApi->comm($cmd);
        }
        return [];
    };

    // 1. Cek apakah daemon aktif dalam 5 menit terakhir (toleransi stale/expired cache)
    $daemonStatus = $cache->getStale("daemon_status_{$routerInternalId}");
    $isDaemonRecent = false;
    if ($daemonStatus) {
        $lastSync = strtotime($daemonStatus['last_sync'] ?? '2000-01-01');
        $isDaemonRecent = (time() - $lastSync) < 300;
    }

    $fetchWithDaemon = function ($key, $ttl, $cmd) use ($cache, $isDaemonRecent, $apiCall) {
        if ($isDaemonRecent) {
            // Daemon aktif — selalu pakai cache (stale sekalipun), JANGAN konek langsung
            $stale = $cache->getStale($key);
            if ($stale !== null) {
                return ['data' => $stale, 'from_cache' => true, 'stale' => true];
            }
            // Cache belum ada (daemon baru start) → return kosong, jangan konek
            return ['data' => [], 'from_cache' => false, 'via_daemon' => true, 'initializing' => true];
        }
        return $cache->getOrFetch($key, $ttl, function () use ($apiCall, $cmd) {
            return $apiCall($cmd);
        });
    };

    $sRes = $fetchWithDaemon("mt_{$routerInternalId}_ppp_secret", 300, '/ppp/secret/print');
    $aRes = $fetchWithDaemon("mt_{$routerInternalId}_ppp_active", 30, '/ppp/active/print');
    $pRes = $fetchWithDaemon("mt_{$routerInternalId}_ppp_profile", 600, '/ppp/profile/print');

    if ($sharedApi instanceof RouterosAPI) {
        $sharedApi->disconnect();
    }

    $mtSecrets = is_array($sRes['data'] ?? null) ? $sRes['data'] : [];
    $mtActive = is_array($aRes['data'] ?? null) ? $aRes['data'] : [];
    $mtProfiles = is_array($pRes['data'] ?? null) ? $pRes['data'] : [];
}

$secretMap = [];
$totalDisabled = 0;
foreach ($mtSecrets as $sec) {
    $secretMap[$sec['name']] = $sec;
    if (($sec['disabled'] ?? 'false') === 'true') {
        $totalDisabled++;
    }
}
$activeMap = [];
foreach ($mtActive as $act) {
    if (isset($act['name']))
        $activeMap[$act['name']] = $act;
}
$profileMap = [];
foreach ($mtProfiles as $prof) {
    if (isset($prof['name']))
        $profileMap[$prof['name']] = $prof;
}
$totalActive = count($activeMap);

// --- Fetch all matching DB users ---
try {
    $where = [];
    $params = [];
    $types = '';

    if ($routerId !== '') {
        $where[] = 'u.router_id = ?';
        $params[] = $routerId;
        $types .= 's';
    }

    if ($search !== '') {
        $where[] = '(u.username LIKE ? OR u.profile LIKE ? OR u.wa LIKE ? OR u.alamat LIKE ?)';
        $like = "%$search%";
        $params = array_merge($params, [$like, $like, $like, $like]);
        $types .= 'ssss';
    }

    // Soft Filtering: Only show users currently marked as on router
    // (DINONAKTIFKAN agar data lama tetap muncul)
    // $where[] = 'u.on_router = 1';
    if ($profile !== '') {
        $where[] = 'u.profile = ?';
        $params[] = $profile;
        $types .= 's';
    }
    if ($odp !== '') {
        $where[] = 'u.odp_id = ?';
        $params[] = $odp;
        $types .= 's';
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sqlSortBy = ($sortBy === 'status') ? 'username' : $sortBy;
    $dataSQL = "SELECT
                    u.id, u.username, u.password, u.profile, u.wa, u.maps, u.lat, u.lng, u.foto,
                    DATE_FORMAT(u.tanggal_dibuat, '%Y-%m-%d %H:%i:%s') as tanggal_dibuat, u.odp_id, u.created_at, u.updated_at, u.alamat, u.redaman, u.tanggal_tagihan,
                    o.name as odp_name
                 FROM users u
                 LEFT JOIN odp o ON u.odp_id = o.id
                 $whereSQL
                 ORDER BY u.$sqlSortBy $sortOrder";

    $dataStmt = $conn->prepare($dataSQL);
    if ($types) {
        $dataStmt->bind_param($types, ...$params);
    }
    $dataStmt->execute();
    $result = $dataStmt->get_result();

    $allFilteredUsers = [];
    $dbTotal = 0;
    while ($row = $result->fetch_assoc()) {
        $dbTotal++;
        $uname = $row['username'];
        $row['remote-address'] = '-';
        $row['rate-limit'] = '-';
        $row['disabled'] = 'no';
        $row['status'] = 'offline';

        if (isset($secretMap[$uname])) {
            $sec = $secretMap[$uname];
            $row['remote-address'] = $sec['remote-address'] ?? '-';
            $row['disabled'] = (($sec['disabled'] ?? 'false') === 'true') ? 'yes' : 'no';

            $pname = $sec['profile'] ?? '';
            if (isset($profileMap[$pname]) && !empty($profileMap[$pname]['rate-limit'])) {
                $row['rate-limit'] = $profileMap[$pname]['rate-limit'];
            }
        }

        $isOnline = isset($activeMap[$uname]);
        if ($isOnline) {
            $row['remote-address'] = $activeMap[$uname]['address'] ?? $row['remote-address'];
            $row['status'] = 'online';
        }

        // Check filtering
        $passStatusFilter = true;
        if ($statusFilter === 'active' || $statusFilter === 'online') {
            if (!$isOnline) $passStatusFilter = false;
        } elseif ($statusFilter === 'offline') {
            if ($isOnline) $passStatusFilter = false;
        } elseif ($statusFilter === 'disabled' && $row['disabled'] !== 'yes') {
            $passStatusFilter = false;
        }

        if ($passStatusFilter) {
            $allFilteredUsers[] = $row;
        }
    }
    $dataStmt->close();

    // PHP Sorting for 'status'
    if ($sortBy === 'status') {
        usort($allFilteredUsers, function($a, $b) use ($sortOrder) {
            $valA = $a['status'] ?? 'offline';
            $valB = $b['status'] ?? 'offline';
            if ($valA === $valB) return 0;
            if ($sortOrder === 'ASC') {
                return ($valA === 'online') ? -1 : 1;
            } else {
                return ($valA === 'online') ? 1 : -1;
            }
        });
    }

    // Limit / Offset
    $totalFiltered = count($allFilteredUsers);
    $offset = ($page - 1) * $perPage;
    $paginatedUsers = array_slice($allFilteredUsers, $offset, $perPage);

    // Profile list
    $profiles = array_values(array_unique(array_map(function ($p) {
        return $p['name'] ?? 'Unknown';
    }, $mtProfiles)));
    if (empty($profiles)) {
        // fallback/merge with DB profiles for this router
        $stmtPDB = $conn->prepare("SELECT profile_name FROM ppp_profile_pricing WHERE router_id = ? AND is_active = 1 ORDER BY profile_name");
        $stmtPDB->bind_param("s", $routerId);
        $stmtPDB->execute();
        $profileRes = $stmtPDB->get_result();
        while ($pr = $profileRes->fetch_assoc()) {
            if (!in_array($pr['profile_name'], $profiles)) {
                $profiles[] = $pr['profile_name'];
            }
        }
        $stmtPDB->close();
    }

    // Final fallback: if still empty, get unique profiles from existing users table
    if (empty($profiles)) {
        $stmtUDB = $conn->prepare("SELECT DISTINCT profile FROM users WHERE router_id = ? AND profile IS NOT NULL AND profile != '' AND profile != 'Pilih Profile' AND profile != 'Pilih Paket...' ORDER BY profile");
        $stmtUDB->bind_param("s", $routerId);
        if ($stmtUDB->execute()) {
            $resUDB = $stmtUDB->get_result();
            while ($ru = $resUDB->fetch_assoc()) {
                $profiles[] = $ru['profile'];
            }
        }
        $stmtUDB->close();
    }

    // ODP List from dedicated table
    $odps = [];
    $stmtO = $conn->prepare("SELECT id, name FROM odp WHERE router_id = ? ORDER BY name ASC");
    $stmtO->bind_param("s", $routerId);
    $stmtO->execute();
    $odpRes = $stmtO->get_result();
    while ($or = $odpRes->fetch_assoc())
        $odps[] = $or;
    $stmtO->close();

    // Complete data count
    $stmtC = $conn->prepare("
        SELECT COUNT(*) as complete
        FROM users
        WHERE router_id = ?
          AND wa IS NOT NULL AND wa != ''
          AND alamat IS NOT NULL AND alamat != ''
          AND redaman IS NOT NULL AND redaman != ''
          AND odp_id IS NOT NULL
          AND tanggal_tagihan IS NOT NULL
    ");
    $stmtC->bind_param("s", $routerId);
    $stmtC->execute();
    $completeRes = $stmtC->get_result();
    $totalComplete = ($completeRes ? $completeRes->fetch_assoc()['complete'] : 0) ?? 0;
    $stmtC->close();

    // Unpaid count
    $bulan = date('Y-m');
    $stmtU = $conn->prepare("
        SELECT COUNT(DISTINCT u.username) as unpaid
        FROM users u
        LEFT JOIN payments p ON p.user_id = u.id
            AND DATE_FORMAT(p.payment_date, '%Y-%m') = ?
        WHERE p.id IS NULL AND u.router_id = ?
    ");
    $stmtU->bind_param("ss", $bulan, $routerId);
    $stmtU->execute();
    $unpaidRes = $stmtU->get_result();
    $unpaid = ($unpaidRes ? $unpaidRes->fetch_assoc()['unpaid'] : 0) ?? 0;
    $stmtU->close();

    $output = json_encode([
        'success' => true,
        'data' => $paginatedUsers,
        'total' => $totalFiltered,
        'total_complete' => (int) $totalComplete,
        'page' => $page,
        'per_page' => $perPage,
        'profiles' => $profiles,
        'odps' => $odps,
        'unpaid' => (int) $unpaid,
        'active' => $totalActive,
        'disabled' => $totalDisabled,
        'total_all' => $dbTotal,
        'total_secrets' => count($mtSecrets),
    ], JSON_UNESCAPED_UNICODE);

    // Final clean
    while (ob_get_level() > 0)
        ob_end_clean();
    echo $output;
    exit;
} catch (Exception $e) {
    while (ob_get_level() > 0)
        ob_end_clean();
    
    // Gunakan 503 (Service Unavailable) alih-alih 500 agar frontend tidak redirect
    // terutama jika error berasal dari koneksi MikroTik yang intermiten.
    $isConnError = (strpos($e->getMessage(), 'Koneksi gagal') !== false || strpos($e->getMessage(), 'timeout') !== false);
    http_response_code($isConnError ? 503 : 500);
    
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage(),
        'type' => $isConnError ? 'connection_error' : 'internal_error'
    ]);
}
?>