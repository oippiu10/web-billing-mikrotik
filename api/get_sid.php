<?php
require_once 'c:/laragon/www/mikrotik_monitor/web/api/config.php';
require_once 'c:/laragon/www/mikrotik_monitor/web/api/routerosAPI.php';

$res = $conn->query("SELECT id, host, username, password FROM mikrotik_routers WHERE id = 2");
$r = $res->fetch_assoc();

$api = new RouterosAPI();
if ($api->connect($r['host'], $r['username'], $r['password'])) {
    $license = $api->comm('/system/license/print');
    $api->disconnect();
    echo json_encode($license[0], JSON_PRETTY_PRINT);
} else {
    echo "Connection failed";
}
