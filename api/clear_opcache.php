<?php
header("Content-Type: text/plain");
if (function_exists('opcache_reset')) {
    if (opcache_reset()) {
        echo "OPCache berhasil dibersihkan!\n";
    } else {
        echo "Gagal membersihkan OPCache.\n";
    }
} else {
    echo "OPCache tidak aktif atau fungsi opcache_reset tidak tersedia.\n";
}
?>
