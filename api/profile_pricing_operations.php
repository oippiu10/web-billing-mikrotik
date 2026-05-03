<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Koneksi ke database via config terpusat
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/router_id_helper.php';

// $conn disediakan oleh config.php
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    require_admin_role(['admin', 'administrator', 'finance'], 'Akses ditolak. Hanya admin/finance yang boleh mengubah harga paket.');
}

// Helper function untuk return error
function returnError($message, $code = 400) {
    http_response_code($code);
    echo json_encode([
        "success" => false,
        "error" => $message
    ]);
    exit();
}

// Helper function untuk return success
function returnSuccess($message, $data = null) {
    $response = [
        "success" => true,
        "message" => $message
    ];
    if ($data !== null) {
        $response["data"] = $data;
    }
    echo json_encode($response);
    exit();
}

// Get operation type from query parameter or request method
$operation = isset($_GET['operation']) ? $_GET['operation'] : '';

// =====================================================
// GET: Fetch all profile pricing atau single pricing
// =====================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $router_id = requireRouterIdFromGet($conn);
    
    // Jika ada ID, ambil single pricing
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $stmt = $conn->prepare("SELECT * FROM ppp_profile_pricing WHERE id = ? AND router_id = ?");
        $stmt->bind_param("is", $id, $router_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            returnError("Profile pricing not found", 404);
        }
        
        $pricing = $result->fetch_assoc();
        returnSuccess("Profile pricing retrieved", $pricing);
    }
    
    // Jika ada profile_name, ambil pricing untuk profile tertentu
    if (isset($_GET['profile_name'])) {
        $profile_name = $_GET['profile_name'];
        $stmt = $conn->prepare("SELECT * FROM ppp_profile_pricing WHERE router_id = ? AND profile_name = ?");
        $stmt->bind_param("ss", $router_id, $profile_name);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            returnSuccess("No pricing found", null);
        } else {
            $pricing = $result->fetch_assoc();
            returnSuccess("Profile pricing retrieved", $pricing);
        }
    }
    
    // Ambil semua pricing untuk router_id
    $include_inactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] === 'true';
    
    if ($include_inactive) {
        $stmt = $conn->prepare("SELECT * FROM ppp_profile_pricing WHERE router_id = ? ORDER BY profile_name ASC");
        $stmt->bind_param("s", $router_id);
    } else {
        $stmt = $conn->prepare("SELECT * FROM ppp_profile_pricing WHERE router_id = ? AND is_active = 1 ORDER BY profile_name ASC");
        $stmt->bind_param("s", $router_id);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $pricings = [];
    
    while ($row = $result->fetch_assoc()) {
        $pricings[] = $row;
    }
    
    returnSuccess("Profile pricings retrieved", $pricings);
}

// =====================================================
// POST: Add new profile pricing
// =====================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $operation === 'add') {
    $router_id = requireRouterIdFromGet($conn);
    
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        returnError("Invalid JSON data: " . json_last_error_msg());
    }
    
    // Validate required fields
    if (!isset($data['profile_name']) || empty($data['profile_name'])) {
        returnError("profile_name is required");
    }
    
    if (!isset($data['price']) || !is_numeric($data['price'])) {
        returnError("price is required and must be numeric");
    }
    
    $profile_name = $data['profile_name'];
    $price = (float)$data['price'];
    $description = isset($data['description']) ? $data['description'] : null;
    $is_active = isset($data['is_active']) ? (int)$data['is_active'] : 1;
    
    // Check if pricing already exists for this router and profile
    $checkStmt = $conn->prepare("SELECT id FROM ppp_profile_pricing WHERE router_id = ? AND profile_name = ?");
    $checkStmt->bind_param("ss", $router_id, $profile_name);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows > 0) {
        returnError("Pricing for profile '$profile_name' already exists. Use update operation instead.", 409);
    }
    
    // Insert new pricing
    $stmt = $conn->prepare("INSERT INTO ppp_profile_pricing (router_id, profile_name, price, description, is_active) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("ssdsi", $router_id, $profile_name, $price, $description, $is_active);
    
    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        returnSuccess("Profile pricing added successfully", ["id" => $newId]);
    } else {
        returnError("Failed to add profile pricing: " . $stmt->error, 500);
    }
    
    $stmt->close();
    $checkStmt->close();
}

