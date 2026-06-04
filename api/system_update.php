<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Verifikasi Admin
require_admin_role(['admin', 'administrator'], 'Akses ditolak. Hanya admin yang bisa mengupdate sistem.');

$action = $_GET['action'] ?? 'update';
$cwd = realpath(__DIR__ . '/..');
$historyFile = __DIR__ . '/update_history.json';

// --- API Riwayat Update ---
if ($action === 'history') {
    header('Content-Type: application/json');
    if (file_exists($historyFile)) {
        $history = json_decode(file_get_contents($historyFile), true);
        echo json_encode(['success' => true, 'data' => $history ?: []]);
    } else {
        echo json_encode(['success' => true, 'data' => []]);
    }
    exit();
}

// --- API Changelog Lengkap ---
if ($action === 'changelog_full') {
    header('Content-Type: application/json');
    
    // Sinkronisasi dengan GitHub untuk mendapatkan info terbaru
    $fetchCmd = "cd " . escapeshellarg($cwd) . " && git fetch origin 2>&1";
    exec($fetchCmd, $fetchOutput, $fetchCode);

    // 1. Ambil komit masa depan (Upcoming)
    $upcomingOutput = [];
    exec("cd " . escapeshellarg($cwd) . " && git log HEAD..origin/main --oneline 2>&1", $upcomingOutput, $upcomingCode);

    $upcoming = [];
    if ($upcomingCode === 0) {
        foreach ($upcomingOutput as $line) {
            if (trim($line) !== '') {
                $parts = explode(' ', $line, 2);
                if (count($parts) >= 2) {
                    $upcoming[] = ['hash' => $parts[0], 'message' => $parts[1]];
                }
            }
        }
    }

    // 2. Ambil komit masa lalu (Past)
    $pastOutput = [];
    exec("cd " . escapeshellarg($cwd) . " && git log HEAD -n 30 --oneline 2>&1", $pastOutput, $pastCode);

    $past = [];
    if ($pastCode === 0) {
        foreach ($pastOutput as $line) {
            if (trim($line) !== '') {
                $parts = explode(' ', $line, 2);
                if (count($parts) >= 2) {
                    $past[] = ['hash' => $parts[0], 'message' => $parts[1]];
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'has_update' => count($upcoming) > 0,
        'upcoming' => $upcoming,
        'past' => $past
    ]);
    exit();
}

// --- API Eksekusi Update (SSE) ---
if ($action === 'update') {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');

    @ini_set('output_buffering', 'off');
    @ini_set('zlib.output_compression', false);
    @ini_set('implicit_flush', true);
    ob_implicit_flush(true);
    while (ob_get_level() > 0) {
        ob_end_flush();
    }

    function sendLog($message, $isDone = false) {
        $data = ['log' => $message];
        if ($isDone) {
            $data['done'] = true;
        }
        echo "data: " . json_encode($data) . "\n\n";
        flush();
    }

    sendLog("[*] 🚀 Menginisiasi proses instalasi pembaruan...");

    // Tangkap HEAD sebelum pull
    $oldHead = trim(shell_exec("cd " . escapeshellarg($cwd) . " && git rev-parse HEAD 2>&1"));

    // 1. GIT PULL
    sendLog("[*] Mengunduh kode terbaru dari repositori GitHub...");
    $cmdGit = "cd " . escapeshellarg($cwd) . " && git pull origin main 2>&1";

    $handleGit = popen($cmdGit, 'r');
    while (!feof($handleGit)) {
        $buffer = fgets($handleGit);
        if ($buffer !== false && trim($buffer) !== '') {
            sendLog(trim($buffer));
        }
    }
    $gitStatus = pclose($handleGit);

    if ($gitStatus !== 0) {
        sendLog("[!] ❌ GAGAL: Terjadi bentrok kode atau error saat mendownload update.", true);
        exit();
    }
    sendLog("[*] ✅ Download source code selesai.");

    // Tangkap HEAD setelah pull dan ambil riwayat commit
    $newHead = trim(shell_exec("cd " . escapeshellarg($cwd) . " && git rev-parse HEAD 2>&1"));
    $changelogOutput = [];
    if ($oldHead && $newHead && $oldHead !== $newHead && !str_contains($oldHead, 'fatal')) {
        exec("cd " . escapeshellarg($cwd) . " && git log $oldHead..$newHead --oneline 2>&1", $changelogOutput);
    }
    
    // Ambil versi terbaru dari package.json
    $newVersion = 'unknown';
    $pkgPath = $cwd . '/package.json';
    if (file_exists($pkgPath)) {
        $pkg = json_decode(file_get_contents($pkgPath), true);
        if (isset($pkg['version'])) {
            $newVersion = $pkg['version'];
        }
    }

    // 2. NPM BUILD
    sendLog("[*] Memulai kompilasi aset antarmuka (UI)...");
    sendLog("[*] Harap bersabar, proses ini memakan waktu beberapa saat...");

    $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
    if ($isWindows) {
        $cmdNpm = "cmd.exe /c \"cd " . escapeshellarg($cwd) . " && npm run build 2>&1\"";
    } else {
        $cmdNpm = "cd " . escapeshellarg($cwd) . " && npm run build 2>&1";
    }

    $handleNpm = popen($cmdNpm, 'r');
    while (!feof($handleNpm)) {
        $buffer = fgets($handleNpm);
        if ($buffer !== false && trim($buffer) !== '') {
            sendLog(trim($buffer));
        }
    }
    $npmStatus = pclose($handleNpm);

    // Save history function
    function saveHistory($status, $details, $changelog = [], $version = null) {
        global $historyFile;
        $history = [];
        if (file_exists($historyFile)) {
            $history = json_decode(file_get_contents($historyFile), true) ?: [];
        }
        $entry = [
            'date' => date('Y-m-d H:i:s'),
            'status' => $status,
            'details' => $details
        ];
        if (!empty($changelog)) {
            $entry['changelog'] = $changelog;
        }
        if ($version) {
            $entry['version'] = $version;
        }

        array_unshift($history, $entry);
        // Simpan hanya 30 riwayat terakhir
        $history = array_slice($history, 0, 30);
        file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
    }

    if ($npmStatus === 0) {
        sendLog("[*] ✅ Kompilasi frontend berhasil!");
        sendLog("[*] 🎉 SYSTEM UPDATE SELESAI. Website siap digunakan.", true);
        
        $details = $newVersion !== 'unknown' ? "Sistem diperbarui ke versi v$newVersion" : 'Sistem diperbarui ke versi terbaru dari GitHub.';
        saveHistory('success', $details, $changelogOutput, $newVersion);
    } else {
        sendLog("[!] ❌ GAGAL: Terjadi error saat proses build kompilasi.", true);
        saveHistory('error', 'Gagal membuild kode frontend (NPM Error).', $changelogOutput, $newVersion);
    }
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Action tidak valid']);
?>
