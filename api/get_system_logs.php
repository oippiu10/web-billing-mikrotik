<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Only allow admin and super_admin to view system logs
require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Hanya Admin yang dapat melihat System Logs');

$action = $_GET['action'] ?? 'read';
$type = $_GET['type'] ?? 'php';

$logFiles = [
    'php' => __DIR__ . '/error.log',
    'daemon' => __DIR__ . '/daemon.log'
];

if (!isset($logFiles[$type])) {
    echo json_encode(['success' => false, 'message' => 'Invalid log type']);
    exit;
}

$file = $logFiles[$type];

if ($action === 'clear') {
    if (file_exists($file)) {
        file_put_contents($file, '');
    }
    echo json_encode(['success' => true, 'message' => 'Log cleared successfully']);
    exit;
}

if (!file_exists($file)) {
    echo json_encode(['success' => true, 'logs' => []]);
    exit;
}

// Read last 500 lines efficiently
$lines = [];
$fp = fopen($file, "r");
if ($fp) {
    fseek($fp, -1, SEEK_END);
    $pos = ftell($fp);
    $lastLine = "";
    $linesRead = 0;

    while ($pos > 0 && $linesRead < 500) {
        $char = fgetc($fp);
        if ($char === "\n") {
            if (!empty(trim($lastLine))) {
                $lines[] = strrev($lastLine);
            }
            $lastLine = "";
            $linesRead++;
        } else {
            $lastLine .= $char;
        }
        $pos--;
        fseek($fp, $pos, SEEK_SET);
    }
    // catch the first line of the file if it doesn't end with a newline
    if ($pos == 0) {
        $char = fgetc($fp);
        $lastLine .= $char;
        if (!empty(trim($lastLine))) {
            $lines[] = strrev($lastLine);
        }
    }
    fclose($fp);
}

// return chronologically (oldest to newest)
$lines = array_reverse($lines);

echo json_encode(['success' => true, 'logs' => $lines]);
