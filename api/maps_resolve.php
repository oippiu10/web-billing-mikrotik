<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/auth/require_auth.php';

function extract_coords_from_text(string $text): ?array
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
            $lat = (float) $m[1];
            $lng = (float) $m[2];
            if (abs($lat) <= 90 && abs($lng) <= 180) {
                return ['lat' => $lat, 'lng' => $lng];
            }
        }
    }
    return null;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$url = trim((string)($input['url'] ?? $_GET['url'] ?? ''));

if ($url === '') {
    echo json_encode(['success' => false, 'message' => 'URL Google Maps kosong']);
    exit;
}

$direct = extract_coords_from_text($url);
if ($direct) {
    echo json_encode(['success' => true, 'source' => 'direct', ...$direct, 'resolved_url' => $url]);
    exit;
}

if (!preg_match('/^https?:\/\//i', $url)) {
    echo json_encode(['success' => false, 'message' => 'URL harus diawali http/https']);
    exit;
}

$host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
$allowedHosts = ['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com'];
$allowed = false;
foreach ($allowedHosts as $allowedHost) {
    if ($host === $allowedHost || str_ends_with($host, '.' . $allowedHost)) {
        $allowed = true;
        break;
    }
}
if (!$allowed) {
    echo json_encode(['success' => false, 'message' => 'Hanya link Google Maps yang boleh di-resolve']);
    exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_NOBODY => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 8,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; BillingMapsResolver/1.0)',
]);
curl_exec($ch);
$resolved = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
$error = curl_error($ch);
curl_close($ch);

$coords = extract_coords_from_text($resolved);
if ($coords) {
    echo json_encode(['success' => true, 'source' => 'redirect', ...$coords, 'resolved_url' => $resolved]);
    exit;
}

// Fallback ringan: ambil HTML akhir jika redirect URL belum mengandung koordinat.
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 8,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; BillingMapsResolver/1.0)',
]);
$html = curl_exec($ch);
$resolved = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $resolved;
$error = curl_error($ch) ?: $error;
curl_close($ch);

$coords = extract_coords_from_text($resolved . ' ' . substr((string)$html, 0, 300000));
if ($coords) {
    echo json_encode(['success' => true, 'source' => 'html', ...$coords, 'resolved_url' => $resolved]);
    exit;
}

echo json_encode([
    'success' => false,
    'message' => $error ? ('Gagal resolve link: ' . $error) : 'Koordinat tidak ditemukan. Buka peta lalu geser titik manual.',
    'resolved_url' => $resolved,
]);
