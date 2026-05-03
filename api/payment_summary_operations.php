<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=UTF-8');

$action = $_GET['action'] ?? '';
$year = intval($_GET['year'] ?? date('Y'));
$router_id = $_GET['router_id'] ?? ''; // Opsional: jika kosong, ambil global

switch ($action) {
    case 'yearly':
        $months = [];
        $monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        for ($m = 1; $m <= 12; $m++) {
            // 1. Ambil Pendapatan (Payments)
            $sqlPay = "SELECT SUM(amount) as revenue, COUNT(DISTINCT user_id) as paid_count 
                       FROM payments 
                       WHERE payment_month = ? AND payment_year = ?";
            if (!empty($router_id))
                $sqlPay .= " AND router_id = '" . $conn->real_escape_string($router_id) . "'";

            $stmtPay = $conn->prepare($sqlPay);
            $stmtPay->bind_param("ii", $m, $year);
            $stmtPay->execute();
            $resPay = $stmtPay->get_result()->fetch_assoc();
            $revenue = floatval($resPay['revenue'] ?? 0);
            $paidCount = intval($resPay['paid_count'] ?? 0);

            // 2. Ambil Pengeluaran (Expenses)
            $sqlExp = "SELECT SUM(amount) as expense 
                       FROM expenses 
                       WHERE MONTH(spent_at) = ? AND YEAR(spent_at) = ?";
            if (!empty($router_id))
                $sqlExp .= " AND router_id = '" . $conn->real_escape_string($router_id) . "'";

            $stmtExp = $conn->prepare($sqlExp);
            $stmtExp->bind_param("ii", $m, $year);
            $stmtExp->execute();
            $resExp = $stmtExp->get_result()->fetch_assoc();
            $expense = floatval($resExp['expense'] ?? 0);

            // 3. Ambil Total Pelanggan (Target) - Estimasi dari tabel users
            // (Tabel users adalah sync dari ppp secret)
            $sqlUsers = "SELECT COUNT(*) as total FROM users";
            if (!empty($router_id))
                $sqlUsers .= " WHERE router_id = '" . $conn->real_escape_string($router_id) . "'";
            $resUsers = $conn->query($sqlUsers)->fetch_assoc();
            $totalUsers = intval($resUsers['total'] ?? 0);

            $months[] = [
                'month' => $m,
                'month_name' => $monthNames[$m - 1],
                'revenue' => $revenue,
                'expense' => $expense,
                'profit' => $revenue - $expense,
                'paid' => $paidCount,
                'unpaid' => max(0, $totalUsers - $paidCount),
                'total' => $totalUsers,
                'new_users' => 0 // Sementara 0, perlu tabel logs/history untuk akurasi
            ];
        }

        echo json_encode(['success' => true, 'data' => $months]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Action tidak valid']);
}

$conn->close();
