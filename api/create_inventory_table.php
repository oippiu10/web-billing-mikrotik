<?php
require_once 'config.php';

$sql = "CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    router_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category ENUM('ONT', 'Router', 'Kabel', 'Alat', 'Lainnya') DEFAULT 'Lainnya',
    stock INT DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'Pcs',
    price DECIMAL(15, 2) DEFAULT 0.00,
    description TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)";

if ($conn->query($sql)) {
    echo json_encode(['success' => true, 'message' => 'Table inventory created successfully']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error creating table: ' . $conn->error]);
}
?>