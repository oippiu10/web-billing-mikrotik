<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh konversi maps ODP.');

function extract_odp_maps_coords(string $text): ?array
{
    $decoded = urldecode($text);
    $patterns = [
        '/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/',
        '/\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/',
        '/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/',
        '/[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/',
        '/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/',
        '/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $decoded, $m)) {
            $lat = (float)$m[1];
            $lng = (float)$m[2];
            if (abs($lat) <= 90 && abs($lng) <= 180) return ['lat' => $lat, 'lng' => $lng];
        }
    }
    return null;
}

function resolve_odp_maps_coords(string $url): array
{
    $direct = extract_odp_maps_coords($url);
    if ($direct) return ['success' => true, 'source' => 'direct'] + $direct;

    if (!preg_match('/^https?:\/\//i', $url)) return ['success' => false, 'message' => 'URL tidak valid'];
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
    $allowedHosts = ['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com'];
    $allowed = false;
    foreach ($allowedHosts as $allowedHost) {
        if ($host === $allowedHost || str_ends_with($host, '.' . $allowedHost)) { $allowed = true; break; }
    }
    if (!$allowed) return ['success' => false, 'message' => 'Bukan link Google Maps'];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ODPMapsResolver/1.0)',
    ]);
    curl_exec($ch);
    $resolved = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
    $error = curl_error($ch);
    curl_close($ch);

    $coords = extract_odp_maps_coords($resolved);
    if ($coords) return ['success' => true, 'source' => 'redirect', 'resolved_url' => $resolved] + $coords;

    return ['success' => false, 'message' => $error ?: 'Koordinat tidak ditemukan', 'resolved_url' => $resolved];
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$limit = max(1, min(100, (int)($input['limit'] ?? 25)));
$routerId = trim((string)($input['router_id'] ?? ''));
if ($routerId !== '') {
    $stmtR = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtR->bind_param('ss', $routerId, $routerId);
    $stmtR->execute();
    $routerRow = $stmtR->get_result()->fetch_assoc();
    $stmtR->close();
    if (!empty($routerRow['software_id'])) {
        $routerId = (string)$routerRow['software_id'];
    }
}

$where = "maps_link IS NOT NULL AND maps_link <> '' AND (lat IS NULL OR lng IS NULL OR lat = 0 OR lng = 0)";
$params = [];
$types = '';
if ($routerId !== '') {
    $where .= " AND router_id = ?";
    $params[] = $routerId;
    $types .= 's';
}

$sql = "SELECT id, name, maps_link FROM odp WHERE {$where} ORDER BY id DESC LIMIT {$limit}";
$stmt = $conn->prepare($sql);
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) $rows[] = $row;
$stmt->close();

$updated = 0; $failed = 0; $processed = 0; $items = [];
$update = $conn->prepare("UPDATE odp SET lat = ?, lng = ?, maps_link = ? WHERE id = ?");
foreach ($rows as $row) {
    $processed++;
    $result = resolve_odp_maps_coords((string)$row['maps_link']);
    if (!empty($result['success'])) {
        $lat = (float)$result['lat'];
        $lng = (float)$result['lng'];
        $maps = "https://www.google.com/maps?q={$lat},{$lng}";
        $id = (int)$row['id'];
        $update->bind_param('ddsi', $lat, $lng, $maps, $id);
        $update->execute();
        $updated++;
        $items[] = ['id' => $id, 'name' => $row['name'], 'success' => true, 'lat' => $lat, 'lng' => $lng, 'source' => $result['source'] ?? 'unknown'];
    } else {
        $failed++;
        $items[] = ['id' => (int)$row['id'], 'name' => $row['name'], 'success' => false, 'message' => $result['message'] ?? 'Gagal'];
    }
}
$update->close();

$countSql = "SELECT COUNT(*) AS remaining FROM odp WHERE {$where}";
$stmt = $conn->prepare($countSql);
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$remaining = (int)(($stmt->get_result()->fetch_assoc()['remaining'] ?? 0));
$stmt->close();

echo json_encode([
    'success' => true,
    'processed' => $processed,
    'updated' => $updated,
    'failed' => $failed,
    'remaining' => $remaining,
    'items' => $items,
], JSON_UNESCAPED_UNICODE);
