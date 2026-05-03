<?php
/**
 * MikrotikCache — Cache data Mikrotik API di MySQL
 * Tujuan: mengurangi login/logout di Mikrotik.
 * Hanya connect ke Mikrotik saat cache expired, bukan setiap request.
 */

class MikrotikCache
{
    private $conn;

    public function __construct($conn)
    {
        $this->conn = $conn;
        $this->ensureTable();
    }

    /**
     * Pastikan tabel cache ada
     */
    private function ensureTable()
    {
        $this->conn->query("
            CREATE TABLE IF NOT EXISTS mikrotik_cache (
                cache_key  VARCHAR(200) NOT NULL PRIMARY KEY,
                data       LONGTEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                hit_count  INT DEFAULT 0,
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    /**
     * Ambil data dari cache. Return null jika tidak ada atau expired.
     */
    public function get(string $key)
    {
        $stmt = $this->conn->prepare(
            "SELECT data, expires_at FROM mikrotik_cache
             WHERE cache_key = ? AND expires_at > NOW()"
        );
        if (!$stmt)
            return null;
        $stmt->bind_param("s", $key);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row)
            return null;

        // Increment hit_count (opsional, untuk monitoring)
        $u = $this->conn->prepare("UPDATE mikrotik_cache SET hit_count = hit_count + 1 WHERE cache_key = ?");
        if ($u) {
            $u->bind_param("s", $key);
            $u->execute();
            $u->close();
        }

        return json_decode($row['data'], true);
    }

    /**
     * Simpan data ke cache dengan TTL (detik)
     */
    public function set(string $key, $data, int $ttl = 60): void
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        $expires = date('Y-m-d H:i:s', time() + $ttl);

        $stmt = $this->conn->prepare(
            "INSERT INTO mikrotik_cache (cache_key, data, expires_at, hit_count)
             VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at), hit_count = hit_count"
        );
        if (!$stmt)
            return;
        $stmt->bind_param("sss", $key, $json, $expires);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Ambil dari cache; jika expired/tidak ada, jalankan $fetcher lalu simpan.
     * $fetcher adalah callable yang return data baru dari Mikrotik.
     * Ini fungsi utama yang dipakai di semua endpoint.
     *
     * Contoh:
     *   $data = $cache->getOrFetch('ppp_active', 60, function() use ($api) {
     *       return $api->comm('/ppp/active/print');
     *   });
     */
    public function getOrFetch(string $key, int $ttl, callable $fetcher, bool $forceFetch = false)
    {
        if (!$forceFetch) {
            $cached = $this->get($key);
            if ($cached !== null) {
                return ['data' => $cached, 'from_cache' => true, 'ttl' => $ttl];
            }
        }

        // Cache miss atau force fetch → fetch dari Mikrotik
        try {
            $fresh = $fetcher();
            
            // JANGAN simpan jika fresh adalah null (berarti fetcher sengaja skip karena daemon aktif)
            if ($fresh === null) {
                $stale = $this->getStale($key);
                return ['data' => $stale, 'from_cache' => true, 'stale' => true];
            }

            $this->set($key, $fresh, $ttl);
            return ['data' => $fresh, 'from_cache' => false, 'ttl' => $ttl];
        } catch (Exception $e) {
            // Jika fetch gagal, coba return data lama (expired) daripada error
            $stale = $this->getStale($key);
            if ($stale !== null) {
                return ['data' => $stale, 'from_cache' => true, 'stale' => true, 'error' => $e->getMessage()];
            }
            throw $e;
        }
    }

    /**
     * Ambil data expired (stale) sebagai fallback saat Mikrotik tidak bisa diakses
     */
    public function getStale(string $key)
    {
        $stmt = $this->conn->prepare(
            "SELECT data FROM mikrotik_cache WHERE cache_key = ? ORDER BY expires_at DESC LIMIT 1"
        );
        if (!$stmt)
            return null;
        $stmt->bind_param("s", $key);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ? json_decode($row['data'], true) : null;
    }

    /**
     * Hapus entry cache spesifik
     */
    public function invalidate(string $key): void
    {
        $stmt = $this->conn->prepare("DELETE FROM mikrotik_cache WHERE cache_key = ?");
        if ($stmt) {
            $stmt->bind_param("s", $key);
            $stmt->execute();
            $stmt->close();
        }
    }

    /**
     * Hapus semua cache Mikrotik yang expired (hapus sampah)
     */
    public function cleanup(): int
    {
        $this->conn->query("DELETE FROM mikrotik_cache WHERE expires_at < NOW()");
        return $this->conn->affected_rows;
    }

    /**
     * Lihat status semua cache (untuk debug di browser)
     */
    public function listAll(): array
    {
        $res = $this->conn->query(
            "SELECT cache_key, expires_at, hit_count,
                    CASE WHEN expires_at > NOW() THEN 'fresh' ELSE 'expired' END as status,
                    TIMESTAMPDIFF(SECOND, NOW(), expires_at) as sisa_detik,
                    LENGTH(data) as data_bytes
             FROM mikrotik_cache ORDER BY expires_at DESC"
        );
        $rows = [];
        while ($row = $res->fetch_assoc())
            $rows[] = $row;
        return $rows;
    }
}
?>