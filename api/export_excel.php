<?php
/**
 * Export Excel Lightweight — Menggunakan XML Spreadsheet 2003
 * Mendukung styling warna, bold, border, alignment tanpa dependensi berat
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth/require_auth.php';

// Memastikan hanya role authorized yang bisa export laporan keuangan
require_admin_role(['admin', 'administrator', 'operator'], 'Akses ditolak.');

$action    = $_GET['action'] ?? 'billing';
$routerId  = $_GET['router_id'] ?? '';
$month     = intval($_GET['month'] ?? date('n'));
$year      = intval($_GET['year'] ?? date('Y'));
$search    = trim($_GET['search'] ?? '');
$profile   = trim($_GET['profile'] ?? '');

$monthsList = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
$monthName  = $monthsList[$month - 1] ?? 'Bulan ' . $month;

// Ambil Nama Router
$routerName = "Semua Router";
if (!empty($routerId)) {
    $stmtR = $conn->prepare("SELECT name FROM mikrotik_routers WHERE software_id = ? OR id = ? LIMIT 1");
    $stmtR->bind_param("ss", $routerId, $routerId);
    $stmtR->execute();
    $resR = $stmtR->get_result();
    if ($rowR = $resR->fetch_assoc()) {
        $routerName = $rowR['name'];
    }
    $stmtR->close();
}

$title = "";
$headers = [];
$rows = [];

if ($action === 'billing') {
    $title = "Laporan Pendapatan & Angsuran — " . $monthName . " " . $year;
    $headers = ['No', 'Username', 'Paket', 'Harga Paket', 'Status', 'Nominal Terbayar', 'Sisa Kurang', 'Tanggal Bayar', 'Metode', 'Catatan Setoran'];
    
    // Fetch data billing
    $sql = "SELECT p.*, u.profile, u.alamat 
            FROM payments p 
            LEFT JOIN users u ON p.username = u.username AND p.router_id = u.router_id
            WHERE p.payment_month = ? AND p.payment_year = ?";
    $params = [$month, $year];
    $types = "ii";
    
    if (!empty($routerId)) {
        $sql .= " AND p.router_id = ?";
        $params[] = $routerId;
        $types .= "s";
    }
    
    if (!empty($search)) {
        $sql .= " AND (p.username LIKE ? OR u.alamat LIKE ?)";
        $searchParam = "%" . $search . "%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $types .= "ss";
    }
    
    if (!empty($profile)) {
        $sql .= " AND u.profile = ?";
        $params[] = $profile;
        $types .= "s";
    }
    
    $sql .= " ORDER BY p.status DESC, p.username ASC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $no = 1;
    while ($r = $res->fetch_assoc()) {
        $harga = floatval($r['harga'] ?? 0);
        $paid = floatval($r['paid_amount'] ?? 0);
        $kurang = max(0, $harga - $paid);
        $statusStr = strtoupper($r['status'] ?? 'unpaid');
        
        $rows[] = [
            $no++,
            $r['username'],
            $r['profile'] ?? '-',
            $harga,
            $statusStr,
            $paid,
            $kurang,
            $r['paid_at'] ?? '-',
            strtoupper($r['method'] ?? '-'),
            $r['note'] ?? ''
        ];
    }
    $stmt->close();
} else {
    // Action: receivable (Piutang)
    $title = "Laporan Piutang Pelanggan Menunggak — " . $monthName . " " . $year;
    $headers = ['No', 'Username', 'No WA', 'Alamat', 'Paket', 'Total Tagihan', 'Tgl Tagihan', 'Jumlah Bulan Tunggakan'];
    
    $sql = "SELECT p.*, u.profile, u.alamat, u.wa 
            FROM payments p 
            LEFT JOIN users u ON p.username = u.username AND p.router_id = u.router_id
            WHERE p.payment_month = ? AND p.payment_year = ? AND p.status = 'unpaid'";
    
    $params = [$month, $year];
    $types = "ii";
    
    if (!empty($routerId)) {
        $sql .= " AND p.router_id = ?";
        $params[] = $routerId;
        $types .= "s";
    }
    
    if (!empty($search)) {
        $sql .= " AND (p.username LIKE ? OR u.alamat LIKE ?)";
        $searchParam = "%" . $search . "%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $types .= "ss";
    }
    
    if (!empty($profile)) {
        $sql .= " AND u.profile = ?";
        $params[] = $profile;
        $types .= "s";
    }
    
    $sql .= " ORDER BY p.username ASC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $no = 1;
    while ($r = $res->fetch_assoc()) {
        // Hitung tunggakan bulanan kasarnya
        $tunggakanBulan = 1; 
        if (!empty($r['tanggal_tagihan'])) {
            $tglTagihan = intval($r['tanggal_tagihan']);
            // count overdue month
            $tunggakanBulan = max(1, date('n') - $month + (12 * (date('Y') - $year)));
        }
        
        $rows[] = [
            $no++,
            $r['username'],
            $r['wa'] ?? '-',
            $r['alamat'] ?? '-',
            $r['profile'] ?? '-',
            floatval($r['harga'] ?? 0),
            $r['tanggal_tagihan'] ? 'Setiap tanggal ' . $r['tanggal_tagihan'] : '-',
            $tunggakanBulan . ' bulan'
        ];
    }
    $stmt->close();
}

$fileName = strtolower(str_replace(' ', '_', $title)) . '.xls';

// Set headers for file download
header('Content-Type: application/vnd.ms-excel; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Cache-Control: max-age=0');

// Generate XML Spreadsheet format
echo '<?xml version="1.0"?>' . "\n";
echo '<?mso-application progid="Excel.Sheet"?>' . "\n";
?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>WiFiKu Billing</Author>
  <LastAuthor>Admin</LastAuthor>
  <Created><?php echo date('Y-m-d\TH:i:s\Z'); ?></Created>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:CharSet="1" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#1e1b4b" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sMeta">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#475569" ss:Italic="1"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#ffffff" ss:Bold="1"/>
   <Interior ss:Color="#4f46e5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sData">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10"/>
  </Style>
  <Style ss:ID="sCurrency">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10"/>
   <NumberFormat ss:Format="&quot;Rp&quot;#,##0"/>
  </Style>
  <Style ss:ID="sStatusPaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Color="#15803d" ss:Bold="1"/>
   <Interior ss:Color="#dcfce7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sStatusUnpaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Color="#b91c1c" ss:Bold="1"/>
   <Interior ss:Color="#fee2e2" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Laporan Keuangan">
  <Table ss:ExpandedColumnCount="<?php echo count($headers) + 1; ?>" ss:ExpandedRowCount="<?php echo count($rows) + 6; ?>" x:FullColumns="1"
   x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="180"/>
   
   <Row ss:Height="26">
    <Cell ss:MergeAcross="<?php echo count($headers) - 1; ?>" ss:StyleID="sTitle"><Data ss:Type="String"><?php echo htmlspecialchars($title); ?></Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="<?php echo count($headers) - 1; ?>" ss:StyleID="sMeta"><Data ss:Type="String">MikroTik Router: <?php echo htmlspecialchars($routerName); ?> | Diexport tgl: <?php echo date('d-m-Y H:i'); ?></Data></Cell>
   </Row>
   <Row ss:Index="4" ss:Height="22">
    <?php foreach ($headers as $h): ?>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String"><?php echo htmlspecialchars($h); ?></Data></Cell>
    <?php endforeach; ?>
   </Row>
   
   <?php foreach ($rows as $row): ?>
   <Row ss:Height="19">
     <?php foreach ($row as $colIdx => $val): 
        $style = 'sData';
        $type = 'String';
        
        if (is_numeric($val) && $colIdx > 0 && ($action === 'billing' ? in_array($colIdx, [3, 5, 6]) : $colIdx === 5)) {
            $style = 'sCurrency';
            $type = 'Number';
        } elseif ($action === 'billing' && $colIdx === 4) {
            $style = ($val === 'PAID' || $val === 'LUNAS') ? 'sStatusPaid' : 'sStatusUnpaid';
        }
     ?>
     <Cell ss:StyleID="<?php echo $style; ?>"><Data ss:Type="<?php echo $type; ?>"><?php echo htmlspecialchars($val); ?></Data></Cell>
     <?php endforeach; ?>
   </Row>
   <?php endforeach; ?>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>5</ActiveRow>
     <ActiveCol>1</ActiveCol>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>
