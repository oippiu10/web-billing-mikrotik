<?php
/**
 * Helper untuk validasi router_id di semua endpoint
 * Gunakan: require_once __DIR__ . '/router_id_helper.php';
 */

/**
 * Validasi router_id dari GET parameter
 * @param mysqli $conn Database connection
 * @return string router_id yang sudah divalidasi
 * @throws Exception jika router_id kosong atau invalid
 */
function requireRouterIdFromGet($conn) {
    $router_id = isset($_GET['router_id']) ? trim($_GET['router_id']) : '';
    if ($router_id === '') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "router_id tidak boleh kosong",
            "message" => "Parameter router_id wajib diisi"
        ]);
        exit();
    }
    return $router_id;
}

/**
 * Validasi router_id dari POST/PUT/DELETE body JSON
 * @param mysqli $conn Database connection
 * @param array|object $data JSON decoded data
 * @return string router_id yang sudah divalidasi
 * @throws Exception jika router_id kosong atau invalid
 */
function requireRouterIdFromBody($conn, $data) {
    if (is_array($data)) {
        $router_id = isset($data['router_id']) ? trim($data['router_id']) : '';
    } else {
        $router_id = isset($data->router_id) ? trim($data->router_id) : '';
    }
    
    if ($router_id === '') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "router_id tidak boleh kosong",
            "message" => "Field router_id wajib diisi di body request"
        ]);
        exit();
    }
    return $router_id;
}

/**
 * Validasi router_id dari GET atau POST body (fleksibel)
 * @param mysqli $conn Database connection
 * @param array|object|null $data Optional JSON decoded data untuk POST/PUT
 * @return string router_id yang sudah divalidasi
 */
function requireRouterId($conn, $data = null) {
    // Coba dari GET dulu
    $router_id = isset($_GET['router_id']) ? trim($_GET['router_id']) : '';
    
    // Jika GET kosong, coba dari body
    if ($router_id === '' && $data !== null) {
        if (is_array($data)) {
            $router_id = isset($data['router_id']) ? trim($data['router_id']) : '';
        } else if (is_object($data)) {
            $router_id = isset($data->router_id) ? trim($data->router_id) : '';
        }
    }
    
    if ($router_id === '') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "router_id tidak boleh kosong",
            "message" => "router_id wajib disertakan (GET parameter atau body JSON)"
        ]);
        exit();
    }
    
    return $router_id;
}
?>

