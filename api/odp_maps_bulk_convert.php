<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh konversi maps ODP.');

function json_fail(string $message, int $status = 500, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

function db_prepare_or_fail($conn, string $sql)
{
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception($conn->error ?: 'Gagal menyiapkan query database');
    }
    return $stmt;
}

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

function is_allowed_google_maps_host(string $url): bool
{
    if (!preg_match('/^https?:\/\//i', $url)) return false;
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
    $allowedHosts = ['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com'];
    foreach ($allowedHosts as $allowedHost) {
        $suffix = '.' . $allowedHost;
        $endsWith = substr($host, -strlen($suffix)) === $suffix;
        if ($host === $allowedHost || $endsWith) return true;
    }
    return false;
}

function follow_maps_redirect(string $url, bool $headOnly): array
{
    if (!function_exists('curl_init')) {
        return ['success' => false, 'message' => 'Extension cURL tidak aktif di hosting'];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => $headOnly,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ODPMapsResolver/1.0)',
    ]);
    curl_exec($ch);
    $resolved = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
    $httpCode = (int)(curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 0);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'success' => $error === '',
        'resolved_url' => $resolved,
        'http_code' => $httpCode,
        'message' => $error,
    ];
}

function resolve_odp_maps_coords(string $url): array
{
    $direct = extract_odp_maps_coords($url);
    if ($direct) return ['success' => true, 'source' => 'direct'] + $direct;

    if (!is_allowed_google_maps_host($url)) {
        return ['success' => false, 'message' => preg_match('/^https?:\/\//i', $url) ? 'Bukan link Google Maps' : 'URL tidak valid'];
    }

    // Coba HEAD dulu agar ringan. Beberapa shortlink Google perlu GET, jadi fallback ke GET.
    $last = null;
    foreach ([true, false] as $headOnly) {
        $result = follow_maps_redirect($url, $headOnly);
        $last = $result;
        $resolved = $result['resolved_url'] ?? $url;
        $coords = extract_odp_maps_coords($resolved);
        if ($coords) {
            return ['success' => true, 'source' => $headOnly ? 'redirect_head' : 'redirect_get', 'resolved_url' => $resolved] + $coords;
        }
    }

    return [
        'success' => false,
        'message' => $last['message'] ?: 'Koordinat tidak ditemukan',
        'resolved_url' => $last['resolved_url'] ?? $url,
        'http_code' => $last['http_code'] ?? 0,
    ];
}

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $limit = max(1, min(100, (int)($input['limit'] ?? 25)));
    $routerId = trim((string)($input['router_id'] ?? ''));

    $routerKeys = [];
    if ($routerId !== '') {
        $routerKeys[] = $routerId;
        $stmtR = db_prepare_or_fail($conn, 'SELECT id, software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1');
        $stmtR->bind_param('ss', $routerId, $routerId);
        $stmtR->execute();
        $routerRow = $stmtR->get_result()->fetch_assoc();
        $stmtR->close();
        if ($routerRow) {
            if (!empty($routerRow['id'])) $routerKeys[] = (string)$routerRow['id'];
            if (!empty($routerRow['software_id'])) $routerKeys[] = (string)$routerRow['software_id'];
        }
        $routerKeys = array_values(array_unique(array_filter($routerKeys, function ($v) { return $v !== ''; })));
    }

    $where = "maps_link IS NOT NULL AND maps_link <> '' AND (lat IS NULL OR lng IS NULL OR lat = 0 OR lng = 0)";
    $params = [];
    $types = '';
    if ($routerKeys) {
        $where .= ' AND router_id IN (' . implode(',', array_fill(0, count($routerKeys), '?')) . ')';
        foreach ($routerKeys as $key) {
            $params[] = $key;
            $types .= 's';
        }
    }

    $sql = "SELECT id, name, maps_link FROM odp WHERE {$where} ORDER BY id DESC LIMIT {$limit}";
    $stmt = db_prepare_or_fail($conn, $sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) $rows[] = $row;
    $stmt->close();

    $updated = 0;
    $failed = 0;
    $processed = 0;
    $items = [];
    $update = db_prepare_or_fail($conn, 'UPDATE odp SET lat = ?, lng = ?, maps_link = ? WHERE id = ?');
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
            $items[] = [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'success' => false,
                'message' => $result['message'] ?? 'Gagal',
                'http_code' => $result['http_code'] ?? null,
            ];
        }
    }
    $update->close();

    $countSql = "SELECT COUNT(*) AS remaining FROM odp WHERE {$where}";
    $stmt = db_prepare_or_fail($conn, $countSql);
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
} catch (Throwable $e) {
    error_log('ODP maps bulk convert error: ' . $e->getMessage());
    json_fail('Gagal konversi maps ODP', 500, ['type' => 'odp_maps_convert_error']);
}
