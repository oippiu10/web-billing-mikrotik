<?php
/**
 * ODP API — CRUD Manajemen ODP
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh mengubah ODP.');
}

try {
    switch ($method) {
        case 'GET':
            $router_id = $_GET['router_id'] ?? '';
            if (!$router_id) {
                throw new Exception("router_id wajib diisi");
            }

            // Resolve software_id jika numeric ID dikirim
            $stmtR = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
            $stmtR->bind_param("ss", $router_id, $router_id);
            $stmtR->execute();
            $resR = $stmtR->get_result();
            if ($rowR = $resR->fetch_assoc()) {
                if (!empty($rowR['software_id'])) {
                    $router_id = $rowR['software_id'];
                }
            }
            $stmtR->close();

            $sql = "SELECT * FROM odp WHERE router_id = ? ORDER BY name ASC";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("s", $router_id);
            $stmt->execute();
            $res = $stmt->get_result();
            
            $odps = [];
            while ($row = $res->fetch_assoc()) {
                // Hitung jumlah pelanggan di ODP ini (jika odp_id di users menyimpan nama ODP atau ID ODP?)
                // Dari schema users sebelumnya, odp_id adalah int. Jadi dia menyimpan ID ODP.
                $id_odp = $row['id'];
                $uStmt = $conn->prepare("SELECT username, redaman FROM users WHERE odp_id = ?");
                $uStmt->bind_param("i", $id_odp);
                $uStmt->execute();
                $uRes = $uStmt->get_result();
                $users_data = [];
                while($uRow = $uRes->fetch_assoc()) {
                    $users_data[] = [
                        'username' => $uRow['username'],
                        'redaman' => $uRow['redaman'] ?: '-'
                    ];
                }
                $row['total_users'] = count($users_data);
                $row['users_list'] = $users_data;
                $uStmt->close();

                $odps[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $odps]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || empty($input['name']) || empty($input['router_id'])) {
                throw new Exception("Data tidak lengkap (name, router_id wajib)");
            }

            $router_id = $input['router_id'];
            // Resolve software_id
            $stmtR = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
            $stmtR->bind_param("ss", $router_id, $router_id);
            $stmtR->execute();
            $resR = $stmtR->get_result();
            if ($rowR = $resR->fetch_assoc()) {
                if (!empty($rowR['software_id'])) $router_id = $rowR['software_id'];
            }
            $stmtR->close();

            $stmt = $conn->prepare("INSERT INTO odp (router_id, name, location, maps_link, lat, lng, type, splitter_type, ratio_used, ratio_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssddssii", 
                $router_id, 
                $input['name'], 
                $input['location'], 
                $input['maps_link'],
                $input['lat'],
                $input['lng'],
                $input['type'], 
                $input['splitter_type'], 
                $input['ratio_used'], 
                $input['ratio_total']
            );
            $stmt->execute();
            echo json_encode(['success' => true, 'id' => $conn->insert_id]);
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || empty($input['id'])) {
                throw new Exception("ID ODP wajib");
            }

            $stmt = $conn->prepare("UPDATE odp SET name=?, location=?, maps_link=?, lat=?, lng=?, type=?, splitter_type=?, ratio_used=?, ratio_total=? WHERE id=?");
            $stmt->bind_param("ssssdssiii", 
                $input['name'], 
                $input['location'], 
                $input['maps_link'], 
                $input['lat'],
                $input['lng'],
                $input['type'], 
                $input['splitter_type'], 
                $input['ratio_used'], 
                $input['ratio_total'],
                $input['id']
            );
            $stmt->execute();
            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            $id = intval($_GET['id'] ?? 0);
            if ($id <= 0) throw new Exception("ID tidak valid");

            $stmt = $conn->prepare("DELETE FROM odp WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
