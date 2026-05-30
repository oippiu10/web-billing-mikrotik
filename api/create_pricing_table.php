<?php
require_once 'config.php';
/** @var mysqli $conn */

$sql = "CREATE TABLE IF NOT EXISTS ppp_profile_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id VARCHAR(100) NOT NULL,
    profile_name VARCHAR(100) NOT NULL,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_profile (router_id, profile_name)
)";

if ($conn->query($sql)) {
    echo json_encode(['success' => true, 'message' => 'Table ppp_profile_pricing created successfully']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
}
?>
