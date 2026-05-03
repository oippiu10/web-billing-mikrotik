<?php
header('Content-Type: application/json; charset=UTF-8');
date_default_timezone_set('Asia/Jakarta');

// Load environment variables from api/.env or project root .env if available.
foreach ([__DIR__ . '/.env', dirname(__DIR__) . '/.env'] as $envFile) {
  if (!file_exists($envFile)) {
    continue;
  }

  $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || strpos($line, '#') === 0 || !str_contains($line, '=')) {
      continue;
    }

    [$key, $value] = explode('=', $line, 2);
    $key = trim($key);
    $value = trim($value, " \t\n\r\0\x0B\"'");

    if ($key !== '' && !array_key_exists($key, $_ENV)) {
      $_ENV[$key] = $value;
    }
  }
}

// ─── PHP Settings & Performance ─────────────────────────────────────────────
ini_set('memory_limit', '256M'); // Handle large user lists (4000+)
ini_set('max_execution_time', 300); // 5 minutes
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', 0); // Don't break JSON output
ini_set('log_errors', 1);

// ─── Database Configuration ──────────────────────────────────────────────────
// Use 127.0.0.1 instead of localhost to force TCP connection instead of socket
$host = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '127.0.0.1';
$db = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'pppoe_monitor';
$user = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: 'root';
$pass = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '';

$conn = mysqli_init();
mysqli_options($conn, MYSQLI_OPT_CONNECT_TIMEOUT, 5); // 5 seconds timeout
if (!@mysqli_real_connect($conn, $host, $user, $pass, $db)) {
    http_response_code(500);
    die(json_encode([
        'success' => false, 
        'message' => 'Database connection failed: ' . mysqli_connect_error(),
        'type' => 'db_error'
    ]));
}
mysqli_set_charset($conn, 'utf8mb4');







