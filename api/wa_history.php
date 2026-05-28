<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Proteksi akses untuk admin/operator
require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak.');

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        // ── 1. AMBIL DAFTAR RIWAYAT PESAN ──────────────────────────────────────
        case 'get_logs':
            $status = trim($_GET['status'] ?? 'all');
            $search = trim($_GET['search'] ?? '');
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $offset = ($page - 1) * $limit;

            $whereClauses = [];
            $params = [];
            $types = "";

            if ($status !== 'all') {
                $whereClauses[] = "status = ?";
                $params[] = $status;
                $types .= "s";
            }

            if ($search !== '') {
                $whereClauses[] = "(phone LIKE ? OR message LIKE ? OR error_message LIKE ?)";
                $searchWildcard = "%" . $search . "%";
                $params[] = $searchWildcard;
                $params[] = $searchWildcard;
                $params[] = $searchWildcard;
                $types .= "sss";
            }

            $whereSql = "";
            if (count($whereClauses) > 0) {
                $whereSql = "WHERE " . implode(" AND ", $whereClauses);
            }

            // Hitung total baris untuk pagination
            $countQuery = "SELECT COUNT(*) as total FROM wa_queue $whereSql";
            if (count($params) > 0) {
                $countStmt = $conn->prepare($countQuery);
                $countStmt->bind_param($types, ...$params);
                $countStmt->execute();
                $countRes = $countStmt->get_result()->fetch_assoc();
                $countStmt->close();
            } else {
                $countRes = $conn->query($countQuery)->fetch_assoc();
            }
            $totalRows = (int)($countRes['total'] ?? 0);
            $totalPages = ceil($totalRows / $limit);

            // Ambil data riwayat pesan urut dari terbaru
            $query = "SELECT * FROM wa_queue $whereSql ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            $types .= "ii";

            $stmt = $conn->prepare($query);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $logs = [];
            while ($row = $result->fetch_assoc()) {
                $logs[] = $row;
            }
            $stmt->close();

            // Hitung ringkasan statistik
            $statsRes = $conn->query("SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM wa_queue
            ")->fetch_assoc();

            echo json_encode([
                'success' => true,
                'data' => $logs,
                'pagination' => [
                    'total_rows' => $totalRows,
                    'total_pages' => $totalPages,
                    'current_page' => $page,
                    'limit' => $limit
                ],
                'stats' => [
                    'total' => (int)($statsRes['total'] ?? 0),
                    'sent' => (int)($statsRes['sent'] ?? 0),
                    'pending' => (int)($statsRes['pending'] ?? 0),
                    'failed' => (int)($statsRes['failed'] ?? 0)
                ]
            ]);
            break;

        // ── 2. KIRIM PESAN CEPAT INSTAN (QUICK SEND) ───────────────────────────
        case 'send_quick':
            $data = json_decode(file_get_contents('php://input'), true);
            $phone = trim($data['phone'] ?? '');
            $message = trim($data['message'] ?? '');

            if ($phone === '' || $message === '') {
                echo json_encode(['success' => false, 'message' => 'Nomor HP (phone) dan pesan (message) wajib diisi!']);
                exit;
            }

            // Normalisasi nomor telepon ke format internasional (628...)
            $phone = preg_replace('/[^0-9]/', '', $phone);
            if (strpos($phone, '0') === 0) {
                $phone = '62' . substr($phone, 1);
            }

            // Masukkan pesan ke antrean dengan router_id default 'quick_send'
            $stmt = $conn->prepare("INSERT INTO wa_queue (router_id, phone, message, status, created_at) VALUES ('quick_send', ?, ?, 'pending', NOW())");
            $stmt->bind_param("ss", $phone, $message);
            $stmt->execute();
            $msgId = $stmt->insert_id;
            $stmt->close();

            // Panggil file wa_operations.php secara asinkron untuk memicu pengiriman antrean
            $ch = curl_init();
            // Ambil domain saat ini
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
            $domainName = $_SERVER['HTTP_HOST'];
            // Tentukan URL eksekusi local
            $operationsUrl = $protocol . $domainName . dirname($_SERVER['PHP_SELF']) . '/wa_operations.php?action=process_queue&id=' . $msgId;
            
            curl_setopt_array($ch, [
                CURLOPT_URL => $operationsUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 3, // Timeout pendek agar response cepat selesai
            ]);
            curl_exec($ch);
            curl_close($ch);

            echo json_encode([
                'success' => true,
                'message' => 'Pesan berhasil dimasukkan ke antrean dan sedang diproses pengiriman!',
                'id' => $msgId
            ]);
            break;

        // ── 3. COBA KIRIM ULANG PESAN GAGAL ────────────────────────────────────
        case 'retry_message':
            $data = json_decode(file_get_contents('php://input'), true);
            $msgId = (int)($data['id'] ?? 0);

            if ($msgId <= 0) {
                echo json_encode(['success' => false, 'message' => 'ID pesan tidak valid!']);
                exit;
            }

            // Ubah status ke pending kembali
            $stmt = $conn->prepare("UPDATE wa_queue SET status = 'pending', error_message = NULL, sent_at = NULL WHERE id = ?");
            $stmt->bind_param("i", $msgId);
            $stmt->execute();
            $stmt->close();

            // Pemicu pengiriman antrean secara dinamis
            $ch = curl_init();
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
            $domainName = $_SERVER['HTTP_HOST'];
            $operationsUrl = $protocol . $domainName . dirname($_SERVER['PHP_SELF']) . '/wa_operations.php?action=process_queue&id=' . $msgId;
            
            curl_setopt_array($ch, [
                CURLOPT_URL => $operationsUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 3,
            ]);
            curl_exec($ch);
            curl_close($ch);

            echo json_encode(['success' => true, 'message' => 'Pesan dicoba kirim ulang!']);
            break;

        // ── 4. HAPUS SATU LOG PESAN ───────────────────────────────────────────
        case 'delete_log':
            $data = json_decode(file_get_contents('php://input'), true);
            $msgId = (int)($data['id'] ?? 0);

            if ($msgId <= 0) {
                echo json_encode(['success' => false, 'message' => 'ID pesan tidak valid!']);
                exit;
            }

            $stmt = $conn->prepare("DELETE FROM wa_queue WHERE id = ?");
            $stmt->bind_param("i", $msgId);
            $stmt->execute();
            $stmt->close();

            echo json_encode(['success' => true, 'message' => 'Log pesan berhasil dihapus!']);
            break;

        // ── 5. BERSIHKAN LOG SPESIFIK ──────────────────────────────────────────
        case 'clear_logs':
            $data = json_decode(file_get_contents('php://input'), true);
            $target = trim($data['target'] ?? 'failed'); // 'failed', 'sent', atau 'all'

            if ($target === 'failed') {
                $conn->query("DELETE FROM wa_queue WHERE status = 'failed'");
                $msg = 'Semua log pesan gagal dibersihkan!';
            } elseif ($target === 'sent') {
                $conn->query("DELETE FROM wa_queue WHERE status = 'sent'");
                $msg = 'Semua log pesan terkirim dibersihkan!';
            } elseif ($target === 'all') {
                $conn->query("DELETE FROM wa_queue");
                $msg = 'Seluruh riwayat log pesan dibersihkan!';
            } else {
                echo json_encode(['success' => false, 'message' => 'Target pembersihan tidak dikenali!']);
                exit;
            }

            echo json_encode(['success' => true, 'message' => $msg]);
            break;

        default:
            echo json_encode(['success' => false, 'message' => "Action '$action' tidak dikenali!"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
