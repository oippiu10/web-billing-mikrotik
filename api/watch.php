<?php
/**
 * File Watch API - untuk auto-refresh browser saat file berubah
 * Digunakan hanya untuk development/local
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store');

// Daftar file yang dipantau
$watchDir = __DIR__ . '/../'; // folder web/
$extensions = ['html', 'css', 'js', 'php'];

$latestTime = 0;

// Rekursif scan file
function scanFiles($dir, $extensions, &$latestTime) {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        if (is_dir($path)) {
            // Skip hidden folders dan node_modules
            if (strpos($item, '.') === 0 || $item === 'node_modules') continue;
            scanFiles($path, $extensions, $latestTime);
        } else {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, $extensions)) {
                $mtime = filemtime($path);
                if ($mtime > $latestTime) {
                    $latestTime = $mtime;
                }
            }
        }
    }
}

scanFiles($watchDir, $extensions, $latestTime);

echo json_encode([
    'timestamp' => $latestTime,
    'time_human' => date('Y-m-d H:i:s', $latestTime)
]);
?>
