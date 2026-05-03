<?php
/**
 * Export Users to CSV
 */
ob_start();
header('Content-Type: text/csv; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

// Disable error display to avoid corrupting CSV, but log them
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

// Clean buffer if something was echoed in includes
while (ob_get_level() > 1) ob_end_clean();

$routerIdRaw = trim($_GET['router_id'] ?? '');

if (empty($routerIdRaw)) {
    http_response_code(400);
    echo "Error: router_id is required.";
    exit;
}

// Resolve Software ID from router_id (might be numeric or software_id itself)
$softwareId = $routerIdRaw;
$stmtR = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1");
$stmtR->bind_param("ss", $routerIdRaw, $routerIdRaw);
$stmtR->execute();
$resR = $stmtR->get_result();
if ($rowR = $resR->fetch_assoc()) {
    $softwareId = $rowR['software_id'];
}
$stmtR->close();

// --- Fetch DB and export ---
try {
    $dataSQL = "SELECT
                    u.username, u.password, u.profile, u.wa, u.alamat, 
                    u.tanggal_tagihan, u.maps, u.lat, u.lng, u.redaman,
                    o.name as odp_name
                 FROM users u
                 LEFT JOIN odp o ON u.odp_id = o.id
                 WHERE u.router_id = ?
                 ORDER BY u.username ASC";

    $stmt = $conn->prepare($dataSQL);
    $stmt->bind_param("s", $softwareId);
    $stmt->execute();
    $result = $stmt->get_result();

    header('Content-Disposition: attachment; filename="Export_Pelanggan_' . date('Y-m-d_His') . '.csv"');

    $out = fopen('php://output', 'w');
    // Header sesuai struktur database
    fputcsv($out, [
        'username', 
        'password', 
        'profile', 
        'alamat', 
        'wa', 
        'tanggal_tagihan', 
        'maps', 
        'lat', 
        'lng', 
        'redaman', 
        'odp_name'
    ]);

    while ($row = $result->fetch_assoc()) {
        fputcsv($out, [
            $row['username'],
            $row['password'],
            $row['profile'],
            $row['alamat'],
            $row['wa'],
            $row['tanggal_tagihan'],
            $row['maps'],
            $row['lat'],
            $row['lng'],
            $row['redaman'],
            $row['odp_name']
        ]);
    }
    
    fclose($out);
    exit;

} catch (Exception $e) {
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(500);
    echo "Error: " . $e->getMessage();
}
?>
?>