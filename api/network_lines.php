<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit();

function table_has_column($conn, $table, $column) {
    $stmt = $conn->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    if (!$stmt) return false;
    $stmt->bind_param('s', $column);
    $stmt->execute();
    $res = $stmt->get_result();
    $exists = $res && $res->num_rows > 0;
    $stmt->close();
    return $exists;
}

function ensure_network_lines_table($conn) {
    $sql = "CREATE TABLE IF NOT EXISTS `network_lines` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `router_id` varchar(100) NOT NULL DEFAULT '',
        `name` varchar(150) NOT NULL,
        `type` varchar(50) NOT NULL DEFAULT 'manual',
        `path` longtext NOT NULL,
        `color` varchar(20) DEFAULT '#3b82f6',
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_router_id` (`router_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    if (!$conn->query($sql)) {
        throw new Exception($conn->error ?: 'Gagal membuat tabel network_lines');
    }

    // Hosting lama bisa punya tabel network_lines dengan struktur lama.
    // Tambahkan kolom yang kurang tanpa menghapus data existing.
    $columns = [
        'router_id' => "ALTER TABLE `network_lines` ADD COLUMN `router_id` varchar(100) NOT NULL DEFAULT '' AFTER `id`",
        'name' => "ALTER TABLE `network_lines` ADD COLUMN `name` varchar(150) NOT NULL DEFAULT 'Manual Line' AFTER `router_id`",
        'type' => "ALTER TABLE `network_lines` ADD COLUMN `type` varchar(50) NOT NULL DEFAULT 'manual' AFTER `name`",
        'path' => "ALTER TABLE `network_lines` ADD COLUMN `path` longtext NOT NULL AFTER `type`",
        'color' => "ALTER TABLE `network_lines` ADD COLUMN `color` varchar(20) DEFAULT '#3b82f6' AFTER `path`",
        'created_at' => "ALTER TABLE `network_lines` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp()",
        'updated_at' => "ALTER TABLE `network_lines` ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()",
    ];

    foreach ($columns as $column => $alterSql) {
        if (!table_has_column($conn, 'network_lines', $column)) {
            if (!$conn->query($alterSql)) {
                // Jika kolom ternyata sudah ada (race/metadata cache), abaikan.
                if ((int)$conn->errno !== 1060) {
                    throw new Exception($conn->error ?: "Gagal menambah kolom $column");
                }
            }
        }
    }

    $idx = $conn->query("SHOW INDEX FROM `network_lines` WHERE Key_name = 'idx_router_id'");
    if ($idx && $idx->num_rows === 0) {
        @$conn->query("ALTER TABLE `network_lines` ADD KEY `idx_router_id` (`router_id`)");
    }
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh mengubah network map.');
}

try {
    ensure_network_lines_table($conn);

    switch ($method) {
        case 'GET':
            $router_id = $_GET['router_id'] ?? '';
            if (!$router_id) throw new Exception('router_id wajib');

            // Network map lama bisa menyimpan router_id sebagai numeric id atau software_id.
            // Frontend fetch numeric id, sedangkan saat save bisa pakai software_id.
            $router_keys = [$router_id];
            $stmtR = $conn->prepare('SELECT id, software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
            if ($stmtR) {
                $stmtR->bind_param('ss', $router_id, $router_id);
                $stmtR->execute();
                $resR = $stmtR->get_result();
                if ($rowR = $resR->fetch_assoc()) {
                    if (!empty($rowR['id'])) $router_keys[] = (string)$rowR['id'];
                    if (!empty($rowR['software_id'])) $router_keys[] = (string)$rowR['software_id'];
                }
                $stmtR->close();
            }
            $router_keys = array_values(array_unique(array_filter($router_keys, function ($v) { return $v !== ''; })));
            $placeholders = implode(',', array_fill(0, count($router_keys), '?'));
            $types = str_repeat('s', count($router_keys));

            $stmt = $conn->prepare("SELECT * FROM network_lines WHERE router_id IN ($placeholders) ORDER BY id ASC");
            if (!$stmt) throw new Exception($conn->error);
            $stmt->bind_param($types, ...$router_keys);
            $stmt->execute();
            $res = $stmt->get_result();
            $data = [];
            while ($row = $res->fetch_assoc()) {
                $decoded = json_decode($row['path'] ?? '[]', true);
                $row['path'] = is_array($decoded) ? $decoded : [];
                $data[] = $row;
            }
            $stmt->close();
            echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || empty($input['router_id']) || empty($input['path']) || !is_array($input['path'])) {
                throw new Exception('Data tidak lengkap');
            }
            $normalizedPath = [];
            foreach ($input['path'] as $point) {
                if (!is_array($point) || !isset($point['lat'], $point['lng'])) {
                    throw new Exception('Format path tidak valid');
                }
                $lat = (float)$point['lat'];
                $lng = (float)$point['lng'];
                if (abs($lat) > 90 || abs($lng) > 180) {
                    throw new Exception('Koordinat path tidak valid');
                }
                $normalizedPath[] = ['lat' => $lat, 'lng' => $lng];
            }
            if (count($normalizedPath) < 2) {
                throw new Exception('Path minimal harus berisi 2 titik');
            }

            $routerId = (string)$input['router_id'];
            $stmtR = $conn->prepare('SELECT software_id FROM mikrotik_routers WHERE id = ? OR software_id = ? LIMIT 1');
            if ($stmtR) {
                $stmtR->bind_param('ss', $routerId, $routerId);
                $stmtR->execute();
                $rowR = $stmtR->get_result()->fetch_assoc();
                if (!empty($rowR['software_id'])) $routerId = (string)$rowR['software_id'];
                $stmtR->close();
            }

            $name = $input['name'] ?? 'Manual Line';
            $type = $input['type'] ?? 'manual';
            $color = $input['color'] ?? '#3b82f6';
            $path = json_encode($normalizedPath, JSON_UNESCAPED_UNICODE);
            $stmt = $conn->prepare('INSERT INTO network_lines (router_id, name, type, path, color) VALUES (?, ?, ?, ?, ?)');
            if (!$stmt) throw new Exception($conn->error);
            $stmt->bind_param('sssss', $routerId, $name, $type, $path, $color);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'id' => $conn->insert_id], JSON_UNESCAPED_UNICODE);
            break;

        case 'DELETE':
            $id = intval($_GET['id'] ?? 0);
            if ($id <= 0) throw new Exception('ID tidak valid');
            $stmt = $conn->prepare('DELETE FROM network_lines WHERE id = ?');
            if (!$stmt) throw new Exception($conn->error);
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
