<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh bulk update pelanggan.');

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['usernames']) || !isset($data['router_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid input"]);
    exit();
}

$usernames = $data['usernames'];
$router_id = $data['router_id'];
$updates = $data['updates'] ?? []; // Array of fields to update: ['profile' => '...', 'disabled' => '...', 'odp_id' => ...]

if (empty($usernames) || empty($updates)) {
    echo json_encode(["success" => false, "error" => "No users or updates provided"]);
    exit();
}

try {
    // 1. Dapatkan detail router untuk sinkronisasi
    $routerStmt = $conn->prepare("SELECT host, username, password, port FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $routerStmt->bind_param("ss", $router_id, $router_id);
    $routerStmt->execute();
    $routerData = $routerStmt->get_result()->fetch_assoc();
    $routerStmt->close();

    // 2. MikroTik API
    $API = new RouterosAPI();
    $mt_connected = false;
    if ($routerData) {
        $API->port = (int)$routerData['port'];
        $mt_connected = $API->connect($routerData['host'], $routerData['username'], $routerData['password']);
    }

    // 3. Build SQL query dynamically
    $set_parts = [];
    $types = "";
    $params = [];
    foreach ($updates as $key => $val) {
        $set_parts[] = "$key = ?";
        if (is_int($val)) $types .= "i";
        elseif (is_double($val)) $types .= "d";
        else $types .= "s";
        $params[] = $val;
    }
    
    $sql = "UPDATE users SET " . implode(", ", $set_parts) . " WHERE username = ? AND router_id = ?";
    $stmt = $conn->prepare($sql);
    
    $success_count = 0;
    foreach ($usernames as $uname) {
        // Bind params: [updates_params..., username, router_id]
        $current_params = array_merge($params, [$uname, $router_id]);
        $current_types = $types . "ss";
        $stmt->bind_param($current_types, ...$current_params);
        
        if ($stmt->execute()) {
            $success_count++;
            
            // MikroTik Sync
            if ($mt_connected) {
                // Mapping updates to MT params
                $mt_params = [];
                if (isset($updates['profile'])) $mt_params['profile'] = $updates['profile'];
                if (isset($updates['disabled'])) $mt_params['disabled'] = $updates['disabled'];
                
                if (!empty($mt_params)) {
                    $secrets = $API->comm('/ppp/secret/print', ['?name' => $uname]);
                    if (!empty($secrets)) {
                        $mt_params['.id'] = $secrets[0]['.id'];
                        $API->comm('/ppp/secret/set', $mt_params);
                    }
                }
            }
        }
    }
    
    $stmt->close();
    if ($mt_connected) $API->disconnect();

    echo json_encode([
        "success" => true,
        "message" => "Berhasil memperbarui $success_count pelanggan.",
        "count" => $success_count
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
$conn->close();
?>
