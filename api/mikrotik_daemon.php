<?php
/**
 * Mikrotik Daemon — Background Synchronizer
 * Jalankan via terminal: php mikrotik_daemon.php
 * 
 * Fungsi:
 * 1. Menjaga login tetap terbuka (Persistent Session)
 * 2. Mengupdate cache database secara berkala
 * 3. Menghilangkan banjir log login/logout di Mikrotik
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/routerosAPI.php';
require_once __DIR__ . '/mikrotik_cache.php';

// Pastikan script tidak mati karena timeout atau koneksi terminal tertutup
set_time_limit(0);
ignore_user_abort(true);

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Starting Mikrotik Daemon...\n";
$cache = new MikrotikCache($conn);

// Map router connection objects
$routerConnections = [];
$routerPrevData = []; // Untuk simpan byte sebelumnya [rid => [iface => [rx, tx, time]]]
$loops = 0;
$routers = [];

while (true) {
    // Ambil router dari DB setiap 30 detik saja untuk efisiensi
    // Catatan: Ambil SEMUA router (bukan hanya is_active=1) agar daemon tetap
    // menjaga cache untuk semua router — mencegah direct connect & flood log
    // ketika user switch router di UI
    if ($loops % 30 == 0 || empty($routers)) {
        if (!$conn || $conn->connect_error) {
            echo "[" . date('H:i:s') . "] DB Connection lost. Reconnecting...\n";
            require __DIR__ . '/config.php';
            $cache = new MikrotikCache($conn);
        }

        $stmt = $conn->prepare("SELECT id, host, port, username, password FROM mikrotik_routers");
        if ($stmt) {
            $stmt->execute();
            $routers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
        }
    }

    if (empty($routers)) {
        echo "[" . date('H:i:s') . "] No active routers found. Waiting...\n";
        sleep(5);
        $loops = 0;
        continue;
    }

    foreach ($routers as $router) {
        $rid = $router['id'];
        $host = $router['host'];
        $port = intval($router['port']) ?: 8728;
        $user = $router['username'];
        $pass = $router['password'];

        try {
            // Connect if needed
            if (!isset($routerConnections[$rid]) || !$routerConnections[$rid]->connected) {
                echo "[" . date('H:i:s') . "] Connecting to $host:$port...\n";
                $api = new RouterosAPI();
                $api->port = $port;
                $api->timeout = 5; // Shorter timeout
                if ($api->connect($host, $user, $pass)) {
                    $routerConnections[$rid] = $api;
                    echo "[" . date('H:i:s') . "] Connected Successfully to $host\n";

                    // === WARM-UP: Langsung isi cache semua data penting ===
                    // Tujuan: halaman web bisa langsung baca cache tanpa perlu konek sendiri
                    echo "[" . date('H:i:s') . "] Warm-up cache untuk $host...\n";
                    try {
                        $wInterfaces = $api->comm('/interface/print');
                        $cache->set("mt_{$rid}_interface", $wInterfaces ?: [], 60);

                        $wResource = $api->comm('/system/resource/print');
                        // Simpan sebagai array agar konsisten dengan format API response
                        $cache->set("mt_{$rid}_resource", [$wResource[0] ?? []], 60);

                        $wActive = $api->comm('/ppp/active/print');
                        $cache->set("mt_{$rid}_ppp_active", $wActive ?: [], 60);

                        $wSecret = $api->comm('/ppp/secret/print');
                        $cache->set("mt_{$rid}_ppp_secret", $wSecret ?: [], 600);

                        $wProfile = $api->comm('/ppp/profile/print');
                        $cache->set("mt_{$rid}_ppp_profile", $wProfile ?: [], 600);

                        $wLogs = $api->comm('/log/print');
                        $cache->set("mt_{$rid}_log", is_array($wLogs) ? array_slice($wLogs, -50) : [], 60);

                        // Cache identity (nama router) — digunakan di Live Monitor
                        $wIdentity = $api->comm('/system/identity/print');
                        $cache->set("mt_{$rid}_identity", $wIdentity ?: [], 3600);
                        $routerPrevData[$rid]['identity'] = $wIdentity[0]['name'] ?? 'MikroTik';

                        // Internet Check di awal
                        $ping = $api->comm('/ping', ['address' => '8.8.8.8', 'count' => '1']);
                        $routerPrevData[$rid]['internet'] = (isset($ping[0]['received']) && $ping[0]['received'] > 0) ? 'OK' : 'Error';

                        $cache->set("daemon_status_{$rid}", ['last_sync' => date('Y-m-d H:i:s')], 300);
                        echo "[" . date('H:i:s') . "] Warm-up selesai untuk $host\n";
                    } catch (Exception $eWarm) {
                        echo "[" . date('H:i:s') . "] Warm-up error pada $host: " . $eWarm->getMessage() . "\n";
                    }
                    // === END WARM-UP ===

                } else {
                    echo "[" . date('H:i:s') . "] Failed to connect to $host\n";
                    // Tandai status offline agar API tidak menunggu daemon yang gagal
                    $cache->set("daemon_status_{$rid}", ['last_sync' => '2000-01-01 00:00:00'], 60);
                    continue;
                }
            }

            $api = $routerConnections[$rid];

            // 1. FAST LOOP: Heartbeat (Sangat Penting)
            $cache->set("daemon_status_{$rid}", ['last_sync' => date('Y-m-d H:i:s')], 300);

            // 2. Interfaces & Rates
            $interfaces = $api->comm('/interface/print');
            if ($interfaces === false)
                throw new Exception("Comm failed");

            $now = microtime(true);
            foreach ($interfaces as &$iface) {
                $iname = $iface['name'] ?? 'unknown-' . ($iface['.id'] ?? 'unknown');
                $rx = floatval($iface['rx-byte'] ?? 0);
                $tx = floatval($iface['tx-byte'] ?? 0);
                if (isset($routerPrevData[$rid][$iname])) {
                    $prev = $routerPrevData[$rid][$iname];
                    $dt = $now - $prev['time'];
                    if ($dt > 0) {
                        $iface['rx-bits-per-second'] = max(0, ($rx - $prev['rx']) * 8 / $dt);
                        $iface['tx-bits-per-second'] = max(0, ($tx - $prev['tx']) * 8 / $dt);
                    }
                }
                $routerPrevData[$rid][$iname] = ['rx' => $rx, 'tx' => $tx, 'time' => $now];
            }
            $cache->set("mt_{$rid}_interface", $interfaces, 60);

            // 3. Medium Loop: Resources, PPP Active & Summary (Every 2s / 10s)
            // Move summary here for real-time map updates
            if ($loops % 2 == 0) {
                echo "[" . date('H:i:s') . "] [RID $rid] Updating Summary & Resources...\n";
                $resource = $api->comm('/system/resource/print');
                $cache->set("mt_{$rid}_resource", [$resource[0] ?? []], 60);

                // Build Summary Cache (Real-time for Map)
                $topIf = null;
                $maxBps = -1;
                foreach ($interfaces as $if) {
                    $totalBps = ($if['rx-bits-per-second'] ?? 0) + ($if['tx-bits-per-second'] ?? 0);
                    if ($totalBps > $maxBps) {
                        $maxBps = $totalBps;
                        $topIf = $if;
                    }
                }

                $summary = [
                    'identity' => $routerPrevData[$rid]['identity'] ?? 'MikroTik',
                    'resource' => $resource[0] ?? [],
                    'internet' => $routerPrevData[$rid]['internet'] ?? '...',
                    'top_interface' => $topIf ? [
                        'name' => $topIf['name'] ?? 'unknown',
                        'rx' => $topIf['rx-byte'] ?? 0,
                        'tx' => $topIf['tx-byte'] ?? 0,
                        'bps_rx' => $topIf['rx-bits-per-second'] ?? 0,
                        'bps_tx' => $topIf['tx-bits-per-second'] ?? 0
                    ] : null
                ];
                $cache->set("mt_{$rid}_summary", $summary, 10);
            }

            if ($loops % 10 == 0) {
                $active = $api->comm('/ppp/active/print');
                // Data Merging
                if (!empty($active) && !empty($interfaces)) {
                    $ifMap = [];
                    foreach ($interfaces as $if)
                        $ifMap[trim($if['name'] ?? '')] = $if;
                    foreach ($active as &$s) {
                        $uname = trim($s['name'] ?? '');
                        foreach ([$uname, "<pppoe-$uname>", "pppoe-$uname"] as $pif) {
                            if (isset($ifMap[$pif])) {
                                $s['rx_byte'] = $ifMap[$pif]['rx-byte'] ?? 0;
                                $s['tx_byte'] = $ifMap[$pif]['tx-byte'] ?? 0;
                                break;
                            }
                        }
                    }
                }
                $cache->set("mt_{$rid}_ppp_active", $active, 60);

                $logs = $api->comm('/log/print');
                $cache->set("mt_{$rid}_log", is_array($logs) ? array_slice($logs, -50) : [], 60);
            }

            // 4. Slow Loop: Secrets, Profiles, Identity & Internet Check (Every 30s)
            if ($loops % 30 == 0) {
                echo "[" . date('H:i:s') . "] Syncing Secrets/Profiles & Ping for $host\n";
                $cache->set("mt_{$rid}_ppp_secret", $api->comm('/ppp/secret/print'), 600);
                $cache->set("mt_{$rid}_ppp_profile", $api->comm('/ppp/profile/print'), 600);

                $identity = $api->comm('/system/identity/print');
                $routerPrevData[$rid]['identity'] = $identity[0]['name'] ?? 'MikroTik';
                $cache->set("mt_{$rid}_identity", $identity ?: [], 3600);

                // Internet Ping
                $ping = $api->comm('/ping', ['address' => '8.8.8.8', 'count' => '1']);
                $routerPrevData[$rid]['internet'] = (isset($ping[0]['received']) && $ping[0]['received'] > 0) ? 'OK' : 'Error';
            }

            // 5. Maintenance Loop: Cleanup expired cache entries (Every 1000 loops)
            if ($loops % 1000 == 0) {
                $cleaned = $cache->cleanup();
                if ($cleaned > 0) {
                    echo "[" . date('H:i:s') . "] [Maintenance] Cache Cleanup: $cleaned entries removed.\n";
                }
            }

        } catch (Exception $e) {
            echo "[" . date('H:i:s') . "] Error on $host: " . $e->getMessage() . "\n";
            if (isset($routerConnections[$rid])) {
                @$routerConnections[$rid]->disconnect();
                unset($routerConnections[$rid]);
            }
        }
    }

    $loops++;
    if ($loops > 10000)
        $loops = 0;
    sleep(1);
}
?>