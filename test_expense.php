<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'api/config.php';

$router_id = '1';
$m = 5;
$y = 2026;

// Get expense
$stmtExp = $conn->prepare("SELECT IFNULL(SUM(amount), 0) as expense FROM expenses WHERE router_id = ? AND MONTH(spent_at) = ? AND YEAR(spent_at) = ?");
if (!$stmtExp) die("Prepare failed: " . $conn->error);

$stmtExp->bind_param("sii", $router_id, $m, $y);
if (!$stmtExp->execute()) die("Execute failed: " . $stmtExp->error);

$expRow = $stmtExp->get_result()->fetch_assoc();
var_dump($expRow);

echo "\nDone\n";
?>
