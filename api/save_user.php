<?php
/**
 * Save User — Tambah/Edit/Enable/Disable user PPPoE
 * Operasi dilakukan via Mikrotik API dan disinkronisasi ke database
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh mengubah pelanggan.');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Data tidak valid']);
    exit;
}

$action = $input['action'] ?? 'add';
$username = trim($input['username'] ?? '');

if (!$username) {
    echo json_encode(['success' => false, 'message' => 'Username wajib diisi']);
    exit;
}

// Ambil konfigurasi router dari localStorage-equivalent: gunakan router pertama dari DB
// atau bisa juga dari POST body jika dikirim
$routerHost = $input['router_host'] ?? null;
$routerPort = intval($input['router_port'] ?? 8728);
$routerUser = $input['router_user'] ?? 'admin';
$routerPass = $input['router_pass'] ?? '';

if ($routerHost !== null && $routerHost !== '' && $routerPass === '') {
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

// Default: selalu sinkron ke MikroTik menggunakan kredensial router dari DB.
$syncMikrotik = false;

// Resolve software_id jika router_id yang dikirim adalah numeric ID
$routerId = $input['router_id'] ?? '';
$routerInternalId = null;
if (!empty($routerId)) {
    $stmtR = $conn->prepare("SELECT id, host, username, password, port, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtR->bind_param("ss", $routerId, $routerId);
    $stmtR->execute();
    $resR = $stmtR->get_result();
    if ($rowR = $resR->fetch_assoc()) {
        $routerInternalId = $rowR['id'];
        if (!empty($rowR['software_id'])) {
            $routerId = $rowR['software_id'];
        }
        if ($routerHost === null || $routerHost === '') {
            $routerHost = $rowR['host'];
            $routerUser = $rowR['username'];
            $routerPass = $rowR['password'];
            $routerPort = intval($rowR['port']) ?: $routerPort;
        }
    }
    $stmtR->close();
}

$syncMikrotik = ($routerHost !== null && $routerHost !== '' && $routerPass !== '');

try {
    // ── HANDLE ENABLE/DISABLE ──
    if ($action === 'enable' || $action === 'disable') {
        $disabled = ($action === 'disable') ? 'yes' : 'no';

        if (empty($routerId)) {
            echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
            exit;
        }

        // Update DB
        $stmt = $conn->prepare("UPDATE users SET disabled = ?, updated_at = NOW() WHERE username = ? AND router_id = ?");
        $stmt->bind_param('sss', $disabled, $username, $routerId);
        $stmt->execute();
        $stmt->close();

        // Sync ke Mikrotik jika ada konfigurasi router
        if ($syncMikrotik) {
            $api = new RouterosAPI();
            $api->port = $routerPort;
            if ($api->connect($routerHost, $routerUser, $routerPass)) {
                // Cari .id user PPPoE
                $secrets = $api->comm('/ppp/secret/print', ['?name' => $username]);
                if (!empty($secrets[0]['.id'])) {
                    $id = $secrets[0]['.id'];
                    if ($action === 'disable') {
                        $api->comm('/ppp/secret/disable', ['numbers' => $id]);
                    } else {
                        $api->comm('/ppp/secret/enable', ['numbers' => $id]);
                    }
                }
                $api->disconnect();
                // Invalidasi cache PPP Secret sesuai key yang dipakai get_all_users_paginated.php
                $cacheKeyRouter = $routerInternalId ?: "{$routerHost}_{$routerPort}";
                (new MikrotikCache($conn))->invalidate("mt_{$cacheKeyRouter}_ppp_secret");
            }
        }

        log_admin_activity($conn, 'customer_status', "User {$username} berhasil " . ($action === 'disable' ? 'dinonaktifkan' : 'diaktifkan'), (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => "User $username berhasil " . ($action === 'disable' ? 'dinonaktifkan' : 'diaktifkan')]);
        exit;
    }

    // ── HANDLE EDIT DATA TAMBAHAN SAJA ──
    // Dipakai dari halaman Pelanggan agar tidak mengubah PPP secret/MikroTik
    // seperti username, password, profile, disabled, remote-address, atau rate-limit.
    if ($action === 'edit_extra') {
        if (empty($routerId)) {
            echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
            exit;
        }

        $wa = $input['wa'] ?? '';
        $alamat = $input['alamat'] ?? '';
        $maps = $input['maps'] ?? '';
        $redaman = $input['redaman'] ?? '';
        $odpId = $input['odp_id'] ?? null;
        if ($odpId === '' || $odpId === 'none' || $odpId === 0 || $odpId === '0') {
            $odpId = null;
        } else {
            $odpId = intval($odpId);
        }
        $tanggalTagihan = intval($input['tanggal_tagihan'] ?? 0) ?: null;
        $tanggalDibuat = $input['tanggal_dibuat'] ?? null;
        $lat = ($input['lat'] ?? '') !== '' && $input['lat'] !== null ? floatval($input['lat']) : null;
        $lng = ($input['lng'] ?? '') !== '' && $input['lng'] !== null ? floatval($input['lng']) : null;

        $stmt = $conn->prepare("UPDATE users SET wa=?, alamat=?, maps=?, redaman=?, odp_id=?, tanggal_tagihan=?, tanggal_dibuat=?, lat=?, lng=?, updated_at=NOW() WHERE username=? AND router_id=?");
        if (!$stmt) throw new Exception($conn->error);
        $stmt->bind_param('ssssiisddss', $wa, $alamat, $maps, $redaman, $odpId, $tanggalTagihan, $tanggalDibuat, $lat, $lng, $username, $routerId);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        log_admin_activity($conn, 'customer_extra_update', "Data tambahan user {$username} berhasil diperbarui", (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => true, 'message' => 'Data tambahan pelanggan berhasil diperbarui', 'affected' => $affected]);
        exit;
    }

    // ── HANDLE ADD / EDIT ──
    $password = trim((string)($input['password'] ?? ''));
    $profile = trim((string)($input['profile'] ?? 'default')) ?: 'default';
    $remoteAddr = trim((string)($input['remote-address'] ?? ''));
    $disabled = ($input['disabled'] ?? 'no') === 'yes' ? 'yes' : 'no';
    $wa = $input['wa'] ?? '';
    $alamat = $input['alamat'] ?? '';
    $maps = $input['maps'] ?? '';
    $redaman = $input['redaman'] ?? '';
    $odpId = $input['odp_id'] ?? null;
    if ($odpId === '' || $odpId === 'none' || $odpId === 0 || $odpId === '0') {
        $odpId = null;
    } else {
        $odpId = intval($odpId);
    }
    $tanggalTagihan = intval($input['tanggal_tagihan'] ?? 0);
    $tanggalDibuat = $input['tanggal_dibuat'] ?? date('Y-m-d H:i:s');
    $lat = !empty($input['lat']) ? floatval($input['lat']) : null;
    $lng = !empty($input['lng']) ? floatval($input['lng']) : null;

    if ($action === 'add') {
        if (!$password || !$profile) {
            echo json_encode(['success' => false, 'message' => 'Password dan profile wajib diisi']);
            exit;
        }
        if (empty($routerId)) {
            echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
            exit;
        }
        // Cek sudah ada?
        $chk = $conn->prepare("SELECT id FROM users WHERE username = ? AND router_id = ?");
        $chk->bind_param('ss', $username, $routerId);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => "Username '$username' sudah ada"]);
            exit;
        }
        $chk->close();

        $stmt = $conn->prepare("INSERT INTO users (router_id, username, password, profile, wa, alamat, maps, redaman, odp_id, tanggal_tagihan, tanggal_dibuat, on_router, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)");
        $stmt->bind_param('ssssssssiisdd', $routerId, $username, $password, $profile, $wa, $alamat, $maps, $redaman, $odpId, $tanggalTagihan, $tanggalDibuat, $lat, $lng);
        $stmt->execute();
        $stmt->close();

    } else {
        // EDIT — update field yang dikirim
        $sets = ['profile=?', 'updated_at=NOW()'];
        $vals = [$profile];
        $types = 's';
        
        if ($password) {
            $sets[] = 'password=?';
            $vals[] = $password;
            $types .= 's';
        }
        
        // Selalu update field informasi jika ada di input
        $sets[] = 'wa=?'; $vals[] = $wa; $types .= 's';
        $sets[] = 'alamat=?'; $vals[] = $alamat; $types .= 's';
        $sets[] = 'maps=?'; $vals[] = $maps; $types .= 's';
        $sets[] = 'redaman=?'; $vals[] = $redaman; $types .= 's';
        $sets[] = 'odp_id=?'; $vals[] = $odpId; $types .= 'i';
        $sets[] = 'tanggal_tagihan=?'; $vals[] = $tanggalTagihan; $types .= 'i';
        $sets[] = 'lat=?'; $vals[] = $lat; $types .= 'd';
        $sets[] = 'lng=?'; $vals[] = $lng; $types .= 'd';
        
        if ($tanggalDibuat) {
            $sets[] = 'tanggal_dibuat=?';
            $vals[] = $tanggalDibuat;
            $types .= 's';
        }

        if (empty($routerId)) {
            echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
            exit;
        }
        
        $vals[] = $username;
        $vals[] = $routerId;
        $types .= 'ss';
        
        $sql = "UPDATE users SET " . implode(',', $sets) . " WHERE username = ? AND router_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$vals);
        $stmt->execute();
        $stmt->close();
    }

    // Sync ke Mikrotik jika ada konfigurasi
    if ($syncMikrotik) {
        $api = new RouterosAPI();
        $api->port = $routerPort;
        if ($api->connect($routerHost, $routerUser, $routerPass)) {
            $secrets = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if ($action === 'add' && empty($secrets)) {
                $params = ['name' => $username, 'password' => $password, 'profile' => $profile, 'service' => 'pppoe'];
                if ($remoteAddr)
                    $params['remote-address'] = $remoteAddr;
                $api->comm('/ppp/secret/add', $params);
            } elseif (!empty($secrets[0]['.id'])) {
                $params = ['numbers' => $secrets[0]['.id'], 'profile' => $profile];
                if ($password)
                    $params['password'] = $password;
                if ($remoteAddr)
                    $params['remote-address'] = $remoteAddr;
                $api->comm('/ppp/secret/set', $params);
            }
            $api->disconnect();
            $cacheKeyRouter = $routerInternalId ?: "{$routerHost}_{$routerPort}";
            (new MikrotikCache($conn))->invalidate("mt_{$cacheKeyRouter}_ppp_secret");
        }
    }

    log_admin_activity($conn, $action === 'add' ? 'customer_add' : 'customer_update', "User {$username} berhasil " . ($action === 'add' ? 'ditambahkan' : 'diperbarui'), (int)($_SESSION['admin_id'] ?? 0));
    echo json_encode(['success' => true, 'message' => 'User berhasil ' . ($action === 'add' ? 'ditambahkan' : 'diperbarui')]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>