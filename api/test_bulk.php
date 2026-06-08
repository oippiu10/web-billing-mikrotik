<?php
header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/config.php';

// Cari 2 user sembarang yang belum lunas bulan ini
$month = intval(date('n'));
$year = intval(date('Y'));

$uRes = $conn->query("SELECT u.id, u.username, u.router_id, IFNULL(pr.price, 0) as price 
                      FROM users u 
                      LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id
                      LIMIT 2");
$users = [];
while ($row = $uRes->fetch_assoc()) {
    $users[] = [
        'user_id' => intval($row['id']),
        'username' => $row['username'],
        'amount' => floatval($row['price'] ?: 100000), // default amount if price null
        'router_id' => $row['router_id']
    ];
}

if (count($users) < 2) {
    echo json_encode(['success' => false, 'message' => 'User tidak cukup untuk testing (butuh minimal 2)']);
    exit;
}

$router_id = $users[0]['router_id'];
$date = date('Y-m-d');
$method = 'cash';
$note = 'TEST BULK';

echo "Memulai uji coba transaksi bulk untuk user: \n";
print_r($users);
echo "\n";

$conn->begin_transaction();
try {
    $uid = 0;
    $amt = 0.0;
    $pid = 0;
    $target_amount = 0.0;

    $checkStmt = $conn->prepare("SELECT id FROM payments WHERE router_id = ? AND user_id = ? AND payment_month = ? AND payment_year = ?");
    if (!$checkStmt) throw new Exception("checkStmt prepare failed: " . $conn->error);
    $checkStmt->bind_param("siii", $router_id, $uid, $month, $year);

    $updStmt = $conn->prepare("UPDATE payments SET amount = ?, payment_date = ?, method = ?, note = ?, target_amount = ? WHERE id = ?");
    if (!$updStmt) throw new Exception("updStmt prepare failed: " . $conn->error);
    $updStmt->bind_param("dsssdi", $amt, $date, $method, $note, $target_amount, $pid);

    $insStmt = $conn->prepare("INSERT INTO payments (router_id, user_id, amount, payment_date, payment_month, payment_year, method, note, target_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$insStmt) throw new Exception("insStmt prepare failed: " . $conn->error);
    $insStmt->bind_param("sidsiissd", $router_id, $uid, $amt, $date, $month, $year, $method, $note, $target_amount);

    $invStmt = $conn->prepare("SELECT amount FROM invoices WHERE user_id = ? AND month = ? AND year = ?");
    if (!$invStmt) throw new Exception("invStmt prepare failed: " . $conn->error);
    $invStmt->bind_param("iii", $uid, $month, $year);

    $profStmt = $conn->prepare("SELECT pr.price FROM users u LEFT JOIN ppp_profile_pricing pr ON pr.profile_name = u.profile AND pr.router_id = u.router_id WHERE u.id = ?");
    if (!$profStmt) throw new Exception("profStmt prepare failed: " . $conn->error);
    $profStmt->bind_param("i", $uid);

    $successCount = 0;
    foreach ($users as $u) {
        $current_uid = intval($u['user_id']);
        $current_amt = floatval($u['amount']);

        $uid = $current_uid;
        $amt = $current_amt;

        echo "Memproses user ID: $uid, Amt: $amt\n";

        if (!$checkStmt->execute()) {
            throw new Exception("checkStmt execute failed: " . $checkStmt->error);
        }
        $res = $checkStmt->get_result();
        $checkData = $res ? $res->fetch_assoc() : null;
        if ($res) $res->free();

        if (!$invStmt->execute()) {
            throw new Exception("invStmt execute failed: " . $invStmt->error);
        }
        $invRes = $invStmt->get_result();
        $invData = $invRes ? $invRes->fetch_assoc() : null;
        if ($invRes) $invRes->free();

        if ($invData) {
            $target_amount = floatval($invData['amount']);
        } else {
            if (!$profStmt->execute()) {
                throw new Exception("profStmt execute failed: " . $profStmt->error);
            }
            $profRes = $profStmt->get_result();
            $profData = $profRes ? $profRes->fetch_assoc() : null;
            if ($profRes) $profRes->free();
            $target_amount = floatval($profData['price'] ?? 0);
        }

        echo "  - CheckData found ID: " . ($checkData ? $checkData['id'] : 'NONE') . "\n";
        echo "  - Target Amount: $target_amount\n";

        if ($checkData) {
            $pid = intval($checkData['id']);
            if (!$updStmt->execute()) {
                throw new Exception("updStmt execute failed: " . $updStmt->error);
            }
            echo "  - UPDATE sukses\n";
        } else {
            if (!$insStmt->execute()) {
                throw new Exception("insStmt execute failed: " . $insStmt->error);
            }
            echo "  - INSERT sukses\n";
        }
        $successCount++;
    }

    $checkStmt->close();
    $updStmt->close();
    $insStmt->close();
    $invStmt->close();
    $profStmt->close();

    $conn->commit();
    echo "\nTRANSAKSI BERHASIL SECARA KESELURUHAN! Memproses {$successCount} data.\n";
} catch (Exception $e) {
    $conn->rollback();
    echo "\nTRANSAKSI GAGAL! Rollback dijalankan. Error: " . $e->getMessage() . "\n";
}
?>
