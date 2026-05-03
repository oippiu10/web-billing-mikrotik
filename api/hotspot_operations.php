<?php
/**
 * Hotspot Operations API - Super App Feature
 * Generate & Manage Hotspot Vouchers
 */
session_start();
header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/routerosAPI.php';

// Auth Check
if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$router_id = intval($_GET['router_id'] ?? $_POST['router_id'] ?? 0);

if ($router_id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Router ID wajib']);
    exit;
}

// Ambil kredensial router
$stmt = $conn->prepare("SELECT host, port, username, password FROM mikrotik_routers WHERE id = ?");
$stmt->bind_param("i", $router_id);
$stmt->execute();
$r = $stmt->get_result()->fetch_assoc();
if (!$r) {
    echo json_encode(['success' => false, 'message' => 'Router tidak ditemukan']);
    exit;
}

$api = new RouterosAPI();
$api->debug = false;

function connectApi($api, $r)
{
    return $api->connect($r['host'], $r['username'], $r['password'], intval($r['port']) ?: 8728);
}

switch ($action) {
    case 'list_active':
        if (connectApi($api, $r)) {
            $active = $api->comm('/ip/hotspot/active/print');
            $api->disconnect();
            echo json_encode(['success' => true, 'data' => $active]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        }
        break;

    case 'kick':
        $id = $_POST['id'] ?? '';
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'ID user aktif tidak valid']);
            exit;
        }
        if (connectApi($api, $r)) {
            $api->comm('/ip/hotspot/active/remove', ['.id' => $id]);
            $api->disconnect();
            echo json_encode(['success' => true, 'message' => 'User berhasil dikeluarkan']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        }
        break;

    case 'get_profiles':
        if (connectApi($api, $r)) {
            $profiles = $api->comm('/ip/hotspot/user/profile/print');
            $servers = $api->comm('/ip/hotspot/print');
            $api->disconnect();
            echo json_encode(['success' => true, 'profiles' => $profiles, 'servers' => $servers]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        }
        break;

    case 'generate':
        $qty = intval($_POST['qty'] ?? 10);
        $server = $_POST['server'] ?? 'all';
        $profile = $_POST['profile'] ?? 'default';
        $mode = $_POST['mode'] ?? 'vc'; // vc = user=pass, up = user & pass
        $len = intval($_POST['length'] ?? 6);
        $prefix = $_POST['prefix'] ?? '';

        if (connectApi($api, $r)) {
            $generated = [];
            for ($i = 0; $i < $qty; $i++) {
                $user = $prefix . generateRandomString($len);
                $pass = ($mode === 'vc') ? $user : generateRandomString($len);

                $params = [
                    'name' => $user,
                    'password' => $pass,
                    'profile' => $profile,
                    'server' => $server,
                    'comment' => 'Voucher Generated ' . date('Y-m-d H:i')
                ];

                $res = $api->comm('/ip/hotspot/user/add', $params);

                // Simpan ke DB lokal untuk history
                $stmtIns = $conn->prepare("INSERT INTO hotspot_vouchers (router_id, username, password, profile, server, comment) VALUES (?, ?, ?, ?, ?, ?)");
                $comm = $params['comment'];
                $stmtIns->bind_param("isssss", $router_id, $user, $pass, $profile, $server, $comm);
                $stmtIns->execute();

                $generated[] = ['username' => $user, 'password' => $pass];
            }
            $api->disconnect();
            echo json_encode(['success' => true, 'data' => $generated]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        }
        break;

    case 'list_vouchers':
        $stmtList = $conn->prepare("SELECT * FROM hotspot_vouchers WHERE router_id = ? ORDER BY id DESC LIMIT 100");
        $stmtList->bind_param("i", $router_id);
        $stmtList->execute();
        $res = $stmtList->get_result();
        $data = [];
        while ($row = $res->fetch_assoc())
            $data[] = $row;
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'delete':
        $ids = $_POST['ids'] ?? [];
        if (empty($ids)) {
            echo json_encode(['success' => false, 'message' => 'Tidak ada voucher dipilih']);
            exit;
        }

        if (connectApi($api, $r)) {
            foreach ($ids as $id) {
                // Ambil username dari DB
                $st = $conn->prepare("SELECT username FROM hotspot_vouchers WHERE id = ?");
                $st->bind_param("i", $id);
                $st->execute();
                $v = $st->get_result()->fetch_assoc();
                if ($v) {
                    // Cari ID user di MikroTik dulu
                    $find = $api->comm('/ip/hotspot/user/print', ['?name' => $v['username']]);
                    if (!empty($find)) {
                        $api->comm('/ip/hotspot/user/remove', ['.id' => $find[0]['.id']]);
                    }
                    // Hapus dari DB
                    $conn->query("DELETE FROM hotspot_vouchers WHERE id = $id");
                }
            }
            $api->disconnect();
            echo json_encode(['success' => true, 'message' => 'Voucher berhasil dihapus']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Gagal koneksi ke MikroTik']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}

function generateRandomString($length = 6)
{
    $characters = '23456789abcdefghjkmnpqrstuvwxyz';
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[random_int(0, $charactersLength - 1)];
    }
    return $randomString;
}