// =====================================================
// PUT: Update existing profile pricing
// =====================================================
if ($_SERVER['REQUEST_METHOD'] === 'PUT' || ($_SERVER['REQUEST_METHOD'] === 'POST' && $operation === 'update')) {
    $router_id = requireRouterIdFromGet($conn);
    
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        returnError("Invalid JSON data: " . json_last_error_msg());
    }
    
    // Validate required fields
    if (!isset($data['id']) && !isset($data['profile_name'])) {
        returnError("Either id or profile_name is required");
    }
    
    // Build update query dynamically
    $updateFields = [];
    $updateParams = [];
    $updateTypes = "";
    
    if (isset($data['price']) && is_numeric($data['price'])) {
        $updateFields[] = "price = ?";
        $updateParams[] = (float)$data['price'];
        $updateTypes .= "d";
    }
    
    if (isset($data['description'])) {
        $updateFields[] = "description = ?";
        $updateParams[] = $data['description'];
        $updateTypes .= "s";
    }
    
    if (isset($data['is_active'])) {
        $updateFields[] = "is_active = ?";
        $updateParams[] = (int)$data['is_active'];
        $updateTypes .= "i";
    }
    
    if (empty($updateFields)) {
        returnError("No fields to update");
    }
    
    // Build WHERE clause
    if (isset($data['id'])) {
        $whereClause = "id = ? AND router_id = ?";
        $updateParams[] = (int)$data['id'];
        $updateParams[] = $router_id;
        $updateTypes .= "is";
    } else {
        $whereClause = "profile_name = ? AND router_id = ?";
        $updateParams[] = $data['profile_name'];
        $updateParams[] = $router_id;
        $updateTypes .= "ss";
    }
    
    $sql = "UPDATE ppp_profile_pricing SET " . implode(", ", $updateFields) . " WHERE " . $whereClause;
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        returnError("Prepare failed: " . $conn->error, 500);
    }
    
    $stmt->bind_param($updateTypes, ...$updateParams);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows === 0) {
            returnError("No pricing found to update", 404);
        }
        returnSuccess("Profile pricing updated successfully");
    } else {
        returnError("Failed to update profile pricing: " . $stmt->error, 500);
    }
    
    $stmt->close();
}

// =====================================================
// DELETE: Delete profile pricing
// =====================================================
if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || ($_SERVER['REQUEST_METHOD'] === 'POST' && $operation === 'delete')) {
    $router_id = requireRouterIdFromGet($conn);
    
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        returnError("Invalid JSON data: " . json_last_error_msg());
    }
    
    if (!isset($data['id']) && !isset($data['profile_name'])) {
        returnError("Either id or profile_name is required");
    }
    
    if (isset($data['id'])) {
        $stmt = $conn->prepare("DELETE FROM ppp_profile_pricing WHERE id = ? AND router_id = ?");
        $id = (int)$data['id'];
        $stmt->bind_param("is", $id, $router_id);
    } else {
        $stmt = $conn->prepare("DELETE FROM ppp_profile_pricing WHERE profile_name = ? AND router_id = ?");
        $profile_name = $data['profile_name'];
        $stmt->bind_param("ss", $profile_name, $router_id);
    }
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows === 0) {
            returnError("No pricing found to delete", 404);
        }
        returnSuccess("Profile pricing deleted successfully");
    } else {
        returnError("Failed to delete profile pricing: " . $stmt->error, 500);
    }
    
    $stmt->close();
}

// If no operation matched
http_response_code(405);
echo json_encode([
    "success" => false,
    "error" => "Method not allowed or invalid operation"
]);

$conn->close();
?>


