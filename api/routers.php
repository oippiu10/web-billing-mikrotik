<?php
/**
 * Routers API — CRUD konfigurasi Mikrotik router
 * GET    → list semua router (+ jumlah pelanggan dari DB)
 * POST   → tambah router baru (otomatis fetch software_id dari MikroTik)
 * PUT    → update router (otomatis fetch software_id jika credentials berubah)
 * DELETE → hapus router (id di query string)
 * PATCH  → set router aktif (id di body)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/routerosAPI.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang boleh mengubah router.');
}

/**
 * Konek ke MikroTik dan ambil Software ID dari /system/license/print
 * Return string software_id atau null jika gagal
 */
function fetchSoftwareId(string $host, int $port, string $username, string $password): ?string {
    try {
        $api          = new RouterosAPI();
        $api->port    = $port;
        $api->timeout = 8;
        if (!$api->connect($host, $username, $password)) {
            return null;
        }
        $license = $api->comm('/system/license/print');
        $api->disconnect();
        if (is_array($license) && !empty($license)) {
            return $license[0]['software-id'] ?? null;
        }
        return null;
    } catch (Exception $e) {
        return null;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        // ===================================
        // GET — List semua router + jumlah pelanggan dari DB
        // ===================================
        case 'GET':
            // Kita ambil data router dulu
            $sql = "SELECT id, name, host, port, username, software_id, is_active, sort_order, lat, lng FROM mikrotik_routers ORDER BY sort_order ASC, id ASC";
            $res = $conn->query($sql);
            if (!$res) {
                throw new Exception("Query error (routers): " . $conn->error);
            }

            $routers = [];
            while ($row = $res->fetch_assoc()) {
                $sid = $row['software_id'];
                $total = 0;
                
                // Ambil jumlah pelanggan per router secara terpisah agar query aman dari GROUP BY issues
                if ($sid) {
                    $cStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM users WHERE router_id = ?");
                    $cStmt->bind_param("s", $sid);
                    $cStmt->execute();
                    $cRes = $cStmt->get_result()->fetch_assoc();
                    $total = (int) ($cRes['cnt'] ?? 0);
                    $cStmt->close();
                }

                $row['total_customers'] = $total;
                $routers[] = $row;
            }
            echo json_encode(['success' => true, 'data' => $routers]);
            break;

        // ===================================
        // POST — Tambah router baru (upsert jika host+port sudah ada)
        // ===================================
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || empty($input['host'])) {
                echo json_encode(['success' => false, 'message' => 'Host wajib diisi']);
                exit();
            }

            $name     = $input['name'] ?? '';
            $host     = $input['host'];
            $port     = intval($input['port'] ?? 8728);
            $username = $input['username'] ?? 'admin';
            $password = $input['password'] ?? '';

            // Otomatis ambil Software ID dari MikroTik
            $software_id = fetchSoftwareId($host, $port, $username, $password);

            // Cek apakah data pelanggan dengan software_id ini sudah ada di DB
            $existingCustomers = 0;
            if ($software_id) {
                $chk = $conn->prepare("SELECT COUNT(*) as cnt FROM users WHERE router_id = ?");
                $chk->bind_param("s", $software_id);
                $chk->execute();
                $existingCustomers = (int) $chk->get_result()->fetch_assoc()['cnt'];
                $chk->close();
            }

            // --- Upsert: jika host+port sudah ada, UPDATE saja (tidak error) ---
            $dup = $conn->prepare("SELECT id FROM mikrotik_routers WHERE host = ? AND port = ?");
            $dup->bind_param("si", $host, $port);
            $dup->execute();
            $dupRow = $dup->get_result()->fetch_assoc();
            $dup->close();

            if ($dupRow) {
                // Router sudah ada → update nama, credentials, software_id
                $existingId = $dupRow['id'];
                $updStmt = $conn->prepare("UPDATE mikrotik_routers SET name=?, username=?, password=?, software_id=?, lat=?, lng=? WHERE id=?");
                $updStmt->bind_param("ssssddi", $name, $username, $password, $software_id, $input['lat'], $input['lng'], $existingId);
                $updStmt->execute();
                $updStmt->close();

                $msg = $software_id
                    ? "Router sudah ada dan berhasil diperbarui! (Software ID: $software_id, $existingCustomers pelanggan ditemukan)"
                    : "Router diperbarui. Software ID tidak dapat diambil, pastikan router dapat diakses.";

                echo json_encode([
                    'success'            => true,
                    'message'            => $msg,
                    'id'                 => $existingId,
                    'software_id'        => $software_id,
                    'existing_customers' => $existingCustomers,
                    'updated'            => true,
                ]);
                break;
            }

            // Cek apakah ini router pertama → otomatis set aktif
            $countResult = $conn->query("SELECT COUNT(*) as cnt FROM mikrotik_routers");
            $count       = $countResult->fetch_assoc()['cnt'];
            $isActive    = ($count == 0) ? 1 : 0;

            $stmt = $conn->prepare("INSERT INTO mikrotik_routers (name, host, port, username, password, software_id, is_active, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssisssidd", $name, $host, $port, $username, $password, $software_id, $isActive, $input['lat'], $input['lng']);
            $stmt->execute();
            $newId = $conn->insert_id;

            $msg = $software_id
                ? "Router berhasil ditambahkan! (Software ID: $software_id, $existingCustomers pelanggan ditemukan)"
                : "Router ditambahkan, namun Software ID tidak dapat diambil. Pastikan router dapat diakses.";

            echo json_encode([
                'success'            => true,
                'message'            => $msg,
                'id'                 => $newId,
                'software_id'        => $software_id,
                'existing_customers' => $existingCustomers,
                'updated'            => false,
            ]);
            break;

        // ===================================
        // PUT — Update router
        // ===================================
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id'])) {
                echo json_encode(['success' => false, 'message' => 'ID router wajib']);
                exit();
            }

            $id       = intval($input['id']);
            $name     = $input['name'] ?? '';
            $host     = $input['host'] ?? '';
            $port     = intval($input['port'] ?? 8728);
            $username = $input['username'] ?? 'admin';
            $password = $input['password'] ?? '';

            // Ambil password lama jika tidak diisi
            $oldRow = $conn->prepare("SELECT password, software_id FROM mikrotik_routers WHERE id = ?");
            $oldRow->bind_param("i", $id);
            $oldRow->execute();
            $oldData   = $oldRow->get_result()->fetch_assoc();
            $oldRow->close();

            $finalPass = !empty($password) ? $password : ($oldData['password'] ?? '');

            // Ambil ulang software_id dari MikroTik
            $software_id = fetchSoftwareId($host, $port, $username, $finalPass);

            // Jika gagal konek, pertahankan software_id lama
            if (!$software_id) {
                $software_id = $oldData['software_id'] ?? null;
            }

            // Cek data pelanggan yang cocok
            $existingCustomers = 0;
            if ($software_id) {
                $chk = $conn->prepare("SELECT COUNT(*) as cnt FROM users WHERE router_id = ?");
                $chk->bind_param("s", $software_id);
                $chk->execute();
                $existingCustomers = (int) $chk->get_result()->fetch_assoc()['cnt'];
                $chk->close();
            }

            if (!empty($password)) {
                $stmt = $conn->prepare("UPDATE mikrotik_routers SET name=?, host=?, port=?, username=?, password=?, software_id=?, lat=?, lng=? WHERE id=?");
                $stmt->bind_param("ssisssddi", $name, $host, $port, $username, $finalPass, $software_id, $input['lat'], $input['lng'], $id);
            } else {
                $stmt = $conn->prepare("UPDATE mikrotik_routers SET name=?, host=?, port=?, username=?, software_id=?, lat=?, lng=? WHERE id=?");
                $stmt->bind_param("ssissddi", $name, $host, $port, $username, $software_id, $input['lat'], $input['lng'], $id);
            }
            $stmt->execute();

            $msg = $software_id
                ? "Router berhasil diupdate (Software ID: $software_id, $existingCustomers pelanggan ditemukan)"
                : "Router diupdate, namun Software ID tidak dapat diambil dari router.";

            echo json_encode([
                'success'            => true,
                'message'            => $msg,
                'software_id'        => $software_id,
                'existing_customers' => $existingCustomers,
            ]);
            break;

        // ===================================
        // DELETE — Hapus router
        // ===================================
        case 'DELETE':
            $id = intval($_GET['id'] ?? 0);
            if ($id <= 0) {
                echo json_encode(['success' => false, 'message' => 'ID router wajib']);
                exit();
            }

            $stmt = $conn->prepare("DELETE FROM mikrotik_routers WHERE id=?");
            $stmt->bind_param("i", $id);
            $stmt->execute();

            echo json_encode(['success' => true, 'message' => 'Router berhasil dihapus']);
            break;

        // ===================================
        // PATCH — Set router aktif
        // ===================================
        case 'PATCH':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id'])) {
                echo json_encode(['success' => false, 'message' => 'ID router wajib']);
                exit();
            }

            $id = intval($input['id']);

            // Reset semua → set satu yang dipilih
            $conn->query("UPDATE mikrotik_routers SET is_active = 0");
            $stmt = $conn->prepare("UPDATE mikrotik_routers SET is_active = 1 WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();

            echo json_encode(['success' => true, 'message' => 'Router aktif diubah']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>