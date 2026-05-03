<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak. Hanya admin/operator yang boleh import pelanggan.');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "File CSV tidak ditemukan atau gagal diunggah."]);
    exit;
}

$routerId = trim($_POST['router_id'] ?? '');
if (empty($routerId)) {
    echo json_encode(['success' => false, 'message' => 'router_id is required.']);
    exit;
}

$filename = $_FILES['csv_file']['tmp_name'];

// Cache ODPs to avoid repeated queries
$odpCache = [];
$resO = $conn->query("SELECT id, name FROM odp WHERE router_id = '$routerId'");
while ($rowO = $resO->fetch_assoc()) {
    $odpCache[strtolower(trim($rowO['name']))] = $rowO['id'];
}

$successCount = 0;
$errorCount = 0;
$insertCount = 0;
$updateCount = 0;

if (($handle = fopen($filename, "r")) !== FALSE) {
    $header = fgetcsv($handle, 1000, ",");
    if (!$header) {
        echo json_encode(['success' => false, 'message' => 'Format CSV tidak valid atau kosong.']);
        exit;
    }
    
    $header = array_map('strtolower', array_map('trim', $header));
    
    // Minimal requirements
    if (!in_array('username', $header) || !in_array('profile', $header)) {
        echo json_encode(['success' => false, 'message' => 'Gagal: Kolom "username" dan "profile" wajib ada.']);
        exit;
    }
    
    $stmt = $conn->prepare(
        "INSERT INTO users (router_id, username, password, profile, wa, alamat, maps, lat, lng, redaman, tanggal_tagihan, odp_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password        = IF(VALUES(password)        != '', VALUES(password),        password),
           profile         = IF(VALUES(profile)         != '', VALUES(profile),         profile),
           wa              = IF(VALUES(wa)              != '', VALUES(wa),              wa),
           alamat          = IF(VALUES(alamat)          != '', VALUES(alamat),          alamat),
           maps            = IF(VALUES(maps)            != '', VALUES(maps),            maps),
           lat             = IF(VALUES(lat)             IS NOT NULL, VALUES(lat),       lat),
           lng             = IF(VALUES(lng)             IS NOT NULL, VALUES(lng),       lng),
           redaman         = IF(VALUES(redaman)         != '', VALUES(redaman),         redaman),
           tanggal_tagihan = IF(VALUES(tanggal_tagihan) IS NOT NULL, VALUES(tanggal_tagihan), tanggal_tagihan),
           odp_id          = IF(VALUES(odp_id)          IS NOT NULL, VALUES(odp_id),    odp_id)"
    );

    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        if (count($header) !== count($data)) {
            $data = array_pad($data, count($header), "");
        }
        $row = array_combine($header, $data);
        
        $u = trim($row['username'] ?? '');
        $pr = trim($row['profile'] ?? '');
        
        if (empty($u) || empty($pr)) {
            $errorCount++;
            continue;
        }
        
        $p   = trim($row['password'] ?? '123456');
        $w   = trim($row['wa'] ?? '');
        $a   = trim($row['alamat'] ?? '');
        $m   = trim($row['maps'] ?? '');
        $lat = !empty($row['lat']) ? floatval($row['lat']) : null;
        $lng = !empty($row['lng']) ? floatval($row['lng']) : null;
        $r   = trim($row['redaman'] ?? '');
        $tt  = !empty($row['tanggal_tagihan']) ? $row['tanggal_tagihan'] : null;
        
        // Resolve ODP Name to ID
        $oid = null;
        $odpName = strtolower(trim($row['odp_name'] ?? ''));
        if (!empty($odpName) && isset($odpCache[$odpName])) {
            $oid = $odpCache[$odpName];
        }

        $stmt->bind_param("sssssssssssi", $routerId, $u, $p, $pr, $w, $a, $m, $lat, $lng, $r, $tt, $oid);
        
        if ($stmt->execute()) {
            if ($stmt->affected_rows === 1) $insertCount++;
            elseif ($stmt->affected_rows === 2) $updateCount++;
            $successCount++;
        } else {
            $errorCount++;
        }
    }
    fclose($handle);
    $stmt->close();
    
    echo json_encode([
        'success' => true, 
        'message' => "Import selesai. Ditambahkan: $insertCount, Diperbarui: $updateCount, Gagal: $errorCount."
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Gagal membuka file CSV.']);
}
?>
