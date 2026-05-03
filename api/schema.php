<?php
require_once 'config.php';
$res = $conn->query("SHOW COLUMNS FROM payments");
$cols = [];
if ($res) {
    while($r = $res->fetch_assoc()) $cols[] = $r['Field'];
}
echo json_encode(["payments" => $cols]) . "\n";
?>
