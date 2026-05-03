<?php
/**
 * Finance Report API
 * Menyediakan data untuk modul laporan keuangan lengkap
 *
 * Actions:
 *   profile_revenue   → revenue per paket/profile bulan ini atau range tertentu
 *   recent_payments   → transaksi pembayaran terbaru
 *   receivable        → daftar piutang (belum bayar) + hitung bulan nunggak
 *   annual_report     → laporan per bulan dalam 1 tahun
 *   monthly_kpi       → KPI bulan ini vs bulan lalu
 */

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

$action    = trim($_GET['action'] ?? '');
$router_id = trim($_GET['router_id'] ?? '');
$year      = intval($_GET['year'] ?? date('Y'));
$month     = max(1, min(12, intval($_GET['month'] ?? date('n'))));
$limit     = max(5, intval($_GET['limit'] ?? 10));

if (empty($router_id)) {
    echo json_encode(['success' => false, 'message' => 'Parameter router_id wajib']);
    exit;
}

// Frontend kadang mengirim id numeric router. Normalisasi ke software_id karena tabel users/payments memakai software_id.
$stmtRouter = $conn->prepare("SELECT software_id FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
$stmtRouter->bind_param('ss', $router_id, $router_id);
$stmtRouter->execute();
if ($routerRow = $stmtRouter->get_result()->fetch_assoc()) {
    if (!empty($routerRow['software_id'])) {
        $router_id = $routerRow['software_id'];
    }
}
$stmtRouter->close();

try {
    switch ($action) {

        // ── KPI Bulan Ini vs Bulan Lalu ──────────────────────────────────────
        case 'monthly_kpi':
            // Hitung bulan lalu
            $prevMonth = $month === 1 ? 12 : $month - 1;
            $prevYear  = $month === 1 ? $year - 1 : $year;

            $getMonthData = function ($m, $y) use ($conn, $router_id) {
                $stmt = $conn->prepare("
                    SELECT
                        COUNT(DISTINCT u.id) as total_customers,
                        SUM(IF(p.id IS NOT NULL, 1, 0)) as paid_count,
                        SUM(IF(p.id IS NULL, 1, 0)) as unpaid_count,
                        IFNULL(SUM(p.amount), 0) as revenue,
                        IFNULL(SUM(CASE WHEN p.id IS NULL THEN IFNULL(pr.price, 0) ELSE 0 END), 0) as receivable
                    FROM users u
                    LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
                    LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                    WHERE u.router_id = ?
                ");
                $stmt->bind_param("iis", $m, $y, $router_id);
                $stmt->execute();
                $row = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                return $row;
            };

            $current  = $getMonthData($month, $year);
            $previous = $getMonthData($prevMonth, $prevYear);

            echo json_encode([
                'success' => true,
                'current' => $current,
                'previous' => $previous,
                'month' => $month,
                'year' => $year,
            ], JSON_UNESCAPED_UNICODE);
            break;

        // ── Revenue Per Profile/Paket ─────────────────────────────────────────
        case 'profile_revenue':
            $stmt = $conn->prepare("
                SELECT
                    u.profile,
                    COUNT(DISTINCT u.id) as total_users,
                    SUM(IF(p.id IS NOT NULL, 1, 0)) as paid_count,
                    IFNULL(SUM(p.amount), 0) as revenue,
                    IFNULL(MAX(pr.price), 0) as price_per_user
                FROM users u
                LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
                LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                WHERE u.router_id = ? AND u.profile IS NOT NULL AND u.profile != ''
                GROUP BY u.profile
                ORDER BY revenue DESC
            ");
            $stmt->bind_param("iis", $month, $year, $router_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $data = [];
            while ($row = $result->fetch_assoc()) $data[] = $row;
            $stmt->close();

            echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
            break;

        // ── Transaksi Terbaru ─────────────────────────────────────────────────
        case 'recent_payments':
            $stmt = $conn->prepare("
                SELECT p.id, p.amount, p.payment_date, p.method, p.note,
                       p.payment_month, p.payment_year,
                       u.username, u.alamat, u.profile
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE p.router_id = ?
                ORDER BY p.payment_date DESC, p.id DESC
                LIMIT ?
            ");
            $stmt->bind_param("si", $router_id, $limit);
            $stmt->execute();
            $result = $stmt->get_result();
            $data = [];
            while ($row = $result->fetch_assoc()) $data[] = $row;
            $stmt->close();

            echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
            break;

        // ── Daftar Piutang (Belum Bayar) ─────────────────────────────────────
        case 'receivable':
            $page    = max(1, intval($_GET['page'] ?? 1));
            $perPage = max(5, intval($_GET['per_page'] ?? 20));
            $offset  = ($page - 1) * $perPage;
            $search  = trim($_GET['search'] ?? '');
            $profile = trim($_GET['profile'] ?? '');

            $where  = ["u.router_id = ?", "p.id IS NULL"];
            $params = [$router_id];
            $types  = "s";

            if ($search !== '') {
                $where[] = "(u.username LIKE ? OR u.alamat LIKE ?)";
                $like = "%$search%";
                $params = array_merge($params, [$like, $like]);
                $types .= "ss";
            }
            if ($profile !== '') {
                $where[] = "u.profile = ?";
                $params[] = $profile;
                $types .= "s";
            }

            $whereSQL = "WHERE " . implode(" AND ", $where);

            // Total
            $cntSQL = "SELECT COUNT(*) as total,
                              IFNULL(SUM(IFNULL(pr.price, 0)), 0) as total_receivable
                       FROM users u
                       LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
                       LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                       $whereSQL";
            $allParams = array_merge([$month, $year], $params);
            $allTypes  = "ii" . $types;
            $cntStmt   = $conn->prepare($cntSQL);
            $cntStmt->bind_param($allTypes, ...$allParams);
            $cntStmt->execute();
            $cnt = $cntStmt->get_result()->fetch_assoc();
            $cntStmt->close();

            // Data
            $dataSQL = "SELECT u.id, u.username, u.alamat, u.profile, u.tanggal_tagihan,
                               IFNULL(pr.price, 0) as harga,
                               -- Hitung berapa bulan nunggak (cek 6 bulan ke belakang)
                               (SELECT COUNT(*) FROM (
                                   SELECT 1 FROM payments p2
                                   WHERE p2.user_id = u.id
                                   AND p2.router_id = u.router_id
                                   AND (p2.payment_year * 12 + p2.payment_month) >= (? * 12 + ? - 5)
                                   AND (p2.payment_year * 12 + p2.payment_month) <= (? * 12 + ?)
                               ) sub) as months_paid,
                               6 - (SELECT COUNT(*) FROM payments p2 WHERE p2.user_id = u.id AND p2.router_id = u.router_id
                                    AND (p2.payment_year * 12 + p2.payment_month) >= (? * 12 + ? - 5)
                                    AND (p2.payment_year * 12 + p2.payment_month) <= (? * 12 + ?)) as months_overdue
                        FROM users u
                        LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
                        LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                        $whereSQL
                        ORDER BY months_overdue DESC, u.username ASC
                        LIMIT ? OFFSET ?";

            $dataParams = array_merge(
                [$year, $month, $year, $month, $year, $month, $year, $month],
                [$month, $year],
                $params,
                [$perPage, $offset]
            );
            $dataTypes = "iiiiiiii" . "ii" . $types . "ii";
            $dataStmt = $conn->prepare($dataSQL);
            $dataStmt->bind_param($dataTypes, ...$dataParams);
            $dataStmt->execute();
            $result = $dataStmt->get_result();
            $data = [];
            while ($row = $result->fetch_assoc()) $data[] = $row;
            $dataStmt->close();

            $profileStmt = $conn->prepare("SELECT DISTINCT profile FROM users WHERE router_id = ? AND profile IS NOT NULL AND profile != '' ORDER BY profile ASC");
            $profileStmt->bind_param('s', $router_id);
            $profileStmt->execute();
            $profileRes = $profileStmt->get_result();
            $profiles = [];
            while ($p = $profileRes->fetch_assoc()) {
                $profiles[] = $p['profile'];
            }
            $profileStmt->close();

            echo json_encode([
                'success'          => true,
                'data'             => $data,
                'total'            => (int)($cnt['total'] ?? 0),
                'total_receivable' => (float)($cnt['total_receivable'] ?? 0),
                'page'             => $page,
                'per_page'         => $perPage,
                'month'            => $month,
                'year'             => $year,
                'profiles'         => $profiles,
            ], JSON_UNESCAPED_UNICODE);
            break;

        // ── Export Piutang CSV ───────────────────────────────────────────────
        case 'receivable_export':
            $search  = trim($_GET['search'] ?? '');
            $profile = trim($_GET['profile'] ?? '');

            $where  = ["u.router_id = ?", "p.id IS NULL"];
            $params = [$router_id];
            $types  = "s";

            if ($search !== '') {
                $where[] = "(u.username LIKE ? OR u.alamat LIKE ? OR u.wa LIKE ?)";
                $like = "%$search%";
                $params = array_merge($params, [$like, $like, $like]);
                $types .= "sss";
            }
            if ($profile !== '') {
                $where[] = "u.profile = ?";
                $params[] = $profile;
                $types .= "s";
            }

            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment;filename="piutang_'.$year.'_'.$month.'.csv"');
            $output = fopen('php://output', 'w');
            fputcsv($output, ['Username', 'Profile', 'WA', 'Alamat', 'Tanggal Tagihan', 'Nominal Piutang']);

            $sql = "SELECT u.username, u.profile, u.wa, u.alamat, u.tanggal_tagihan, IFNULL(pr.price, 0) as harga
                    FROM users u
                    LEFT JOIN payments p ON p.user_id = u.id AND p.payment_month = ? AND p.payment_year = ? AND p.router_id = u.router_id
                    LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                    WHERE " . implode(" AND ", $where) . "
                    ORDER BY u.username ASC";
            $stmt = $conn->prepare($sql);
            $allParams = array_merge([$month, $year], $params);
            $allTypes = "ii" . $types;
            $stmt->bind_param($allTypes, ...$allParams);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                fputcsv($output, [$row['username'], $row['profile'], $row['wa'], $row['alamat'], $row['tanggal_tagihan'], $row['harga']]);
            }
            fclose($output);
            exit;

        // ── Laporan Tahunan (Per Bulan) ───────────────────────────────────────
        case 'annual_report':
            $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            $monthsFull = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
            $data = [];

            // Total pelanggan aktif saat ini sebagai basis
            $totalStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM users WHERE router_id = ?");
            $totalStmt->bind_param("s", $router_id);
            $totalStmt->execute();
            $totalUsers = (int)($totalStmt->get_result()->fetch_assoc()['cnt'] ?? 0);
            $totalStmt->close();

            for ($m = 1; $m <= 12; $m++) {
                $stmt = $conn->prepare("
                    SELECT
                        COUNT(DISTINCT p.user_id) as paid_count,
                        IFNULL(SUM(p.amount), 0) as revenue
                    FROM payments p
                    WHERE p.router_id = ? AND p.payment_month = ? AND p.payment_year = ?
                ");
                $stmt->bind_param("sii", $router_id, $m, $year);
                $stmt->execute();
                $row = $stmt->get_result()->fetch_assoc();
                $stmt->close();

                $paid    = (int)($row['paid_count'] ?? 0);
                $revenue = (float)($row['revenue'] ?? 0);

                $data[] = [
                    'month'        => $m,
                    'month_short'  => $monthNames[$m - 1],
                    'month_name'   => $monthsFull[$m - 1],
                    'paid'         => $paid,
                    'unpaid'       => max(0, $totalUsers - $paid),
                    'total'        => $totalUsers,
                    'revenue'      => $revenue,
                    'collection_rate' => $totalUsers > 0 ? round(($paid / $totalUsers) * 100, 1) : 0,
                ];
            }

            // YTD (Year to Date - hanya sampai bulan saat ini)
            $ytd = array_reduce(
                array_slice($data, 0, intval(date('n'))),
                fn($carry, $item) => $carry + $item['revenue'],
                0
            );

            echo json_encode([
                'success'     => true,
                'data'        => $data,
                'year'        => $year,
                'total_users' => $totalUsers,
                'ytd_revenue' => $ytd,
            ], JSON_UNESCAPED_UNICODE);
            break;

        default:
            echo json_encode(['success' => false, 'message' => "Action '$action' tidak dikenal"]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
