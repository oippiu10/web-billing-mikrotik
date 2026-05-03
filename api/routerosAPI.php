<?php
class RouterosAPI
{
    var $socket;
    var $connected = false;
    var $port = 8728;
    var $timeout = 3;
    var $debug = false;

    public function connect($ip, $login, $password)
    {
        // Buka koneksi TCP baru ke Mikrotik
        $this->socket = @fsockopen($ip, $this->port, $errno, $errstr, $this->timeout);
        if (!$this->socket)
            return false;
        stream_set_timeout($this->socket, $this->timeout);

        // Attempt 1: New Login Method (RouterOS >= 6.43)
        $this->write('/login');
        $this->write('=name=' . $login);
        $this->write('=password=' . $password);
        $this->write('');

        $response = $this->read();

        if (isset($response[0]) && $response[0] === '!done') {
            $this->connected = true;
            return true;
        }

        // Attempt 2: Old Login Method for RouterOS < 6.43 (Challenge-Response)
        @fclose($this->socket);
        $this->socket = @fsockopen($ip, $this->port, $errno, $errstr, $this->timeout);
        if (!$this->socket)
            return false;
        stream_set_timeout($this->socket, $this->timeout);

        $this->write('/login');
        $this->write('');
        $response = $this->read();

        if (isset($response[0]) && $response[0] === '!done') {
            $challenge = null;
            foreach ($response as $line) {
                if (strpos($line, '=ret=') === 0) {
                    $challenge = substr($line, 5);
                }
            }

            if ($challenge) {
                $hash = md5(chr(0) . $password . hex2bin($challenge));
                $this->write('/login');
                $this->write('=name=' . $login);
                $this->write('=response=00' . $hash);
                $this->write('');
                $response = $this->read();
                if (isset($response[0]) && $response[0] === '!done') {
                    $this->connected = true;
                    return true;
                }
            } else {
                $this->write('/login');
                $this->write('=name=' . $login);
                $this->write('=password=' . $password);
                $this->write('');
                $response = $this->read();
                if (isset($response[0]) && $response[0] === '!done') {
                    $this->connected = true;
                    return true;
                }
            }
        }

        return false;
    }

    public function comm($command, $params = [])
    {
        $this->write($command);
        foreach ($params as $k => $v) {
            // Key yang sudah diawali '=' atau '?' → jangan tambah prefix lagi
            // Key lainnya (termasuk '.id') → tambah '=' prefix (format MikroTik API: =.id=*3)
            if (!empty($k) && !in_array($k[0], ['=', '?'])) {
                if ($this->debug)
                    echo "DEBUG-API: Writing [=$k=$v]\n";
                $this->write('=' . $k . '=' . $v);
            } else {
                if ($this->debug)
                    echo "DEBUG-API: Writing [$k=$v]\n";
                $this->write($k . '=' . $v);
            }
        }
        $this->write(''); // End of command

        $result = [];
        while (true) {
            $sentence = $this->read();
            if (empty($sentence))
                break;

            if ($sentence[0] === '!re') {
                // Data line
                $item = [];
                foreach ($sentence as $line) {
                    if (strpos($line, '=') === 0) {
                        $line = substr($line, 1);
                        if (strpos($line, '=') !== false) {
                            [$key, $value] = explode('=', $line, 2);
                            $item[$key] = $value;
                        }
                    }
                }
                $result[] = $item;
            } elseif ($sentence[0] === '!done') {
                // End of command
                break;
            } elseif ($sentence[0] === '!trap') {
                // Error — parse error message dan kembalikan sebagai !trap
                $errItem = [];
                foreach ($sentence as $line) {
                    if (strpos($line, '=') === 0) {
                        $line = substr($line, 1);
                        if (strpos($line, '=') !== false) {
                            [$key, $value] = explode('=', $line, 2);
                            $errItem[$key] = $value;
                        }
                    }
                }
                if (!isset($errItem['message']) && isset($sentence[1])) {
                    $errItem['message'] = $sentence[1];
                }
                return ['!trap' => [$errItem]];
            }
        }
        return $result;
    }

    private function write($word)
    {
        $len = strlen($word);
        if ($len < 0x80) {
            fwrite($this->socket, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($this->socket, chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        } else {
            // Handle larger lengths if needed
            // For now, assume short words
            fwrite($this->socket, chr(0)); // Fail safe
            return;
        }
        fwrite($this->socket, $word);
    }

    private function read()
    {
        $sentence = [];
        while (true) {
            $byte = fread($this->socket, 1);
            if ($byte === false || $byte === '')
                return $sentence; // Connection closed

            $len = ord($byte);
            if ($len & 0x80) {
                $len &= 0x7F;
                $len <<= 8;
                $byte2 = fread($this->socket, 1);
                $len |= ord($byte2);
            }
            // Handle larger lengths if needed

            if ($len === 0)
                return $sentence;

            $word = '';
            if ($len > 0) {
                $word = "";
                while (strlen($word) < $len) {
                    $chunk = fread($this->socket, $len - strlen($word));
                    if ($chunk === false || $chunk === '')
                        break;
                    $word .= $chunk;
                }
            }
            $sentence[] = $word;
        }
    }

    public function disconnect()
    {
        // Tutup koneksi secara benar setelah selesai digunakan
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
        $this->connected = false;
    }
}
