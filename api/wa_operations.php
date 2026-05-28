<?php
/**
 * WhatsApp Operations API
 * Mengelola setelan gateway, antrean pesan, dan eksekusi pengiriman di latar belakang
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = trim($_GET['action'] ?? '');
$isLocalhost = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1', 'localhost']);

if ($action === 'process_queue' && $isLocalhost) {
    // Lewati proteksi session untuk cURL internal localhost agar asinkronous berjalan
    require_once __DIR__ . '/config.php';
} else {
    // Keamanan ketat untuk request luar/browser
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/auth/require_auth.php';
    require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak.');
}

try {
    switch ($action) {
        
        // ── 1. AMBIL SETTING GATEWAY ──────────────────────────────────────────
        case 'get_settings':
            $res = $conn->query("SELECT gateway_type, api_token, custom_url FROM wa_settings LIMIT 1");
            $settings = $res ? $res->fetch_assoc() : null;
            if (!$settings) {
                $settings = ['gateway_type' => 'fonnte', 'api_token' => '', 'custom_url' => ''];
            }
            // Sembunyikan sebagian token agar aman
            if (!empty($settings['api_token'])) {
                $len = strlen($settings['api_token']);
                $settings['api_token_masked'] = substr($settings['api_token'], 0, 4) . str_repeat('*', max(4, $len - 8)) . substr($settings['api_token'], -4);
            } else {
                $settings['api_token_masked'] = '';
            }
            
            echo json_encode(['success' => true, 'settings' => $settings]);
            break;

        // ── 2. SIMPAN SETTING GATEWAY ─────────────────────────────────────────
        case 'save_settings':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                echo json_encode(['success' => false, 'message' => 'Data tidak valid']);
                exit;
            }
            
            $gatewayType = $input['gateway_type'] ?? 'fonnte';
            $apiToken = trim($input['api_token'] ?? '');
            $customUrl = trim($input['custom_url'] ?? '');
            
            // Jika token terisi sensor-mask, jangan ubah isinya
            if (strpos($apiToken, '****') !== false) {
                // Ambil token lama dari DB
                $oldRes = $conn->query("SELECT api_token FROM wa_settings LIMIT 1");
                if ($oldRow = $oldRes->fetch_assoc()) {
                    $apiToken = $oldRow['api_token'];
                }
            }
            
            $stmt = $conn->prepare("UPDATE wa_settings SET gateway_type = ?, api_token = ?, custom_url = ? WHERE id = 1");
            if (!$stmt) throw new Exception($conn->error);
            $stmt->bind_param("sss", $gatewayType, $apiToken, $customUrl);
            $stmt->execute();
            $stmt->close();
            
            echo json_encode(['success' => true, 'message' => 'Pengaturan WA Gateway berhasil disimpan!']);
            break;

        // ── 3. TAMBAHKAN PESAN KE ANTREAN (ENQUEUE BLAST) ──────────────────────
        case 'enqueue_blast':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || empty($input['customers']) || empty($input['router_id'])) {
                echo json_encode(['success' => false, 'message' => 'Data antrean kosong atau tidak valid']);
                exit;
            }
            
            $routerId = $input['router_id'];
            $customers = $input['customers']; // array of ['phone' => '...', 'message' => '...']
            
            $stmt = $conn->prepare("INSERT INTO wa_queue (router_id, phone, message, status) VALUES (?, ?, ?, 'pending')");
            if (!$stmt) throw new Exception($conn->error);
            
            $conn->begin_transaction();
            $count = 0;
            foreach ($customers as $c) {
                $phone = preg_replace('/[^0-9]/', '', $c['phone']);
                // Format ke standar internasional 62 jika diawali 0
                if (strpos($phone, '0') === 0) {
                    $phone = '62' . substr($phone, 1);
                }
                $message = trim($c['message']);
                
                if (!empty($phone) && !empty($message)) {
                    $stmt->bind_param("sss", $routerId, $phone, $message);
                    $stmt->execute();
                    $count++;
                }
            }
            $conn->commit();
            $stmt->close();
            
            echo json_encode(['success' => true, 'message' => "$count pesan berhasil dimasukkan ke dalam antrean pengiriman!"]);
            break;

        // ── 4. LIHAT PROGRESS ANTREAN ─────────────────────────────────────────
        case 'get_queue_status':
            $routerId = trim($_GET['router_id'] ?? '');
            
            $q = "SELECT 
                    SUM(IF(status = 'pending', 1, 0)) as pending,
                    SUM(IF(status = 'sending', 1, 0)) as sending,
                    SUM(IF(status = 'sent', 1, 0)) as sent,
                    SUM(IF(status = 'failed', 1, 0)) as failed,
                    COUNT(*) as total
                  FROM wa_queue";
            
            if ($routerId !== '') {
                $stmt = $conn->prepare($q . " WHERE router_id = ?");
                $stmt->bind_param("s", $routerId);
            } else {
                $stmt = $conn->prepare($q);
            }
            
            $stmt->execute();
            $counts = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            
            echo json_encode([
                'success' => true,
                'counts' => [
                    'pending' => intval($counts['pending'] ?? 0),
                    'sending' => intval($counts['sending'] ?? 0),
                    'sent' => intval($counts['sent'] ?? 0),
                    'failed' => intval($counts['failed'] ?? 0),
                    'total' => intval($counts['total'] ?? 0)
                ]
            ]);
            break;

        // ── 5. PROSES ANTREAN (BACKGROUND WORKER SINGLE TRIGGER) ─────────────────
        case 'process_queue':
            // Ambil setelan gateway
            $sRes = $conn->query("SELECT gateway_type, api_token, custom_url FROM wa_settings LIMIT 1");
            $s = $sRes ? $sRes->fetch_assoc() : null;
            if (!$s) {
                echo json_encode(['success' => false, 'message' => 'WA Gateway belum dikonfigurasi']);
                exit;
            }
            
            // Ambil 1 pesan pending teratas untuk dikirim (sistem asinkronous)
            $qRes = $conn->query("SELECT id, phone, message FROM wa_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1");
            $msg = $qRes ? $qRes->fetch_assoc() : null;
            
            if (!$msg) {
                echo json_encode(['success' => true, 'completed' => true, 'message' => 'Semua antrean telah diproses!']);
                exit;
            }
            
            $msgId = $msg['id'];
            $phone = $msg['phone'];
            $text = $msg['message'];
            
            // Tandai status 'sending'
            $conn->query("UPDATE wa_queue SET status = 'sending' WHERE id = $msgId");
            
            $success = false;
            $err = '';
            
            // Eksekusi pengiriman berdasarkan Gateway yang dipilih
            if ($s['gateway_type'] === 'fonnte') {
                $apiToken = $s['api_token'];
                if (empty($apiToken)) {
                    $err = 'Fonnte API Token kosong';
                } else {
                    $curl = curl_init();
                    curl_setopt_array($curl, array(
                        CURLOPT_URL => 'https://api.fonnte.com/send',
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_ENCODING => '',
                        CURLOPT_MAXREDIRS => 10,
                        CURLOPT_TIMEOUT => 20,
                        CURLOPT_FOLLOWLOCATION => true,
                        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                        CURLOPT_CUSTOMREQUEST => 'POST',
                        CURLOPT_POSTFIELDS => array(
                            'target' => $phone,
                            'message' => $text,
                        ),
                        CURLOPT_HTTPHEADER => array(
                            'Authorization: ' . $apiToken
                        ),
                    ));
                    $response = curl_exec($curl);
                    $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                    
                    if (curl_errno($curl)) {
                        $err = 'cURL Error: ' . curl_error($curl);
                    } else {
                        $resData = json_decode($response, true);
                        if ($httpcode == 200 && isset($resData['status']) && $resData['status'] == true) {
                            $success = true;
                        } else {
                            $err = $resData['reason'] ?? $resData['detail'] ?? 'Gagal dari API Fonnte';
                        }
                    }
                    curl_close($curl);
                }
            } else {
                // Custom HTTP API
                $customUrl = trim($s['custom_url'] ?? '');
                if (empty($customUrl)) {
                    $customUrl = 'http://localhost:4890';
                }
                
                // Pastikan endpoint kirim ke path /send
                $sendUrl = rtrim($customUrl, '/');
                if (strpos($sendUrl, '/send') === false) {
                    $sendUrl .= '/send';
                }
                
                $postData = json_encode(['phone' => $phone, 'message' => $text]);
                $ch = curl_init($sendUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
                curl_setopt($ch, CURLOPT_TIMEOUT, 20);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                
                $response = curl_exec($ch);
                $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                
                if (curl_errno($ch)) {
                    $err = 'cURL Error: ' . curl_error($ch);
                } else {
                    $resData = json_decode($response, true);
                    if ($httpcode >= 200 && $httpcode < 300 && isset($resData['success']) && $resData['success'] == true) {
                        $success = true;
                    } else {
                        $err = $resData['message'] ?? "HTTP Status Code: $httpcode. Response: " . substr($response, 0, 100);
                    }
                }
                curl_close($ch);
            }
            
            // Update status akhir
            if ($success) {
                $stmt = $conn->prepare("UPDATE wa_queue SET status = 'sent', sent_at = NOW() WHERE id = ?");
                $stmt->bind_param("i", $msgId);
                $stmt->execute();
                $stmt->close();
                echo json_encode(['success' => true, 'completed' => false, 'message' => "Pesan ke $phone berhasil dikirim!"]);
            } else {
                $stmt = $conn->prepare("UPDATE wa_queue SET status = 'failed', error_message = ? WHERE id = ?");
                $stmt->bind_param("si", $err, $msgId);
                $stmt->execute();
                $stmt->close();
                echo json_encode(['success' => false, 'completed' => false, 'message' => "Pesan ke $phone gagal dikirim: $err"]);
            }
            break;

        // ── 6. BERSIHKAN ANTREAN GAGAL ─────────────────────────────────────────
        case 'clear_failed':
            $routerId = trim($_GET['router_id'] ?? '');
            if ($routerId !== '') {
                $stmt = $conn->prepare("DELETE FROM wa_queue WHERE status = 'failed' AND router_id = ?");
                $stmt->bind_param("s", $routerId);
            } else {
                $stmt = $conn->prepare("DELETE FROM wa_queue WHERE status = 'failed'");
            }
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Semua antrean gagal berhasil dibersihkan!']);
            break;

        // ── 7. BERSIHKAN SEMUA ANTREAN ─────────────────────────────────────────
        case 'clear_all':
            $routerId = trim($_GET['router_id'] ?? '');
            if ($routerId !== '') {
                $stmt = $conn->prepare("DELETE FROM wa_queue WHERE router_id = ?");
                $stmt->bind_param("s", $routerId);
            } else {
                $stmt = $conn->prepare("DELETE FROM wa_queue");
            }
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Seluruh antrean berhasil dibersihkan!']);
            break;

        // ── 8. AMBIL STATUS PERANGKAT FONNTE ────────────────────────────────────
        case 'get_device_status':
            $sRes = $conn->query("SELECT gateway_type, api_token, custom_url FROM wa_settings LIMIT 1");
            $s = $sRes ? $sRes->fetch_assoc() : null;
            $gatewayType = $s['gateway_type'] ?? 'fonnte';
            
            if ($gatewayType === 'custom') {
                $customUrl = trim($s['custom_url'] ?? '');
                if (empty($customUrl)) {
                    $customUrl = 'http://localhost:4890';
                }
                $statusUrl = rtrim($customUrl, '/') . '/status';
                
                $curl = curl_init();
                curl_setopt_array($curl, array(
                    CURLOPT_URL => $statusUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 5,
                ));
                $response = curl_exec($curl);
                $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                curl_close($curl);
                
                if ($httpcode == 200 && $response) {
                    echo $response;
                } else {
                    echo json_encode([
                        'success' => true,
                        'connected' => false,
                        'message' => 'Gagal terhubung ke custom gateway lokal. Pastikan server Node.js aktif di port 4890.'
                    ]);
                }
                exit;
            }
            
            if (!$s || empty($s['api_token'])) {
                echo json_encode(['success' => true, 'connected' => false, 'message' => 'Token API belum dikonfigurasi']);
                exit;
            }
            
            $apiToken = $s['api_token'];
            $curl = curl_init();
            curl_setopt_array($curl, array(
                CURLOPT_URL => 'https://api.fonnte.com/device',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => '',
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_HTTPHEADER => array(
                    'Authorization: ' . $apiToken
                ),
            ));
            $response = curl_exec($curl);
            $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            
            if (curl_errno($curl)) {
                echo json_encode(['success' => false, 'connected' => false, 'message' => 'cURL Error: ' . curl_error($curl)]);
            } else {
                $resData = json_decode($response, true);
                if ($httpcode == 200 && isset($resData['status']) && $resData['status'] == true) {
                    echo json_encode([
                        'success' => true,
                        'connected' => ($resData['device_status'] ?? '') === 'connect',
                        'device_info' => [
                            'name' => $resData['name'] ?? 'Device Fonnte',
                            'number' => $resData['device'] ?? '-',
                            'status' => $resData['device_status'] ?? 'disconnect',
                            'quota' => $resData['quota'] ?? 0,
                            'expired' => $resData['expired'] ?? '-'
                        ]
                    ]);
                } else {
                    echo json_encode([
                        'success' => true, 
                        'connected' => false, 
                        'message' => $resData['reason'] ?? $resData['detail'] ?? 'Token tidak valid / expired'
                    ]);
                }
            }
            curl_close($curl);
            break;

        // ── 9. AMBIL QR CODE FONNTE ─────────────────────────────────────────────
        case 'get_qr':
            $sRes = $conn->query("SELECT gateway_type, api_token, custom_url FROM wa_settings LIMIT 1");
            $s = $sRes ? $sRes->fetch_assoc() : null;
            $gatewayType = $s['gateway_type'] ?? 'fonnte';
            
            if ($gatewayType === 'custom') {
                $customUrl = trim($s['custom_url'] ?? '');
                if (empty($customUrl)) {
                    $customUrl = 'http://localhost:4890';
                }
                $qrUrl = rtrim($customUrl, '/') . '/qr';
                
                $curl = curl_init();
                curl_setopt_array($curl, array(
                    CURLOPT_URL => $qrUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 10,
                ));
                $response = curl_exec($curl);
                $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                curl_close($curl);
                
                if ($httpcode == 200 && $response) {
                    echo $response;
                } else {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Gagal mengambil QR Code dari custom gateway lokal. Pastikan server Node.js aktif di port 4890.'
                    ]);
                }
                exit;
            }
            
            if (!$s || empty($s['api_token'])) {
                echo json_encode(['success' => false, 'message' => 'Token API belum dikonfigurasi']);
                exit;
            }
            
            $apiToken = $s['api_token'];
            $curl = curl_init();
            curl_setopt_array($curl, array(
                CURLOPT_URL => 'https://api.fonnte.com/qr',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => '',
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_HTTPHEADER => array(
                    'Authorization: ' . $apiToken
                ),
            ));
            $response = curl_exec($curl);
            $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            
            if (curl_errno($curl)) {
                echo json_encode(['success' => false, 'message' => 'cURL Error: ' . curl_error($curl)]);
            } else {
                $resData = json_decode($response, true);
                if ($httpcode == 200 && isset($resData['status']) && $resData['status'] == true) {
                    echo json_encode([
                        'success' => true,
                        'qr' => $resData['qr'] ?? '', // base64 payload
                        'url' => $resData['url'] ?? ''
                    ]);
                } else {
                    echo json_encode([
                        'success' => false, 
                        'message' => $resData['reason'] ?? $resData['detail'] ?? 'Gagal memuat QR Code dari Fonnte'
                    ]);
                }
            }
            curl_close($curl);
            break;

        // ── 10. DISCONNECT PERANGKAT FONNTE ─────────────────────────────────────
        case 'disconnect_device':
            $sRes = $conn->query("SELECT gateway_type, api_token, custom_url FROM wa_settings LIMIT 1");
            $s = $sRes ? $sRes->fetch_assoc() : null;
            $gatewayType = $s['gateway_type'] ?? 'fonnte';
            
            if ($gatewayType === 'custom') {
                $customUrl = trim($s['custom_url'] ?? '');
                if (empty($customUrl)) {
                    $customUrl = 'http://localhost:4890';
                }
                $discUrl = rtrim($customUrl, '/') . '/disconnect';
                
                $curl = curl_init();
                curl_setopt_array($curl, array(
                    CURLOPT_URL => $discUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 10,
                ));
                $response = curl_exec($curl);
                $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                curl_close($curl);
                
                if ($httpcode == 200 && $response) {
                    echo $response;
                } else {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Gagal mengirim sinyal putus sambungan ke custom gateway lokal.'
                    ]);
                }
                exit;
            }
            
            if (!$s || empty($s['api_token'])) {
                echo json_encode(['success' => false, 'message' => 'Token API belum dikonfigurasi']);
                exit;
            }
            
            $apiToken = $s['api_token'];
            $curl = curl_init();
            curl_setopt_array($curl, array(
                CURLOPT_URL => 'https://api.fonnte.com/disconnect',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => '',
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_HTTPHEADER => array(
                    'Authorization: ' . $apiToken
                ),
            ));
            $response = curl_exec($curl);
            $httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            
            if (curl_errno($curl)) {
                echo json_encode(['success' => false, 'message' => 'cURL Error: ' . curl_error($curl)]);
            } else {
                $resData = json_decode($response, true);
                if ($httpcode == 200) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Device WhatsApp berhasil diputuskan!'
                    ]);
                } else {
                    echo json_encode([
                        'success' => false, 
                        'message' => $resData['reason'] ?? $resData['detail'] ?? 'Gagal memutuskan device WhatsApp'
                    ]);
                }
            }
            curl_close($curl);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => "Action '$action' tidak dikenali"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
