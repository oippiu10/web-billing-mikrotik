<?php
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';
require_once __DIR__ . '/auth/activity_log.php';
require_once __DIR__ . '/router_id_helper.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'], 'Akses inventory ditolak.');

function ensure_inventory_tables(mysqli $conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Lainnya',
        stock INT NOT NULL DEFAULT 0,
        unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
        price DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_router_category (router_id, category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        router_id INT NOT NULL DEFAULT 0,
        inventory_id INT NOT NULL,
        type ENUM('in','out','adjust') NOT NULL,
        qty INT NOT NULL DEFAULT 0,
        note VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory (inventory_id),
        INDEX idx_router_created (router_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function input_json(): array {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

ensure_inventory_tables($conn);
$router_id = requireRouterIdFromGet($conn);
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        $stmt = $conn->prepare("SELECT *, (stock * price) AS asset_value FROM inventory WHERE router_id = ? ORDER BY category, name");
        $stmt->bind_param("i", $router_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $items = [];
        $totalValue = 0;
        $lowStock = 0;
        while ($row = $res->fetch_assoc()) {
            $row['stock'] = (int)$row['stock'];
            $row['price'] = (float)$row['price'];
            $row['asset_value'] = (float)$row['asset_value'];
            $totalValue += $row['asset_value'];
            if ($row['stock'] <= 3) $lowStock++;
            $items[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $items, 'summary' => ['total_items' => count($items), 'total_value' => $totalValue, 'low_stock' => $lowStock]]);
        break;

    case 'add':
        require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Hanya admin yang boleh menambah inventory.');
        $data = input_json();
        $name = trim($data['name'] ?? '');
        if ($name === '') throw new Exception('Nama barang wajib diisi');
        $category = trim($data['category'] ?? 'Lainnya');
        $stock = intval($data['stock'] ?? 0);
        $unit = trim($data['unit'] ?? 'pcs');
        $price = floatval($data['price'] ?? 0);
        $description = trim($data['description'] ?? '');
        $stmt = $conn->prepare("INSERT INTO inventory (router_id, name, category, stock, unit, price, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("issisds", $router_id, $name, $category, $stock, $unit, $price, $description);
        $ok = $stmt->execute();
        if ($ok) log_admin_activity($conn, 'inventory_add', 'Tambah item inventory: ' . $name, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => $ok, 'message' => $ok ? 'Item berhasil ditambah' : $conn->error]);
        break;

    case 'movement':
        require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'], 'Akses mutasi ditolak.');
        $data = input_json();
        $id = intval($data['id'] ?? 0);
        $type = $data['type'] ?? 'in';
        $qty = max(1, intval($data['qty'] ?? 1));
        $note = trim($data['note'] ?? '');
        if (!in_array($type, ['in', 'out', 'adjust'], true)) throw new Exception('Tipe mutasi tidak valid');

        $stmt = $conn->prepare("SELECT stock, name FROM inventory WHERE id=? AND router_id=?");
        $stmt->bind_param("ii", $id, $router_id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        if (!$item) throw new Exception('Item tidak ditemukan');

        $newStock = (int)$item['stock'];
        if ($type === 'in') $newStock += $qty;
        elseif ($type === 'out') $newStock = max(0, $newStock - $qty);
        else $newStock = $qty;

        $conn->begin_transaction();
        $stmt = $conn->prepare("UPDATE inventory SET stock=? WHERE id=? AND router_id=?");
        $stmt->bind_param("iii", $newStock, $id, $router_id);
        $stmt->execute();
        $adminId = (int)($_SESSION['admin_id'] ?? 0);
        $stmt = $conn->prepare("INSERT INTO inventory_movements (router_id, inventory_id, type, qty, note, created_by) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("iisisi", $router_id, $id, $type, $qty, $note, $adminId);
        $stmt->execute();
        $conn->commit();
        log_admin_activity($conn, 'inventory_movement', "Mutasi inventory {$item['name']} {$type} {$qty}", $adminId);
        echo json_encode(['success' => true, 'message' => 'Mutasi berhasil disimpan', 'stock' => $newStock]);
        break;

    case 'delete':
        require_admin_role(['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'], 'Hanya admin yang boleh menghapus inventory.');
        $data = input_json();
        $id = intval($data['id'] ?? 0);
        $stmt = $conn->prepare("DELETE FROM inventory WHERE id=? AND router_id=?");
        $stmt->bind_param("ii", $id, $router_id);
        $ok = $stmt->execute();
        if ($ok) log_admin_activity($conn, 'inventory_delete', 'Hapus item inventory ID: ' . $id, (int)($_SESSION['admin_id'] ?? 0));
        echo json_encode(['success' => $ok, 'message' => $ok ? 'Item berhasil dihapus' : $conn->error]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Aksi tidak valid']);
}
?>
