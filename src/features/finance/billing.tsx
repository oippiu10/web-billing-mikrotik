import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCheck,
  XCircle,
  Wallet,
  Printer,
  History,
  Calendar,
  FileText,
  RefreshCw,
  MessageCircle,
  PenLine,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { usePrivacyStore } from '@/stores/privacy-store'
import { useRouterStore } from '@/stores/router-store'
import { api } from '@/lib/api'
import { usePermission } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PrivacyText } from '@/components/privacy'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { RouterSelector } from '@/components/router-selector'
import { ThemeSwitch } from '@/components/theme-switch'
import { FinanceSubNav } from './components/finance-sub-nav'

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

const escapeHtml = (value: unknown) =>
  String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const printInvoice = (row: any, month: number, year: number) => {
  const invoiceNo = `INV-${year}${String(month).padStart(2, '0')}-${row.user_id || row.id || row.username}`
  const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
  const status = row.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'
  const html = `<!doctype html>
<html>
<head>
  <title>${escapeHtml(invoiceNo)}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;background:#f3f4f6}
    .paper{max-width:760px;margin:auto;background:white;padding:32px;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.08)}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111827;padding-bottom:18px;margin-bottom:24px}
    h1{margin:0;font-size:28px}.muted{color:#6b7280;font-size:13px}.badge{display:inline-block;padding:8px 12px;border-radius:999px;font-weight:800;font-size:12px;background:${row.status === 'paid' ? '#dcfce7;color:#166534' : '#ffedd5;color:#9a3412'}}
    table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:12px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;text-transform:uppercase;color:#6b7280}.right{text-align:right}.total{font-size:22px;font-weight:900}.footer{margin-top:32px;font-size:12px;color:#6b7280;text-align:center}@media print{body{background:white;padding:0}.paper{box-shadow:none;border-radius:0}.no-print{display:none}}
  </style>
</head>
<body>
  <div class='paper'>
    <div class='top'>
      <div><h1>Invoice Tagihan</h1><div class='muted'>Web Billing MikroTik</div></div>
      <div style='text-align:right'><strong>${escapeHtml(invoiceNo)}</strong><br/><span class='muted'>Periode ${MONTHS_ID[month - 1]} ${year}</span><br/><br/><span class='badge'>${status}</span></div>
    </div>
    <table>
      <tr><th>Pelanggan</th><td>${escapeHtml(row.username)}</td></tr>
      <tr><th>Alamat</th><td>${escapeHtml(row.alamat)}</td></tr>
      <tr><th>Paket</th><td>${escapeHtml(row.profile)}</td></tr>
      <tr><th>Tanggal Bayar</th><td>${escapeHtml(row.paid_at || '-')}</td></tr>
    </table>
    <table>
      <thead><tr><th>Deskripsi</th><th class='right'>Nominal</th></tr></thead>
      <tbody><tr><td>Tagihan internet ${escapeHtml(MONTHS_ID[month - 1])} ${year}</td><td class='right'>${amount}</td></tr></tbody>
      <tfoot><tr><td class='total'>Total</td><td class='right total'>${amount}</td></tr></tfoot>
    </table>
    <div class='footer'>Terima kasih atas pembayaran Anda. Simpan invoice ini sebagai bukti pembayaran.</div>
    <p class='no-print' style='text-align:center;margin-top:24px'><button onclick='window.print()' style='padding:10px 18px;border:0;border-radius:10px;background:#111827;color:white;font-weight:700'>Print / Save PDF</button></p>
  </div>
</body>
</html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
}

export function FinanceBilling() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const permissions = usePermission()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [profile, setProfile] = useState('')
  const [tipe, setTipe] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  // Selection states
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  // Paid dialog
  const [paidDialog, setPaidDialog] = useState<any>(null)
  const [bulkPaidDialog, setBulkPaidDialog] = useState<boolean>(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [paidDate, setPaidDate] = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')
  const [paidNote, setPaidNote] = useState('')
  const [isInstallmentMode, setIsInstallmentMode] = useState(false)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentNote, setInstallmentNote] = useState('')

  // History dialog state
  const [historyUser, setHistoryUser] = useState<any>(null)

  // Fetch payment history for selected user
  const { data: userHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['billing-user-history', historyUser?.id],
    queryFn: async () => {
      const res = await api.get('/get_user_payment_history.php', {
        params: { user_id: historyUser?.id },
      })
      return res.data.data || []
    },
    enabled: !!historyUser?.id,
  })

  const { data, isLoading } = useQuery({
    queryKey: [
      'billing',
      activeRouter?.id,
      month,
      year,
      search,
      status,
      profile,
      page,
      tipe,
    ],
    queryFn: async () => {
      const res = await api.get('/get_all_payments_for_month_year.php', {
        params: {
          router_id: activeRouter?.software_id || activeRouter?.id,
          month,
          year,
          search,
          status,
          profile,
          page,
          per_page: perPage,
          tipe: tipe || undefined,
        },
      })
      return res.data
    },
    enabled: !!activeRouter,
  })

  // Profiles dari backend supaya filter tetap lengkap walau halaman/pencarian sedang terbatas
  const allProfiles = data?.profiles || []

  const markPaid = useMutation({
    mutationFn: async (row: any) => {
      const res = await api.post('/payment_operations.php', {
        action: 'mark_paid',
        router_id: activeRouter?.software_id || activeRouter?.id,
        username: row.username,
        payment_id: row.user_id,
        amount: row.calculatedAmount !== undefined ? row.calculatedAmount : (parseFloat(paidAmount) || parseFloat(row.harga) || 0),
        paid_date: paidDate,
        method: paidMethod,
        note: row.calculatedNote !== undefined ? row.calculatedNote : paidNote,
        month,
        year,
      })
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success('Pembayaran berhasil dicatat!')
        queryClient.invalidateQueries({ queryKey: ['billing'] })
        queryClient.invalidateQueries({ queryKey: ['receivable'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        queryClient.invalidateQueries({ queryKey: ['finance-annual'] })
        setPaidDialog(null)
      } else toast.error(d.message || 'Gagal')
    },
  })

  const markUnpaid = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await api.post('/payment_operations.php', {
        action: 'mark_unpaid',
        router_id: activeRouter?.software_id || activeRouter?.id,
        payment_id: paymentId,
      })
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success('Status dibatalkan')
        queryClient.invalidateQueries({ queryKey: ['billing'] })
        queryClient.invalidateQueries({ queryKey: ['receivable'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        queryClient.invalidateQueries({ queryKey: ['finance-annual'] })
      } else toast.error(d.message || 'Gagal')
    },
  })

  const bulkMarkPaid = useMutation({
    mutationFn: async () => {
      const usersToPay = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id) && r.status !== 'paid')
      if (usersToPay.length === 0) return { success: false, message: 'Tidak ada data valid untuk dilunasi' }
      
      const payload = {
        action: 'bulk_mark_paid',
        router_id: activeRouter?.software_id || activeRouter?.id,
        month,
        year,
        paid_date: paidDate,
        method: paidMethod,
        note: paidNote,
        users: usersToPay.map((u: any) => ({
          user_id: u.user_id,
          username: u.username,
          amount: parseFloat(u.harga || 0)
        }))
      }
      const res = await api.post('/payment_operations.php', payload)
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success(d.message || 'Pembayaran massal berhasil!')
        setSelectedRows(new Set())
        setBulkPaidDialog(false)
        queryClient.invalidateQueries({ queryKey: ['billing'] })
        queryClient.invalidateQueries({ queryKey: ['receivable'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        queryClient.invalidateQueries({ queryKey: ['finance-annual'] })
      } else toast.error(d.message || 'Gagal')
    },
  })

  const toggleSelectAll = () => {
    if (selectedRows.size === (data?.data || []).length && data?.data?.length > 0) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set((data?.data || []).map((r: any) => r.user_id)))
    }
  }

  const toggleSelectRow = (userId: number) => {
    const newSet = new Set(selectedRows)
    if (newSet.has(userId)) newSet.delete(userId)
    else newSet.add(userId)
    setSelectedRows(newSet)
  }

  const humanizeName = (username: string) => {
    if (!username) return 'Pelanggan'
    let name = username.includes('@') ? (username.split('@').pop() || username) : username
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const handleWA = (row: any) => {
    const phone = row.wa?.replace(/^0/, '62') || ''
    if (!phone) {
      toast.error('Nomor WA tidak tersedia untuk pelanggan ini')
      return
    }
    const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
    const bulan = MONTHS_ID[month - 1]
    const customerName = humanizeName(row.username)
    
    let msg = ''
    if (row.status === 'paid') {
      msg = `Halo Saudara/i *${customerName}*,\nTerima kasih, pembayaran internet Anda untuk periode *${bulan} ${year}* sebesar *${amount}* telah kami terima dan lunas.\n\nSimpan pesan ini sebagai bukti pembayaran yang sah.\n\nTerima kasih,\n*Admin Internet*`
    } else {
      msg = `Halo Saudara/i *${customerName}*,\nKami informasikan bahwa tagihan internet Anda untuk periode *${bulan} ${year}* sebesar *${amount}* telah terbit.\n\nMohon untuk segera melakukan pembayaran agar layanan internet tetap berjalan lancar.\n\nTerima kasih,\n*Admin Internet*`
    }
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const printBulkThermal = () => {
    const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
    if (usersToPrint.length === 0) return

    let html = `<!doctype html><html><head><title>Cetak Massal Struk Thermal</title><style>
    body{font-family:'Courier New',Courier,monospace;margin:0;padding:0;background:white;color:black;font-size:12px;width:58mm}
    @page{margin:0}
    .page-break{page-break-after:always}
    .center{text-align:center}.bold{font-weight:bold}.line{border-bottom:1px dashed black;margin:5px 0}.table{width:100%}.table td{vertical-align:top;padding:2px 0}.right{text-align:right}.mb-1{margin-bottom:5px}.mb-2{margin-bottom:10px}.mt-2{margin-top:10px}
    @media print{.no-print{display:none}body{width:58mm}}
    </style></head><body>
    <div class="no-print center" style="padding:10px"><button onclick="window.print()" style="padding:8px 16px;background:black;color:white;border-radius:4px;cursor:pointer">Print Thermal (${usersToPrint.length})</button></div>
    `

    usersToPrint.forEach((row: any, i: number) => {
      const invoiceNo = `INV-${year}${String(month).padStart(2, '0')}-${row.user_id || row.id || row.username}`
      const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
      const statusText = row.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'
      
      html += `
      <div style="padding:5px;">
        <div class="center bold mb-1" style="font-size:14px">WIFIKU NET</div>
        <div class="center mb-2">BUKTI PEMBAYARAN</div>
        <div class="line"></div>
        <table class="table">
          <tr><td>No</td><td class="right">${invoiceNo}</td></tr>
          <tr><td>Tgl</td><td class="right">${row.paid_at || new Date().toISOString().slice(0, 10)}</td></tr>
          <tr><td>Plg</td><td class="right">${humanizeName(row.username)}</td></tr>
          <tr><td>Bln</td><td class="right">${MONTHS_ID[month - 1]} ${year}</td></tr>
        </table>
        <div class="line"></div>
        <table class="table">
          <tr><td>Internet</td><td class="right">${amount}</td></tr>
          <tr><td colspan="2"><div class="line"></div></td></tr>
          <tr><td class="bold">TOTAL</td><td class="right bold">${amount}</td></tr>
        </table>
        <div class="center mt-2">
          STATUS: <span class="bold">${statusText}</span>
        </div>
        <div class="center" style="font-size:10px;margin-top:10px">Terima kasih atas pembayaran Anda.</div>
      </div>
      ${i < usersToPrint.length - 1 ? '<div class="page-break"></div>' : ''}
      `
    })

    html += '</body></html>'
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  const printThermal = (row: any, month: number, year: number) => {
    const invoiceNo = `INV-${year}${String(month).padStart(2, '0')}-${row.user_id || row.id || row.username}`
    const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
    const statusText = row.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'

    const html = `<!doctype html><html><head><title>Cetak Struk Thermal - ${row.username}</title><style>
    body{font-family:'Courier New',Courier,monospace;margin:0;padding:0;background:white;color:black;font-size:12px;width:58mm}
    @page{margin:0}
    .center{text-align:center}.bold{font-weight:bold}.line{border-bottom:1px dashed black;margin:5px 0}.table{width:100%}.table td{vertical-align:top;padding:2px 0}.right{text-align:right}.mb-1{margin-bottom:5px}.mb-2{margin-bottom:10px}.mt-2{margin-top:10px}
    @media print{.no-print{display:none}body{width:58mm}}
    </style></head><body>
    <div class="no-print center" style="padding:10px"><button onclick="window.print()" style="padding:8px 16px;background:black;color:white;border-radius:4px;cursor:pointer">Print Thermal</button></div>
    <div style="padding:5px;">
      <div class="center bold mb-1" style="font-size:14px">WIFIKU NET</div>
      <div class="center mb-2">BUKTI PEMBAYARAN</div>
      <div class="line"></div>
      <table class="table">
        <tr><td>No</td><td class="right">${invoiceNo}</td></tr>
        <tr><td>Tgl</td><td class="right">${row.paid_at || new Date().toISOString().slice(0, 10)}</td></tr>
        <tr><td>Plg</td><td class="right">${humanizeName(row.username)}</td></tr>
        <tr><td>Bln</td><td class="right">${MONTHS_ID[month - 1]} ${year}</td></tr>
      </table>
      <div class="line"></div>
      <table class="table">
        <tr><td>Internet</td><td class="right">${amount}</td></tr>
        <tr><td colspan="2"><div class="line"></div></td></tr>
        <tr><td class="bold">TOTAL</td><td class="right bold">${amount}</td></tr>
      </table>
      <div class="center mt-2">
        STATUS: <span class="bold">${statusText}</span>
      </div>
      <div class="center" style="font-size:10px;margin-top:10px">Terima kasih atas pembayaran Anda.</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`

    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  const printBulkInvoice = () => {
    const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
    if (usersToPrint.length === 0) return

    let html = `<!doctype html><html><head><title>Cetak Massal Invoice</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f3f4f6}
    .page-break{page-break-after:always}
    .paper{max-width:760px;margin:20px auto;background:white;padding:32px;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.08)}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111827;padding-bottom:18px;margin-bottom:24px}
    h1{margin:0;font-size:28px}.muted{color:#6b7280;font-size:13px}.badge{display:inline-block;padding:8px 12px;border-radius:999px;font-weight:800;font-size:12px}
    .paid{background:#dcfce7;color:#166534}.unpaid{background:#ffedd5;color:#9a3412}
    table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:12px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;text-transform:uppercase;color:#6b7280}.right{text-align:right}.total{font-size:22px;font-weight:900}.footer{margin-top:32px;font-size:12px;color:#6b7280;text-align:center}@media print{body{background:white}.paper{box-shadow:none;margin:0;border-radius:0;padding:20px 0}.no-print{display:none}}
    </style></head><body>
    <div class="no-print" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:10px 20px;background:#111827;color:white;border-radius:8px;font-weight:bold;cursor:pointer">Print Semua (${usersToPrint.length} Invoice)</button></div>
    `

    usersToPrint.forEach((row: any, i: number) => {
      const invoiceNo = `INV-${year}${String(month).padStart(2, '0')}-${row.user_id || row.id || row.username}`
      const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
      const statusClass = row.status === 'paid' ? 'paid' : 'unpaid'
      const statusText = row.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'
      
      html += `
      <div class="paper">
        <div class="top">
          <div>
            <h1>INVOICE TAGIHAN</h1>
            <div class="muted">No: ${invoiceNo} &bull; Tgl: ${new Date().toISOString().slice(0, 10)}</div>
          </div>
          <div style="text-align:right">
            <div class="badge ${statusClass}">${statusText}</div>
            <div style="margin-top:8px;font-weight:bold;font-size:18px">WIFIKU NET</div>
          </div>
        </div>
        
        <div style="margin-bottom:24px">
          <div class="muted" style="margin-bottom:4px">Ditagihkan kepada:</div>
          <div style="font-weight:bold;font-size:16px">Saudara/i ${humanizeName(row.username)}</div>
          <div class="muted">${row.wa || ''}</div>
        </div>

        <table>
          <thead>
            <tr><th>Deskripsi Layanan</th><th class="right">Jumlah</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Layanan Internet WiFi<br><span class="muted">Periode: ${MONTHS_ID[month - 1]} ${year}</span></td>
              <td class="right" style="font-weight:bold">${amount}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:none;padding-top:24px"></td></tr>
            <tr>
              <td class="right" style="font-size:14px">TOTAL TAGIHAN</td>
              <td class="right total">${amount}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          Terima kasih telah menggunakan layanan WiFiKu Net.<br>
          Simpan invoice ini sebagai bukti pembayaran yang sah.
        </div>
      </div>
      ${i < usersToPrint.length - 1 ? '<div class="page-break"></div>' : ''}
      `
    })

    html += '</body></html>'
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  const printInvoice = (row: any, month: number, year: number) => {
    const invoiceNo = `INV-${year}${String(month).padStart(2, '0')}-${row.user_id || row.id || row.username}`
    const amount = fmt(parseFloat(row.harga || row.paid_amount || 0))
    const statusClass = row.status === 'paid' ? 'paid' : 'unpaid'
    const statusText = row.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'

    const html = `<!doctype html><html><head><title>Invoice ${row.username}</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f3f4f6}
    .paper{max-width:760px;margin:40px auto;background:white;padding:48px;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.08)}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111827;padding-bottom:24px;margin-bottom:32px}
    h1{margin:0;font-size:32px}.muted{color:#6b7280;font-size:14px}.badge{display:inline-block;padding:8px 16px;border-radius:999px;font-weight:800;font-size:12px}
    .paid{background:#dcfce7;color:#166534}.unpaid{background:#ffedd5;color:#9a3412}
    table{width:100%;border-collapse:collapse;margin-top:32px}td,th{padding:16px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;text-transform:uppercase;color:#6b7280}.right{text-align:right}.total{font-size:24px;font-weight:900}.footer{margin-top:48px;font-size:13px;color:#6b7280;text-align:center}@media print{body{background:white}.paper{box-shadow:none;margin:0;border-radius:0;padding:20px}.no-print{display:none}}
    </style></head><body>
    <div class="no-print" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:10px 20px;background:#111827;color:white;border-radius:8px;font-weight:bold;cursor:pointer">Print Invoice</button></div>
    <div class="paper">
      <div class="top">
        <div>
          <h1>INVOICE TAGIHAN</h1>
          <div class="muted">No: ${invoiceNo} &bull; Tgl: ${new Date().toISOString().slice(0, 10)}</div>
        </div>
        <div style="text-align:right">
          <div class="badge ${statusClass}">${statusText}</div>
          <div style="margin-top:12px;font-weight:bold;font-size:20px">WIFIKU NET</div>
        </div>
      </div>
      
      <div style="margin-bottom:32px">
        <div class="muted" style="margin-bottom:4px">Ditagihkan kepada:</div>
        <div style="font-weight:bold;font-size:18px">Saudara/i ${humanizeName(row.username)}</div>
        <div class="muted">${row.wa || ''}</div>
      </div>

      <table>
        <thead>
          <tr><th>Deskripsi Layanan</th><th class="right">Jumlah</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Layanan Internet WiFi<br><span class="muted">Periode: ${MONTHS_ID[month - 1]} ${year}</span></td>
            <td class="right" style="font-weight:bold">${amount}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:none;padding-top:32px"></td></tr>
          <tr>
            <td class="right" style="font-size:16px">TOTAL TAGIHAN</td>
            <td class="right total">${amount}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        Terima kasih telah menggunakan layanan WiFiKu Net.<br>
        Simpan invoice ini sebagai bukti pembayaran yang sah.
      </div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`

    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  const summary = data?.summary || {
    paid: 0,
    unpaid: 0,
    collected: 0,
    receivable: 0,
    target_amount: 0,
    collection_rate: 0,
  }
  const totalPages = Math.ceil((data?.total || 0) / perPage)

  const exportUrl = `/api/payment_operations.php?action=export&router_id=${activeRouter?.software_id || activeRouter?.id}&month=${month}&year=${year}&search=${search}`

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='rounded-lg bg-primary/10 p-2'>
            <Receipt className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Tagihan Bulanan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <FinanceSubNav active='/finance/billing' />
          
          <div className="flex items-center gap-2">
            {/* Month */}
            <Select
              value={String(month)}
              onValueChange={(v) => {
                setMonth(parseInt(v))
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-32 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_ID.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year */}
            <Select
              value={String(year)}
              onValueChange={(v) => {
                setYear(parseInt(v))
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-24 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  now.getFullYear(),
                  now.getFullYear() - 1,
                  now.getFullYear() - 2,
                ].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Strip */}
        <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-emerald-500 to-green-600 text-white'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Lunas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl xl:text-3xl font-black mb-1 truncate'>
                <PrivacyText>{summary.paid}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Total pelanggan lunas
              </div>
            </CardContent>
            <CheckCircle2 className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>

          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-orange-500 to-amber-600 text-white'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Belum Bayar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl xl:text-3xl font-black mb-1 truncate'>
                <PrivacyText>{summary.unpaid}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Menunggu pembayaran
              </div>
            </CardContent>
            <Clock className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>

          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-blue-500 to-indigo-600 text-white'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Terkumpul</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-xl xl:text-2xl font-black mb-1 truncate'>
                <PrivacyText>{fmt(summary.collected)}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Total dana masuk
              </div>
            </CardContent>
            <Wallet className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>

          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-rose-500 to-pink-600 text-white'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Sisa Piutang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-xl xl:text-2xl font-black mb-1 truncate'>
                <PrivacyText>{fmt(summary.receivable)}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Collection Rate: <PrivacyText>{summary.collection_rate}</PrivacyText>%
              </div>
            </CardContent>
            <Receipt className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>
        </div>

        {/* Filters */}
        <div className='flex flex-col gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
          {/* Left Side: Selectors & Search Input */}
          <div className='flex flex-wrap items-center gap-2 flex-1 min-w-0'>
            {/* Status */}
            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-32 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue placeholder='Semua Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Semua Status</SelectItem>
                <SelectItem value='paid'>Lunas</SelectItem>
                <SelectItem value='unpaid'>Belum Bayar</SelectItem>
              </SelectContent>
            </Select>

            {/* Tipe Langganan */}
            <Select
              value={tipe || 'all'}
              onValueChange={(v) => {
                setTipe(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-36 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue placeholder='Semua Tipe' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Semua Tipe</SelectItem>
                <SelectItem value='prabayar'>Prabayar</SelectItem>
                <SelectItem value='pascabayar'>Pascabayar</SelectItem>
              </SelectContent>
            </Select>

            {/* Profile */}
            <Select
              value={profile || 'all'}
              onValueChange={(v) => {
                setProfile(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className='h-9 w-36 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue placeholder='Semua Paket' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Semua Paket</SelectItem>
                {allProfiles.map((p: any) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className='relative min-w-[160px] flex-1 max-w-[240px]'>
              <Search className='absolute top-2.5 left-3 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Cari username...'
                className='h-9 pl-9 text-xs rounded-lg border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Right Side: Action Buttons (Reset, Export) */}
          <div className='flex items-center justify-end gap-2 border-t pt-3 sm:border-none sm:pt-0 shrink-0 ml-auto sm:ml-0'>
            <Button
              size='sm'
              variant='ghost'
              className='h-9 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 rounded-lg'
              onClick={() => {
                setSearch('')
                setStatus('')
                setProfile('')
                setPage(1)
              }}
            >
              <RefreshCw className='h-3.5 w-3.5' />
              Reset
            </Button>

            <Button
              size='sm'
              variant='outline'
              className='h-9 gap-1.5 text-xs font-semibold border-border hover:bg-accent rounded-lg shadow-sm'
              onClick={() => window.open(exportUrl)}
            >
              <Download className='h-3.5 w-3.5' /> Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className='overflow-hidden border border-border/80 shadow-lg rounded-xl bg-card'>
          <div className='overflow-x-auto w-full'>
            <Table>
            <TableHeader className='bg-slate-50/75 dark:bg-slate-900/60 border-b border-border/60'>
              <TableRow>
                {permissions.canManageFinance && (
                  <TableHead className='w-12 pl-4'>
                    <Checkbox 
                      checked={data?.data?.length > 0 && selectedRows.size === data.data.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className={cn('text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider', !permissions.canManageFinance && 'pl-4')}>
                  Username
                </TableHead>
                <TableHead className='text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
                  Paket
                </TableHead>
                <TableHead className='text-right pr-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
                  Tagihan
                </TableHead>
                <TableHead className='text-right pr-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
                  Bayar
                </TableHead>
                <TableHead className='text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
                  Status
                </TableHead>
                <TableHead className='hidden text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider lg:table-cell'>
                  Tgl Bayar
                </TableHead>
                {permissions.canManageFinance && (
                  <TableHead className='pr-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>
                    Aksi
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading ? (
                 <TableRow>
                   <TableCell
                     colSpan={permissions.canManageFinance ? 8 : 6}
                     className='animate-pulse py-16 text-center text-muted-foreground'
                   >
                     Memuat data...
                   </TableCell>
                 </TableRow>
               ) : (data?.data || []).length === 0 ? (
                 <TableRow>
                   <TableCell
                     colSpan={permissions.canManageFinance ? 8 : 6}
                     className='py-16 text-center text-muted-foreground'
                   >
                     Tidak ada data
                   </TableCell>
                 </TableRow>
              ) : (
                (data?.data || []).map((row: any) => (
                  <TableRow
                    key={row.user_id}
                    className={cn(
                      'border-b border-border/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-150',
                      row.status === 'paid' &&
                        'bg-emerald-50/10 dark:bg-emerald-950/5 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10',
                      selectedRows.has(row.user_id) && 'bg-primary/5 hover:bg-primary/10'
                    )}
                  >
                    {permissions.canManageFinance && (
                      <TableCell className='pl-4'>
                        <Checkbox 
                          checked={selectedRows.has(row.user_id)}
                          onCheckedChange={() => toggleSelectRow(row.user_id)}
                        />
                      </TableCell>
                    )}
                    <TableCell
                      className={cn('cursor-pointer text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300', !permissions.canManageFinance && 'pl-4')}
                      onClick={() =>
                        setHistoryUser({
                          id: row.user_id,
                          username: row.username,
                        })
                      }
                    >
                      <div className="flex items-center gap-2">
                        <PrivacyText>{row.username}</PrivacyText>
                        <Badge 
                          variant='outline' 
                          className={cn(
                            'text-[9px] font-black uppercase tracking-wider px-1.5 py-0 rounded border shadow-3xs scale-90 origin-left transition-all',
                            row.tipe_langganan === 'prabayar'
                              ? 'border-emerald-500 text-emerald-600 bg-emerald-50' 
                              : 'border-blue-500 text-blue-600 bg-blue-50'
                          )}
                        >
                          {row.tipe_langganan === 'prabayar' ? 'Pra' : 'Pasca'}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant='secondary'
                        className='text-[10px] font-bold bg-muted hover:bg-muted text-muted-foreground border-none rounded-md px-1.5 py-0.5'
                      >
                        {row.profile}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm font-semibold text-muted-foreground pr-4'>
                      <PrivacyText>
                        {fmt(parseFloat(row.harga || 0))}
                      </PrivacyText>
                    </TableCell>
                    <TableCell 
                      className={cn(
                        'text-right font-mono text-sm font-bold pr-4 transition-all duration-150',
                        row.status === 'paid' 
                          ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline decoration-dashed underline-offset-4' 
                          : 'text-muted-foreground'
                      )}
                      onClick={() => {
                        if (row.status === 'paid') {
                          setHistoryUser({ id: row.user_id, username: row.username })
                        }
                      }}
                      title={row.status === 'paid' ? 'Klik untuk melihat rincian riwayat angsuran' : undefined}
                    >
                      <PrivacyText>
                        {row.status === 'paid' ? fmt(parseFloat(row.paid_amount || row.harga || 0)) : '-'}
                      </PrivacyText>
                    </TableCell>
                    <TableCell className='text-center'>
                      {row.status === 'paid' ? (
                        parseFloat(row.paid_amount || 0) < parseFloat(row.harga || 0) ? (
                          <div className="flex flex-col items-center gap-1">
                            <Badge className='mx-auto flex w-[84px] items-center justify-center gap-1 border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400 rounded-full shadow-sm shadow-amber-500/5'>
                              <AlertCircle className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0' />
                              Kurang
                            </Badge>
                            <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 tracking-wider">
                              -{fmt(parseFloat(row.harga || 0) - parseFloat(row.paid_amount || 0))}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Badge className='mx-auto flex w-[84px] items-center justify-center gap-1 border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full shadow-sm shadow-emerald-500/5'>
                              <CheckCircle2 className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0' />
                              Lunas
                            </Badge>
                            {row.method && (
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{row.method}</span>
                            )}
                          </div>
                        )
                      ) : (
                        <Badge className='mx-auto flex w-[84px] items-center justify-center gap-1 border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400 rounded-full shadow-sm shadow-amber-500/5'>
                          <Clock className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0' />
                          Belum
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className='hidden text-xs font-semibold text-muted-foreground/80 lg:table-cell'>
                      {row.paid_at || '-'}
                      {row.note && <div className="text-[10px] text-muted-foreground/60 italic max-w-[120px] truncate" title={row.note}>{row.note}</div>}
                    </TableCell>
                    {permissions.canManageFinance && (
                      <TableCell className='pr-4 text-right'>
                        <div className='flex justify-end gap-1.5'>
                          {/* PRIMARY ACTION: WhatsApp */}
                          <Button
                            variant='outline'
                            size='icon'
                            className={cn('h-8 w-8 transition-all duration-200 rounded-lg shadow-sm',
                              row.status === 'paid' 
                                ? 'border-emerald-100 text-emerald-600 bg-emerald-50/30 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400 dark:bg-emerald-950/10' 
                                : 'border-amber-100 text-amber-600 bg-amber-50/30 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-400 dark:bg-amber-950/10'
                            )}
                            onClick={() => handleWA(row)}
                            title={row.status === 'paid' ? 'Kirim Kwitansi via WA' : 'Kirim Tagihan via WA'}
                          >
                            <MessageCircle className='h-4 w-4' />
                          </Button>
                          
                          {/* PRIMARY ACTION: Edit or Mark Paid */}
                          {row.status === 'paid' ? (
                            <Button
                              size='icon'
                              className='h-8 w-8 bg-blue-500 text-white shadow-sm shadow-blue-500/10 transition-all duration-200 hover:bg-blue-600 hover:shadow-blue-500/25 rounded-lg'
                              onClick={() => {
                                setPaidDialog(row)
                                setPaidAmount(row.paid_amount || row.harga || '')
                                setPaidDate(row.paid_at || now.toISOString().slice(0, 10))
                                setPaidMethod(row.method || 'cash')
                                setPaidNote(row.note || '')
                                setIsInstallmentMode(false)
                                setInstallmentAmount('')
                                setInstallmentNote('')
                              }}
                              title='Edit Pembayaran'
                            >
                              <PenLine className='h-4 w-4' />
                            </Button>
                          ) : (
                            <Button
                              size='icon'
                              className='h-8 w-8 bg-emerald-500 text-white shadow-sm shadow-emerald-500/10 transition-all duration-200 hover:bg-emerald-600 hover:shadow-emerald-500/25 rounded-lg'
                              onClick={() => {
                                setPaidDialog(row)
                                setPaidAmount(row.harga || '')
                                setPaidDate(now.toISOString().slice(0, 10))
                                setPaidMethod('cash')
                                setPaidNote('')
                                setIsInstallmentMode(false)
                                setInstallmentAmount('')
                                setInstallmentNote('')
                              }}
                              title='Tandai Lunas'
                            >
                              <CheckCheck className='h-4 w-4' />
                            </Button>
                          )}

                          {/* SECONDARY ACTIONS: Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='outline'
                                size='icon'
                                className='h-8 w-8 border-border/80 text-muted-foreground bg-background transition-all duration-200 hover:text-foreground hover:bg-accent rounded-lg shadow-sm'
                              >
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => printThermal(row, month, year)}
                                className="cursor-pointer"
                              >
                                <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
                                Cetak Struk Thermal
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => printInvoice(row, month, year)}
                                className="cursor-pointer"
                              >
                                <Printer className="mr-2 h-4 w-4 text-muted-foreground" />
                                Cetak Invoice PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setHistoryUser({ id: row.user_id, username: row.username })}
                                className="cursor-pointer"
                              >
                                <History className="mr-2 h-4 w-4 text-muted-foreground" />
                                Riwayat Pembayaran
                              </DropdownMenuItem>
                              
                              {row.status === 'paid' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      if (confirm(`Yakin membatalkan pelunasan tagihan ${row.username}?`)) markUnpaid.mutate(row.payment_id)
                                    }}
                                    className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/50"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Batalkan Pembayaran
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {(data?.total || 0) > 0 && (
            <div className='flex items-center justify-between border-t bg-card px-4 py-3.5 text-card-foreground select-none'>
              {/* Left Side: Rows per page Select */}
              <div className='flex items-center gap-2'>
                <Select
                  value={String(perPage)}
                  onValueChange={(val) => {
                    setPerPage(Number(val))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className='h-8 w-[72px] gap-1 rounded-md border border-border bg-background px-2 text-xs font-semibold shadow-sm focus:ring-0 focus:ring-offset-0'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='10'>10</SelectItem>
                    <SelectItem value='20'>20</SelectItem>
                    <SelectItem value='50'>50</SelectItem>
                    <SelectItem value='100'>100</SelectItem>
                  </SelectContent>
                </Select>
                <span className='text-xs font-semibold text-muted-foreground'>
                  Rows per page
                </span>
              </div>

              {/* Right Side: Page indicator & Page Buttons */}
              <div className='ml-auto flex items-center gap-6'>
                <span className='text-xs font-semibold text-foreground/80'>
                  Page {page} of {totalPages || 1}
                </span>
                <div className='flex items-center gap-1.5'>
                  {/* First Page button */}
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-md border-border/80 text-muted-foreground/80 shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground'
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    <ChevronsLeft className='h-4 w-4' />
                  </Button>

                  {/* Previous Page button */}
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-md border-border/80 text-muted-foreground/80 shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground'
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>

                  {/* Page Numbers */}
                  {(() => {
                    const pages = []
                    if (totalPages <= 5) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      if (page <= 3) {
                        for (let i = 1; i <= 4; i++) {
                          pages.push(i)
                        }
                        pages.push('...')
                        pages.push(totalPages)
                      } else if (page >= totalPages - 2) {
                        pages.push(1)
                        pages.push('...')
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        pages.push(1)
                        pages.push('...')
                        pages.push(page - 1)
                        pages.push(page)
                        pages.push(page + 1)
                        pages.push('...')
                        pages.push(totalPages)
                      }
                    }
                    return pages.map((item, idx) => {
                      if (item === '...') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            className='px-1.5 text-xs font-semibold text-muted-foreground/60'
                          >
                            ...
                          </span>
                        )
                      }
                      const isCurrent = item === page
                      return (
                        <Button
                          key={`page-${item}`}
                          variant={isCurrent ? 'default' : 'outline'}
                          className={cn(
                            'h-8 w-8 rounded-md p-0 text-xs font-bold shadow-sm transition-all duration-200',
                            isCurrent
                              ? 'pointer-events-none bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-50 dark:text-slate-950'
                              : 'border-border/80 text-foreground/80 hover:bg-accent hover:text-foreground'
                          )}
                          onClick={() => setPage(Number(item))}
                        >
                          {item}
                        </Button>
                      )
                    })
                  })()}

                  {/* Next Page button */}
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-md border-border/80 text-muted-foreground/80 shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground'
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0}
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>

                  {/* Last Page button */}
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8 rounded-md border-border/80 text-muted-foreground/80 shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground'
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || totalPages === 0}
                  >
                    <ChevronsRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </Main>

      {/* Floating Action Bar for Bulk Actions */}
      {selectedRows.size > 0 && permissions.canManageFinance && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <Card className="bg-slate-900/95 dark:bg-slate-50/95 text-slate-50 dark:text-slate-900 shadow-2xl border-0 backdrop-blur-md px-4 py-3 flex items-center gap-4 rounded-2xl">
            <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50 dark:border-slate-300/50 font-semibold text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {selectedRows.size}
              </span>
              terpilih
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-white/10 dark:text-slate-600 dark:hover:text-slate-900 dark:hover:bg-black/5"
                onClick={() => setSelectedRows(new Set())}
              >
                Batal
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-transparent border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 dark:border-slate-300/50 dark:text-slate-600 dark:hover:text-slate-900 dark:hover:bg-slate-200"
                onClick={printBulkThermal}
              >
                Cetak Thermal
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-transparent border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 dark:border-slate-300/50 dark:text-slate-600 dark:hover:text-slate-900 dark:hover:bg-slate-200"
                onClick={printBulkInvoice}
              >
                Cetak Invoice
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                onClick={() => {
                  setPaidDate(now.toISOString().slice(0, 10))
                  setPaidMethod('cash')
                  setPaidNote('')
                  setBulkPaidDialog(true)
                }}
              >
                Tandai Lunas
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Mark Paid Dialog */}
      <Dialog open={bulkPaidDialog} onOpenChange={setBulkPaidDialog}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-base font-black'>
              Pelunasan Massal ({selectedRows.size} Pelanggan)
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div>
              <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                Tanggal Bayar
              </label>
              <Input
                type='date'
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className='mt-1'
              />
            </div>
            <div>
              <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                Metode
              </label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger className='mt-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='cash'>Tunai</SelectItem>
                  <SelectItem value='transfer'>Transfer Bank</SelectItem>
                  <SelectItem value='qris'>QRIS</SelectItem>
                  <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                Catatan (Opsional)
              </label>
              <Input
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                className='mt-1'
                placeholder='Catatan pembayaran massal...'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setBulkPaidDialog(false)}>
              Batal
            </Button>
            <Button
              className='bg-emerald-500 hover:bg-emerald-600 text-white'
              onClick={() => bulkMarkPaid.mutate()}
              disabled={bulkMarkPaid.isPending}
            >
              <CheckCheck className='mr-1 h-4 w-4' /> Proses ({selectedRows.size}) Lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={!!paidDialog} onOpenChange={() => setPaidDialog(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-base font-black'>
              {parseFloat(String(paidDialog?.paid_amount || 0)) > 0 ? 'Edit Pembayaran' : 'Tandai Lunas'} — {paidDialog?.username}
            </DialogTitle>
          </DialogHeader>

          {paidDialog && parseFloat(String(paidDialog.paid_amount || 0)) > 0 && (
            <div className='grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg text-xs font-bold mb-1 select-none'>
              <button
                type='button'
                onClick={() => setIsInstallmentMode(false)}
                className={cn('py-1.5 rounded-md transition-all', !isInstallmentMode ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Koreksi Total
              </button>
              <button
                type='button'
                onClick={() => setIsInstallmentMode(true)}
                className={cn('py-1.5 rounded-md transition-all', isInstallmentMode ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Tambah Angsuran
              </button>
            </div>
          )}

          <div className='space-y-3 py-2'>
            {isInstallmentMode ? (
              <>
                {/* Installment Summary Panel */}
                <div className='bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-border/60 text-xs space-y-1.5 mb-2'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Total Tagihan Paket:</span>
                    <span className='font-mono font-extrabold text-foreground'>{fmt(parseFloat(String(paidDialog?.harga || 0)))}</span>
                  </div>
                  <div className='flex justify-between text-emerald-600 dark:text-emerald-400'>
                    <span>Terbayar Sebelumnya:</span>
                    <span className='font-mono font-extrabold'>{fmt(parseFloat(String(paidDialog?.paid_amount || 0)))}</span>
                  </div>
                  <div className='flex justify-between text-rose-500 font-bold border-t border-dashed pt-1.5'>
                    <span>Sisa Kekurangan:</span>
                    <span className='font-mono font-extrabold'>
                      {fmt(Math.max(0, parseFloat(String(paidDialog?.harga || 0)) - parseFloat(String(paidDialog?.paid_amount || 0))))}
                    </span>
                  </div>
                </div>

                {/* Additional Amount input */}
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Nominal Tambahan Setor (Rp)
                  </label>
                  <Input
                    type={privacyMode ? 'password' : 'number'}
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    className='mt-1 font-mono'
                    placeholder='0'
                  />
                  {parseFloat(installmentAmount || "0") > 0 && (
                    <div className='flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-900 px-2 py-1.5 rounded-md mt-1.5 select-none'>
                      <span>Total Setelah Setor:</span>
                      <span className={cn('font-mono font-extrabold', (parseFloat(String(paidDialog?.paid_amount || 0)) + parseFloat(installmentAmount || "0")) >= parseFloat(String(paidDialog?.harga || 0)) ? 'text-emerald-600' : 'text-amber-600')}>
                        {fmt(parseFloat(String(paidDialog?.paid_amount || 0)) + parseFloat(installmentAmount || "0"))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Date of installment (reuses paidDate) */}
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Tanggal Setor
                  </label>
                  <Input
                    type='date'
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className='mt-1'
                  />
                </div>

                {/* Method of installment (reuses paidMethod) */}
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Metode Setor
                  </label>
                  <Select value={paidMethod} onValueChange={setPaidMethod}>
                    <SelectTrigger className='mt-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='cash'>Tunai</SelectItem>
                      <SelectItem value='transfer'>Transfer Bank</SelectItem>
                      <SelectItem value='qris'>QRIS</SelectItem>
                      <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Note of installment */}
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Catatan Setoran (Opsional)
                  </label>
                  <Input
                    value={installmentNote}
                    onChange={(e) => setInstallmentNote(e.target.value)}
                    className='mt-1'
                    placeholder='Misal: Pelunasan sisa...'
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Nominal (Rp)
                  </label>
                  <Input
                    type={privacyMode ? 'password' : 'number'}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className='mt-1 font-mono'
                    placeholder='0'
                  />
                  {paidDialog && parseFloat(String(paidDialog.harga || 0)) > 0 && (
                    <div className='flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-900 px-2 py-1.5 rounded-md mt-1.5 select-none'>
                      <span>Paket: <span className='font-mono font-extrabold text-foreground'>{fmt(parseFloat(String(paidDialog.harga || 0)))}</span></span>
                      {parseFloat(String(paidAmount || 0)) < parseFloat(String(paidDialog.harga || 0)) ? (
                        <span className='text-rose-500 font-black uppercase tracking-wider scale-95'>Kurang: {fmt(parseFloat(String(paidDialog.harga || 0)) - parseFloat(String(paidAmount || 0)))}</span>
                      ) : (
                        <span className='text-emerald-600 font-black uppercase tracking-wider scale-95'>Lunas</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Tanggal Bayar
                  </label>
                  <Input
                    type='date'
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className='mt-1'
                  />
                </div>
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Metode
                  </label>
                  <Select value={paidMethod} onValueChange={setPaidMethod}>
                    <SelectTrigger className='mt-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='cash'>Tunai</SelectItem>
                      <SelectItem value='transfer'>Transfer Bank</SelectItem>
                      <SelectItem value='qris'>QRIS</SelectItem>
                      <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className='text-xs font-bold tracking-wide text-muted-foreground uppercase'>
                    Catatan (Opsional)
                  </label>
                  <Input
                    value={paidNote}
                    onChange={(e) => setPaidNote(e.target.value)}
                    className='mt-1'
                    placeholder='Catatan tambahan...'
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPaidDialog(null)}>
              Batal
            </Button>
            <Button
              className='bg-green-500 hover:bg-green-600'
              onClick={() => {
                let finalAmount = parseFloat(paidAmount) || parseFloat(paidDialog?.harga || 0) || 0;
                let finalNote = paidNote;
                if (isInstallmentMode && paidDialog) {
                  const prevAmount = parseFloat(String(paidDialog.paid_amount || 0));
                  const instAmt = parseFloat(installmentAmount || "0");
                  finalAmount = prevAmount + instAmt;

                  const instDesc = `[Angsuran: +${fmt(instAmt)} tgl ${paidDate} (${paidMethod.toUpperCase()})${installmentNote ? ' - ' + installmentNote : ''}]`;
                  
                  if (paidDialog.note && paidDialog.note.includes('[Angsuran:')) {
                    finalNote = `${paidDialog.note}\n${instDesc}`;
                  } else {
                    const firstDesc = `[Awal: ${fmt(prevAmount)} tgl ${paidDialog.paid_at || paidDate} (${(paidDialog.method || 'CASH').toUpperCase()})${paidDialog.note ? ' - ' + paidDialog.note : ''}]`;
                    finalNote = `${firstDesc}\n${instDesc}`;
                  }
                }
                markPaid.mutate({
                  ...paidDialog,
                  calculatedAmount: finalAmount,
                  calculatedNote: finalNote,
                });
              }}
              disabled={markPaid.isPending}
            >
              <CheckCheck className='mr-1 h-4 w-4' /> Simpan Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!historyUser} onOpenChange={() => setHistoryUser(null)}>
        <DialogContent className='max-w-md gap-0 overflow-hidden p-0'>
          <DialogHeader className='flex flex-row items-center justify-between gap-4 border-b p-4'>
            <DialogTitle className='flex items-center gap-2 text-base font-black'>
              <History className='h-4 w-4 text-primary' />
              Riwayat Pembayaran
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className='max-h-[60vh]'>
            <div className='space-y-4 p-4'>
              {/* Identity Header */}
              <div className='flex items-center justify-between border-b border-border/50 pb-2'>
                <div>
                  <p className='text-xs text-muted-foreground'>
                    Username Pelanggan
                  </p>
                  <p className='text-lg font-black tracking-tight'>
                    <PrivacyText>{historyUser?.username}</PrivacyText>
                  </p>
                </div>
              </div>

              {/* History list */}
              {isHistoryLoading ? (
                <div className='space-y-3 py-2'>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className='animate-pulse space-y-2 rounded-lg border bg-muted/10 p-3'
                    >
                      <div className='flex justify-between'>
                        <div className='h-4 w-28 rounded bg-muted' />
                        <div className='h-4 w-16 rounded bg-muted' />
                      </div>
                      <div className='h-3.5 w-32 rounded bg-muted' />
                    </div>
                  ))}
                </div>
              ) : !userHistory || userHistory.length === 0 ? (
                <div className='flex flex-col items-center justify-center space-y-3 py-12 text-center'>
                  <div className='rounded-full bg-muted/40 p-3'>
                    <Receipt className='h-8 w-8 text-muted-foreground/60' />
                  </div>
                  <div>
                    <h4 className='text-sm font-bold text-foreground'>
                      Belum Ada Riwayat Bayar
                    </h4>
                    <p className='mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground'>
                      Pelanggan ini belum memiliki catatan riwayat pembayaran di
                      database.
                    </p>
                  </div>
                </div>
              ) : (
                <div className='space-y-3'>
                  <p className='px-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                    Daftar Transaksi ({userHistory.length})
                  </p>
                  <div className='space-y-2.5'>
                    {userHistory.map((pay: any) => {
                      const methodLower = (pay.method || 'cash').toLowerCase()
                      let methodColor =
                        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' // Cash
                      if (
                        methodLower.includes('tf') ||
                        methodLower.includes('transfer') ||
                        methodLower.includes('bank')
                      ) {
                        methodColor =
                          'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                      } else if (
                        methodLower.includes('qris') ||
                        methodLower.includes('link') ||
                        methodLower.includes('dana') ||
                        methodLower.includes('gopay')
                      ) {
                        methodColor =
                          'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      }

                      const monthsList = [
                        'Januari',
                        'Februari',
                        'Maret',
                        'April',
                        'Mei',
                        'Juni',
                        'Juli',
                        'Agustus',
                        'September',
                        'Oktober',
                        'November',
                        'Desember',
                      ]
                      const monthName =
                        monthsList[pay.payment_month - 1] ||
                        `Bulan ${pay.payment_month}`

                      return (
                        <div
                          key={pay.id}
                          className='space-y-2.5 rounded-lg border border-border/60 bg-card p-3 transition-all duration-300 hover:shadow-md'
                        >
                          {/* Header row */}
                          <div className='flex items-center justify-between border-b border-border/40 pb-1'>
                            <div className='flex items-center gap-1.5'>
                              <Calendar className='h-3.5 w-3.5 text-indigo-500' />
                              <span className='text-sm font-black text-foreground'>
                                {monthName} {pay.payment_year}
                              </span>
                            </div>
                            <Badge className='h-4 bg-emerald-500 px-1.5 text-[9px] font-black hover:bg-emerald-600'>
                              LUNAS
                            </Badge>
                          </div>

                          {/* Amount & Method */}
                          <div className='flex items-center justify-between text-xs'>
                            <div>
                              <p className='text-[9px] font-bold text-muted-foreground'>
                                NOMINAL
                              </p>
                              <p className='font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400'>
                                <PrivacyText>{fmt(pay.amount)}</PrivacyText>
                              </p>
                            </div>
                            <div className='text-right'>
                              <p className='text-[9px] font-bold text-muted-foreground'>
                                METODE
                              </p>
                              <span
                                className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${methodColor}`}
                              >
                                {pay.method || 'CASH'}
                              </span>
                            </div>
                          </div>

                          {/* Date of payment & Note */}
                          <div className='space-y-1 border-t border-dashed border-border/50 pt-1.5 text-[10px]'>
                            <div className='flex items-center justify-between text-muted-foreground'>
                              <span>Tanggal Bayar:</span>
                              <span className='font-bold text-foreground/80'>
                                {pay.payment_date}
                              </span>
                            </div>
                            {pay.note && (
                              <div className='mt-2 space-y-1.5 border-t border-dashed border-border/30 pt-2 select-none'>
                                <p className='text-[8px] font-black text-muted-foreground uppercase tracking-wider'>
                                  Rincian Riwayat Setoran / Catatan:
                                </p>
                                <div className='space-y-1.5'>
                                  {parseNote(pay.note).map((item) => (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        'text-xs font-semibold px-2 py-1.5 rounded flex items-center gap-2 border leading-normal',
                                        item.isStructured
                                          ? 'bg-slate-50 dark:bg-slate-900/60 border-border/60 text-foreground font-mono text-[10px]'
                                          : 'bg-muted/40 border-border/30 text-foreground/80 italic'
                                      )}
                                    >
                                      {item.isStructured ? (
                                        <div className='flex items-center gap-2 w-full'>
                                          <div className='h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 shadow-xs' />
                                          <span className='w-full break-all'>{item.content}</span>
                                        </div>
                                      ) : (
                                        <div className='flex items-center gap-2 w-full'>
                                          <FileText className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                                          <span className='w-full'>{item.content}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className='flex justify-end border-t bg-muted/20 p-3'>
            <Button
              size='sm'
              onClick={() => setHistoryUser(null)}
              className='h-8 px-4 text-xs'
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const parseNote = (noteText: string) => {
  if (!noteText) return [];
  const lines = noteText.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    const isStructured = line.startsWith('[') && line.includes(']');
    if (isStructured) {
      const content = line.substring(1, line.length - 1);
      return { id: idx, content, isStructured: true };
    }
    return { id: idx, content: line, isStructured: false };
  });
};
