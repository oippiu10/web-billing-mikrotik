<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
require_admin_role(['admin','administrator','super_admin','super admin','superadministrator','finance'], 'Akses buka isolir ditolak.');

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$router_id = trim($input['router_id'] ?? '');
$user_id = intval($input['user_id'] ?? 0);
$username = trim($input['username'] ?? '');
if ($router_id === '' || ($user_id <= 0 && $username === '')) { echo json_encode(['success'=>false,'message'=>'router_id dan user wajib diisi']); exit; }

$stmt = $conn->prepare('SELECT id, host, port, username, password, software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
$ridInt = intval($router_id); $ridStr = (string)$router_id;
$stmt->bind_param('is', $ridInt, $ridStr); $stmt->execute(); $router = $stmt->get_result()->fetch_assoc();
if (!$router) { echo json_encode(['success'=>false,'message'=>'Router tidak ditemukan']); exit; }
$softwareId = $router['software_id'] ?: (string)$router['id'];

if ($username === '') {
    $u = $conn->prepare('SELECT username FROM users WHERE id = ? AND (router_id = ? OR router_id = ?) LIMIT 1');
    $realId = intval($router['id']); $u->bind_param('iss', $user_id, $softwareId, $ridStr); $u->execute(); $row = $u->get_result()->fetch_assoc();
    $username = trim($row['username'] ?? '');
}
if ($username === '') { echo json_encode(['success'=>false,'message'=>'Username pelanggan tidak ditemukan']); exit; }

$api = new RouterosAPI(); $api->port = intval($router['port']) ?: 8728; $api->timeout = 8;
if (!$api->connect($router['host'], $router['username'], $router['password'])) { http_response_code(503); echo json_encode(['success'=>false,'message'=>'Gagal koneksi ke MikroTik']); exit; }
$found = $api->comm('/ppp/secret/print', ['?name' => $username]);
$secretId = $found[0]['.id'] ?? null;
if (!$secretId) { $api->disconnect(); echo json_encode(['success'=>false,'message'=>'PPP secret tidak ditemukan di MikroTik']); exit; }
$disabled = (($found[0]['disabled'] ?? 'false') === 'true');
if ($disabled) $api->comm('/ppp/secret/enable', ['.id' => $secretId]);
$api->disconnect();
$cache = new MikrotikCache($conn); $cache->invalidate('mt_' . $router['host'] . '_' . (intval($router['port']) ?: 8728) . '_ppp_secret');
log_admin_activity($conn, 'auto_open_isolate', 'Buka isolir PPP secret '.$username, intval($_SESSION['admin_id'] ?? 0));
echo json_encode(['success'=>true,'message'=>$disabled?'Layanan berhasil diaktifkan':'Layanan sudah aktif','username'=>$username,'was_disabled'=>$disabled]);
