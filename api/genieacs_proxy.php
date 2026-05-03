<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Fetch settings from DB. Keep proxy usable even if settings table is not installed yet.
$settings = [];
if (isset($conn) && $conn instanceof mysqli) {
    $tableCheck = $conn->query("SHOW TABLES LIKE 'web_settings'");
    if ($tableCheck && $tableCheck->num_rows > 0) {
        $res = $conn->query("SELECT setting_key, setting_value FROM web_settings WHERE setting_key IN ('genieacs_url', 'genieacs_user', 'genieacs_pass')");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
    }
}

$acs_url = rtrim($settings['genieacs_url'] ?? "http://api-acs.marzuqnetwork.online", '/');
$acs_user = $settings['genieacs_user'] ?? "acs";
$acs_pass = $settings['genieacs_pass'] ?? "acs123";

// Get the target path from the query string
// Example: genieacs_proxy.php?path=/devices
$path = isset($_GET['path']) ? $_GET['path'] : (isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '/devices');
$query_string = $_SERVER['QUERY_STRING'];

// Build target URL
$target_url = $acs_url . $path;

// Append other query parameters if they are not 'path'
if (!empty($query_string)) {
    $params = [];
    parse_str($query_string, $params);
    unset($params['path']);
    if (!empty($params)) {
        $target_url .= (strpos($target_url, '?') === false ? '?' : '&') . http_build_query($params);
    }
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
curl_setopt($ch, CURLOPT_USERPWD, "$acs_user:$acs_pass");
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// Set method
$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

// Forward request body for POST/PUT/DELETE
if ($method !== 'GET' && $method !== 'HEAD') {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

// curl_close($ch); // Deprecated in PHP 8.5+, handles are auto-closed

if ($error) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Proxy Error: " . $error]);
} else {
    http_response_code($http_code);
    echo $response;
}
?>