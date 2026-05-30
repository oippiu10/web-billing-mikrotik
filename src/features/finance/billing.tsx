import { useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState
} from '@tanstack/react-table'
import { getBillingColumns } from './components/billing-columns'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
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
  Trash2,
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
import { Skeleton } from '@/components/ui/skeleton'
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
import { useConfirm } from '@/hooks/use-confirm'
import { PaymentDialog } from './components/payment-dialog'
import { printBulkThermal, printThermal, printBulkInvoice, printInvoice } from './utils/print-templates'
import { HistoryDialog } from './components/history-dialog'
import { PaymentCardDialog } from './components/payment-card-dialog'

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



export function FinanceBilling() {
  const navigate = useNavigate()
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const permissions = usePermission()
  const now = new Date()

  // Custom Confirm Dialog Hook
  const { confirm: confirmAction, ConfirmDialog } = useConfirm()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [profile, setProfile] = useState('')
  const [tipe, setTipe] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(() => {
    const saved = localStorage.getItem('billing-per-page')
    return saved ? parseInt(saved) : 20
  })

  // Selection states
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  // Paid dialog
  const [paidDialog, setPaidDialog] = useState<any>(null)
  const [bulkPaidDialog, setBulkPaidDialog] = useState<boolean>(false)
  const [paidDate, setPaidDate] = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')
  const [paidNote, setPaidNote] = useState('')

  // History dialog state
  const [historyUser, setHistoryUser] = useState<any>(null)
  
  // Payment card dialog state
  const [paymentCardUser, setPaymentCardUser] = useState<any>(null)

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
    placeholderData: keepPreviousData,
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
        amount: row.calculatedAmount !== undefined ? row.calculatedAmount : (parseFloat(row.harga) || 0),
        paid_date: row.calculatedDate !== undefined ? row.calculatedDate : paidDate,
        method: row.calculatedMethod !== undefined ? row.calculatedMethod : paidMethod,
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
        queryClient.invalidateQueries({ queryKey: ['billing-user-history'] })
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

  const handleDeleteAngsuran = async (pay: any, itemContent: string, itemRawLine: string) => {
    const ok = await confirmAction({
      title: 'Hapus Angsuran',
      description: `Apakah Anda yakin ingin menghapus angsuran "${itemContent}"?\n\nNominal pembayaran akan otomatis dikurangkan kembali.`,
      confirmText: 'Hapus Angsuran',
      cancelText: 'Batal',
      variant: 'destructive',
    })

    if (!ok) return

    // 1. Extract amount from the raw line
    const match = itemRawLine.match(/(?:\+?Rp\s*)([\d.]+)/);
    const amtToDeduct = match ? parseFloat(match[1].replace(/\./g, '')) : 0;

    // 2. Subtract from total paid_amount
    const currentTotal = parseFloat(String(pay.amount || 0));
    const newTotal = Math.max(0, currentTotal - amtToDeduct);

    // 3. Remove the line from note
    const lines = pay.note.split('\n');
    const newLines = lines.filter((l: string) => l.trim() !== itemRawLine.trim());
    const newNote = newLines.join('\n');
    
    // 4. Trigger markPaid mutation to update database!
    markPaid.mutate({
      ...pay,
      username: historyUser?.username || pay.username,
      calculatedAmount: newTotal,
      calculatedNote: newNote,
      calculatedDate: pay.payment_date,
      calculatedMethod: pay.method,
    }, {
      onSuccess: (d) => {
        if (d.success) {
          toast.success('Angsuran berhasil dihapus!');
        }
      }
    });
  };

  const toggleSelectAll = useCallback(() => {
    const tableData = data?.data || []
    setSelectedRows(prev => {
      if (prev.size === tableData.length && tableData.length > 0) {
        return new Set()
      }
      return new Set(tableData.map((r: any) => r.user_id))
    })
  }, [data?.data])

  const toggleSelectRow = useCallback((userId: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) newSet.delete(userId)
      else newSet.add(userId)
      return newSet
    })
  }, [])

  const humanizeName = (username: string) => {
    if (!username) return 'Pelanggan'
    const name = username.includes('@') ? (username.split('@').pop() || username) : username
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const handleWA = useCallback((row: any) => {
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
    
    navigate({
      to: '/automation/whatsapp-center',
      search: { phone: phone, text: msg }
    })
  }, [month, year, navigate])

  const summary = data?.summary || {
    paid: 0,
    unpaid: 0,
    collected: 0,
    receivable: 0,
    target_amount: 0,
    collection_rate: 0,
  }
  const totalPages = Math.ceil((data?.total || 0) / perPage)

  const exportUrl = `/api/export_excel.php?action=billing&router_id=${activeRouter?.software_id || activeRouter?.id}&month=${month}&year=${year}&search=${encodeURIComponent(search)}`

  const [sorting, setSorting] = useState<SortingState>([])

  const tableData = useMemo(() => data?.data || [], [data?.data])
  
  const markUnpaidMutate = markUnpaid.mutate
  
  const columns = useMemo(() => getBillingColumns({
    permissions,
    selectedRows,
    toggleSelectRow,
    toggleSelectAll,
    setHistoryUser,
    setPaymentCardUser,
    setPaidDialog,
    handleWA,
    confirmAction,
    markUnpaid: markUnpaidMutate,
    month,
    year,
    dataLength: tableData.length,
    fmt
  }), [permissions, selectedRows, toggleSelectRow, toggleSelectAll, setHistoryUser, setPaymentCardUser, setPaidDialog, handleWA, confirmAction, markUnpaidMutate, month, year, tableData.length])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

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
                <SelectItem value='isolir'>Isolir</SelectItem>
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
                navigate({
                  to: '/finance/billing',
                  search: {
                    month: now.getMonth() + 1,
                    year: now.getFullYear(),
                  },
                  replace: true
                })
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
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      {permissions.canManageFinance && <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>}
                      {permissions.canManageFinance && <TableCell><div className="flex gap-2 justify-center"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div></TableCell>}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'border-b border-border/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-150',
                        row.original.status === 'paid' && 'bg-emerald-50/10 dark:bg-emerald-950/5 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10',
                        selectedRows.has(row.original.user_id) && 'bg-primary/5 hover:bg-primary/10'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(!permissions.canManageFinance && cell.column.id === 'username' && 'pl-4')}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='py-16 text-center text-muted-foreground'
                    >
                      Tidak ada data
                    </TableCell>
                  </TableRow>
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
                    const n = Number(val)
                    setPerPage(n)
                    localStorage.setItem('billing-per-page', String(n))
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
                onClick={() => {
                  const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
                  printBulkThermal(usersToPrint, month, year)
                }}
              >
                Cetak Thermal
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-transparent border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 dark:border-slate-300/50 dark:text-slate-600 dark:hover:text-slate-900 dark:hover:bg-slate-200"
                onClick={() => {
                  const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
                  printBulkInvoice(usersToPrint, month, year)
                }}
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

      <PaymentDialog
        isOpen={!!paidDialog}
        onClose={() => setPaidDialog(null)}
        paidDialog={paidDialog}
        privacyMode={privacyMode}
        fmt={fmt}
        isPending={markPaid.isPending}
        onSave={(payload) => {
          markPaid.mutate({
            ...paidDialog,
            calculatedAmount: payload.calculatedAmount,
            calculatedNote: payload.calculatedNote,
            calculatedMethod: payload.calculatedMethod,
            calculatedDate: payload.calculatedDate,
          })
        }}
      />

      <HistoryDialog
        isOpen={!!historyUser}
        onClose={() => setHistoryUser(null)}
        historyUser={historyUser}
        isHistoryLoading={isHistoryLoading}
        userHistory={userHistory}
        fmt={fmt}
        handleDeleteAngsuran={handleDeleteAngsuran}
      />

      <PaymentCardDialog
        open={!!paymentCardUser}
        onOpenChange={(o) => !o && setPaymentCardUser(null)}
        user={paymentCardUser}
      />

      <ConfirmDialog />
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
