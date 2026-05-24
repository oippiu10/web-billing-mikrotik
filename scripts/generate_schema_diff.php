<?php
$user = 'root';
$pass = 'yahahahusein112';

$conn_old = new mysqli('127.0.0.1', $user, $pass, 'temp_cmm');
$conn_new = new mysqli('127.0.0.1', $user, $pass, 'temp_ori');

if ($conn_old->connect_error || $conn_new->connect_error) {
    die("Connection failed: " . $conn_old->connect_error . " / " . $conn_new->connect_error);
}

$sql_output = "-- Auto-generated Schema Upgrade Script\n-- Upgrading from old (cmmnetwork) to new (ori-localhost)\n\n";

// Get tables from new DB
$res_new = $conn_new->query("SHOW TABLES");
$tables_new = [];
while ($row = $res_new->fetch_row()) {
    $tables_new[] = $row[0];
}

// Get tables from old DB
$res_old = $conn_old->query("SHOW TABLES");
$tables_old = [];
while ($row = $res_old->fetch_row()) {
    $tables_old[] = $row[0];
}

foreach ($tables_new as $table) {
    if (!in_array($table, $tables_old)) {
        // Table is missing in old DB -> generate CREATE TABLE
        $res = $conn_new->query("SHOW CREATE TABLE `$table`");
        $row = $res->fetch_assoc();
        $create_sql = $row['Create Table'];
        
        // Add IF NOT EXISTS for safety
        $create_sql = preg_replace('/CREATE TABLE/', 'CREATE TABLE IF NOT EXISTS', $create_sql, 1);
        $sql_output .= "-- Creating missing table: $table\n";
        $sql_output .= $create_sql . ";\n\n";
    } else {
        // Table exists, check for missing columns
        $cols_new = [];
        $res_cols_new = $conn_new->query("SHOW COLUMNS FROM `$table`");
        while ($col = $res_cols_new->fetch_assoc()) {
            $cols_new[$col['Field']] = $col;
        }

        $cols_old = [];
        $res_cols_old = $conn_old->query("SHOW COLUMNS FROM `$table`");
        while ($col = $res_cols_old->fetch_assoc()) {
            $cols_old[$col['Field']] = $col;
        }

        foreach ($cols_new as $col_name => $col_data) {
            if (!isset($cols_old[$col_name])) {
                // Column is missing in old DB -> generate ALTER TABLE ADD COLUMN
                $res_create = $conn_new->query("SHOW CREATE TABLE `$table`");
                $create_row = $res_create->fetch_assoc();
                $create_stmt = $create_row['Create Table'];
                
                $lines = explode("\n", $create_stmt);
                $col_def_line = "";
                foreach ($lines as $line) {
                    if (strpos(trim($line), "`$col_name`") === 0) {
                        $col_def_line = rtrim(trim($line), ","); // Remove trailing comma
                        break;
                    }
                }
                
                if ($col_def_line) {
                    $sql_output .= "-- Adding missing column $col_name to table $table\n";
                    $sql_output .= "ALTER TABLE `$table` ADD COLUMN $col_def_line;\n\n";
                }
            }
        }
    }
}

file_put_contents(__DIR__ . '/../backup db/upgrade_schema.sql', $sql_output);
echo "Schema upgrade script generated successfully at 'backup db/upgrade_schema.sql'\n";
