import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Receipt, Download, Search, CheckCircle2, Clock, ChevronLeft,
  ChevronRight, CheckCheck, XCircle, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { usePrivacyStore } from '@/stores/privacy-store'
import { usePermission } from '@/lib/permissions'

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export function FinanceBilling() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const permissions = usePermission()
  const now = new Date()

  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [year, setYear]     = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [profile, setProfile] = useState('')
  const [page, setPage]     = useState(1)
  const perPage = 20

  // Paid dialog
  const [paidDialog, setPaidDialog] = useState<any>(null)
  const [paidAmount, setPaidAmount] = useState('')
  const [paidDate, setPaidDate]     = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')

  const { data, isLoading } = useQuery({
    queryKey: ['billing', activeRouter?.id, month, year, search, status, profile, page],
    queryFn: async () => {
      const res = await api.get('/get_all_payments_for_month_year.php', {
        params: { router_id: activeRouter?.software_id || activeRouter?.id, month, year, search, status, profile, page, per_page: perPage }
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
        amount: parseFloat(paidAmount) || parseFloat(row.harga) || 0,
        paid_date: paidDate,
        method: paidMethod,
        month, year,
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
    }
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
    }
  })

  const summary = data?.summary || { paid: 0, unpaid: 0, collected: 0, receivable: 0, target_amount: 0, collection_rate: 0 }
  const totalPages = Math.ceil((data?.total || 0) / perPage)

  const exportUrl = `/api/payment_operations.php?action=export&router_id=${activeRouter?.software_id || activeRouter?.id}&month=${month}&year=${year}&search=${search}`

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'><Receipt className='h-5 w-5 text-primary' /></div>
          <h1 className='text-lg font-bold'>Tagihan Bulanan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <FinanceSubNav active='/finance/billing' />

        {/* Summary Strip */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
          <Card className='border-none bg-green-50 dark:bg-green-900/20 shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <CheckCircle2 className='h-8 w-8 text-green-500' />
              <div>
                <p className='text-[10px] font-black uppercase text-green-700 dark:text-green-400'>Lunas</p>
                <p className='text-xl font-black text-green-600'>{summary.paid}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none bg-orange-50 dark:bg-orange-900/20 shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Clock className='h-8 w-8 text-orange-500' />
              <div>
                <p className='text-[10px] font-black uppercase text-orange-700 dark:text-orange-400'>Belum Bayar</p>
                <p className='text-xl font-black text-orange-600'>{summary.unpaid}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none bg-blue-50 dark:bg-blue-900/20 shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Wallet className='h-8 w-8 text-blue-500' />
              <div>
                <p className='text-[10px] font-black uppercase text-blue-700 dark:text-blue-400'>Terkumpul</p>
                <p className='text-xl font-black text-blue-600'><PrivacyText>{fmt(summary.collected)}</PrivacyText></p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none bg-red-50 dark:bg-red-900/20 shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Receipt className='h-8 w-8 text-red-500' />
              <div>
                <p className='text-[10px] font-black uppercase text-red-700 dark:text-red-400'>Sisa Piutang</p>
                <p className='text-xl font-black text-red-600'><PrivacyText>{fmt(summary.receivable)}</PrivacyText></p>
                <p className='text-[10px] font-bold text-muted-foreground'>{summary.collection_rate}% tertagih</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap gap-2 items-center'>
          {/* Month */}
          <Select value={String(month)} onValueChange={v => { setMonth(parseInt(v)); setPage(1) }}>
            <SelectTrigger className='h-8 w-36 text-xs font-bold'><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_ID.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Year */}
          <Select value={String(year)} onValueChange={v => { setYear(parseInt(v)); setPage(1) }}>
            <SelectTrigger className='h-8 w-24 text-xs font-bold'><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Status */}
          <Select value={status || 'all'} onValueChange={v => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className='h-8 w-32 text-xs font-bold'><SelectValue placeholder='Semua Status' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Semua Status</SelectItem>
              <SelectItem value='paid'>Lunas</SelectItem>
              <SelectItem value='unpaid'>Belum Bayar</SelectItem>
            </SelectContent>
          </Select>
          {/* Profile */}
          <Select value={profile || 'all'} onValueChange={v => { setProfile(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className='h-8 w-36 text-xs font-bold'><SelectValue placeholder='Semua Paket' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Semua Paket</SelectItem>
              {allProfiles.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Search */}
          <div className='relative flex-1 min-w-[180px]'>
            <Search className='absolute left-2.5 top-2 h-4 w-4 text-muted-foreground' />
            <Input placeholder='Cari username...' className='pl-8 h-8 text-xs' value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Button size='sm' variant='ghost' className='h-8 text-xs' onClick={() => { setSearch(''); setStatus(''); setProfile(''); setPage(1) }}>
            Reset
          </Button>
          <Button size='sm' variant='outline' className='h-8 gap-1.5 text-xs ml-auto' onClick={() => window.open(exportUrl)}>
            <Download className='h-3.5 w-3.5' /> Export CSV
          </Button>
        </div>

        {/* Table */}
        <Card className='border-none shadow-lg overflow-hidden'>
          <Table>
            <TableHeader className='bg-muted/30'>
              <TableRow>
                <TableHead className='text-xs font-black uppercase pl-4'>Username</TableHead>
                <TableHead className='text-xs font-black uppercase hidden md:table-cell'>Alamat</TableHead>
                <TableHead className='text-xs font-black uppercase'>Paket</TableHead>
                <TableHead className='text-xs font-black uppercase text-right'>Tagihan</TableHead>
                <TableHead className='text-xs font-black uppercase text-center'>Status</TableHead>
                <TableHead className='text-xs font-black uppercase hidden lg:table-cell'>Tgl Bayar</TableHead>
                {permissions.canManageFinance && <TableHead className='text-xs font-black uppercase text-right pr-4'>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={permissions.canManageFinance ? 7 : 6} className='text-center py-16 text-muted-foreground animate-pulse'>Memuat data...</TableCell></TableRow>
              ) : (data?.data || []).length === 0 ? (
                <TableRow><TableCell colSpan={permissions.canManageFinance ? 7 : 6} className='text-center py-16 text-muted-foreground'>Tidak ada data</TableCell></TableRow>
              ) : (
                (data?.data || []).map((row: any) => (
                  <TableRow key={row.id} className={cn('border-b border-border/30', row.status === 'paid' && 'bg-green-50/30 dark:bg-green-900/10')}>
                    <TableCell className='pl-4 font-bold text-sm'><PrivacyText>{row.username}</PrivacyText></TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden md:table-cell max-w-[150px] truncate'><PrivacyText>{row.alamat || '-'}</PrivacyText></TableCell>
                    <TableCell>
                      <Badge variant='secondary' className='text-[10px] font-bold'>{row.profile}</Badge>
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm font-bold'>
                      <PrivacyText>{fmt(parseFloat(row.harga || row.paid_amount || 0))}</PrivacyText>
                    </TableCell>
                    <TableCell className='text-center'>
                      {row.status === 'paid'
                        ? <Badge className='bg-green-500 hover:bg-green-600 text-[10px] font-black'>Lunas</Badge>
                        : <Badge variant='outline' className='border-orange-400 text-orange-600 text-[10px] font-black'>Belum</Badge>
                      }
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden lg:table-cell'>
                      {row.paid_at || '-'}
                    </TableCell>
                    {permissions.canManageFinance && (
                      <TableCell className='text-right pr-4'>
                        {row.status === 'paid' ? (
                          <Button size='sm' variant='ghost' className='h-7 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50'
                            onClick={() => markUnpaid.mutate(row.payment_id)}>
                            <XCircle className='h-3.5 w-3.5 mr-1' /> Batal
                          </Button>
                        ) : (
                          <Button size='sm' className='h-7 text-[10px] bg-green-500 hover:bg-green-600'
                            onClick={() => { setPaidDialog(row); setPaidAmount(row.harga || ''); }}>
                            <CheckCheck className='h-3.5 w-3.5 mr-1' /> Lunas
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='px-4 py-3 flex items-center justify-between border-t bg-muted/10'>
              <p className='text-xs text-muted-foreground'>Halaman {page} dari {totalPages}</p>
              <div className='flex gap-1'>
                <Button size='icon' variant='outline' className='h-7 w-7' onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                  <ChevronLeft className='h-3.5 w-3.5' />
                </Button>
                <Button size='icon' variant='outline' className='h-7 w-7' onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
                  <ChevronRight className='h-3.5 w-3.5' />
                </Button>
              </div>
            </div>
          )}
        </Card>

      </Main>

      {/* Mark Paid Dialog */}
      <Dialog open={!!paidDialog} onOpenChange={() => setPaidDialog(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-base font-black'>Tandai Lunas — {paidDialog?.username}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div>
              <label className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>Nominal (Rp)</label>
              <Input type={privacyMode ? 'password' : 'number'} value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                className='mt-1 font-mono' placeholder='0' />
            </div>
            <div>
              <label className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>Tanggal Bayar</label>
              <Input type='date' value={paidDate} onChange={e => setPaidDate(e.target.value)} className='mt-1' />
            </div>
            <div>
              <label className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>Metode</label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger className='mt-1'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='cash'>Tunai</SelectItem>
                  <SelectItem value='transfer'>Transfer Bank</SelectItem>
                  <SelectItem value='qris'>QRIS</SelectItem>
                  <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPaidDialog(null)}>Batal</Button>
            <Button className='bg-green-500 hover:bg-green-600' onClick={() => markPaid.mutate(paidDialog)} disabled={markPaid.isPending}>
              <CheckCheck className='h-4 w-4 mr-1' /> Konfirmasi Lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
