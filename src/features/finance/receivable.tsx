import { useState, useMemo } from 'react'
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
  AlertTriangle, Search, CheckCheck, ChevronLeft, ChevronRight, Wallet, ArrowUpDown, Download, MessageCircle,
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

const normalizeWhatsapp = (value: unknown) => {
  const raw = String(value || '').replace(/\D/g, '')
  if (!raw) return ''
  if (raw.startsWith('62')) return raw
  if (raw.startsWith('0')) return `62${raw.slice(1)}`
  return raw
}

const openWhatsappReminder = (row: any, month: number, year: number) => {
  const phone = normalizeWhatsapp(row.phone || row.no_hp || row.telepon || row.whatsapp)
  const amount = fmt(parseFloat(row.harga || 0))
  const message = `Halo ${row.username}, kami informasikan tagihan internet periode ${MONTHS_ID[month - 1]} ${year} sebesar ${amount} belum tercatat lunas. Mohon abaikan pesan ini jika sudah melakukan pembayaran. Terima kasih.`
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

export function FinanceReceivable() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const permissions = usePermission()
  const now = new Date()

  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [year, setYear]       = useState(now.getFullYear())
  const [search, setSearch]   = useState('')
  const [profile, setProfile] = useState('')
  const [page, setPage]       = useState(1)
  const perPage = 20

  // Paid dialog
  const [paidDialog, setPaidDialog] = useState<any>(null)
  const [paidAmount, setPaidAmount] = useState('')
  const [paidDate, setPaidDate]     = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')

  const { data, isLoading } = useQuery({
    queryKey: ['receivable', activeRouter?.id, month, year, search, profile, page],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: {
          action: 'receivable',
          router_id: activeRouter?.software_id || activeRouter?.id,
          month, year, search, profile, page, per_page: perPage,
        }
      })
      return res.data
    },
    enabled: !!activeRouter,
    refetchInterval: 60000,
  })

  const allProfiles = data?.profiles || []

  const markPaid = useMutation({
    mutationFn: async (row: any) => {
      const res = await api.post('/payment_operations.php', {
        action: 'mark_paid',
        router_id: activeRouter?.software_id || activeRouter?.id,
        username: row.username,
        payment_id: row.id,
        amount: parseFloat(paidAmount) || parseFloat(row.harga) || 0,
        paid_date: paidDate,
        method: paidMethod,
        month, year,
      })
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success('Pembayaran dicatat!')
        queryClient.invalidateQueries({ queryKey: ['receivable'] })
        queryClient.invalidateQueries({ queryKey: ['billing'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        setPaidDialog(null)
      } else toast.error(d.message || 'Gagal')
    }
  })

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'username', direction: 'asc' })

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedData = useMemo(() => {
    const list = [...(data?.data || [])]
    if (!sortConfig.key || !sortConfig.direction) return list
    return list.sort((a, b) => {
      let valA = a[sortConfig.key]
      let valB = b[sortConfig.key]
      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data?.data, sortConfig])

  const totalPages    = Math.ceil((data?.total || 0) / perPage)
  const totalReceivable = data?.total_receivable || 0
  const exportUrl = `/api/finance_report.php?action=receivable_export&router_id=${activeRouter?.software_id || activeRouter?.id}&month=${month}&year=${year}&search=${encodeURIComponent(search)}&profile=${encodeURIComponent(profile)}`

  const overdueColor = (n: number) => {
    if (n >= 3) return 'text-red-600 bg-red-50 dark:bg-red-900/20'
    if (n >= 1) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
    return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-red-100 dark:bg-red-900/30 rounded-lg'>
            <AlertTriangle className='h-5 w-5 text-red-500' />
          </div>
          <h1 className='text-lg font-bold'>Piutang</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <FinanceSubNav active='/finance/receivable' />

        {/* KPI Strip */}
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Card className='border-none bg-red-50 dark:bg-red-900/20 shadow-sm col-span-1'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <AlertTriangle className='h-8 w-8 text-red-400' />
              <div>
                <p className='text-[10px] font-black uppercase text-red-700 dark:text-red-400'>Total Belum Bayar</p>
                <p className='text-2xl font-black text-red-600'>{data?.total || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none bg-orange-50 dark:bg-orange-900/20 shadow-sm col-span-1'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Wallet className='h-8 w-8 text-orange-400' />
              <div>
                <p className='text-[10px] font-black uppercase text-orange-700 dark:text-orange-400'>Total Piutang</p>
                <p className='text-xl font-black text-orange-600'><PrivacyText>{fmt(totalReceivable)}</PrivacyText></p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none shadow-sm col-span-2 md:col-span-1'>
            <CardContent className='py-3 px-4'>
              <p className='text-[10px] font-black uppercase text-muted-foreground'>Periode</p>
              <p className='text-lg font-black'>{MONTHS_ID[month - 1]} {year}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className='flex flex-wrap gap-2 items-center'>
          <Select value={String(month)} onValueChange={v => { setMonth(parseInt(v)); setPage(1) }}>
            <SelectTrigger className='h-8 w-36 text-xs font-bold'><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_ID.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => { setYear(parseInt(v)); setPage(1) }}>
            <SelectTrigger className='h-8 w-24 text-xs font-bold'><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear()-1].map(y =>
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={profile || 'all'} onValueChange={v => { setProfile(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className='h-8 w-36 text-xs font-bold'><SelectValue placeholder='Semua Paket' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Semua Paket</SelectItem>
              {allProfiles.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size='sm' variant='ghost' className='h-8 text-xs' onClick={() => { setSearch(''); setProfile(''); setPage(1) }}>
            Reset
          </Button>
          <Button size='sm' variant='outline' className='h-8 text-xs gap-1.5 ml-auto' onClick={() => window.open(exportUrl)}>
            <Download className='h-3.5 w-3.5' /> Export Piutang
          </Button>
        </div>

        {/* Table */}
        <Card className='border-none shadow-lg overflow-hidden'>
          <div className='p-3 border-b bg-muted/10 flex items-center justify-between'>
            <div className='flex items-center gap-2 text-red-600 font-black uppercase text-xs tracking-widest'>
              <AlertTriangle className='h-4 w-4' /> Daftar Piutang
            </div>
            <div className='relative w-full max-w-xs'>
              <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
              <Input placeholder='Cari username...' className='pl-8 h-8 text-xs bg-background' value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
          </div>
          <Table>
            <TableHeader className='bg-muted/30'>
              <TableRow>
                <TableHead className='w-12 text-center text-xs font-black'>#</TableHead>
                <TableHead className='pl-4 text-xs font-black uppercase cursor-pointer hover:text-primary' onClick={() => handleSort('username')}>
                  <div className='flex items-center gap-1'>Username <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                <TableHead className='text-xs font-black uppercase hidden md:table-cell cursor-pointer hover:text-primary' onClick={() => handleSort('alamat')}>
                  <div className='flex items-center gap-1'>Alamat <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                <TableHead className='text-xs font-black uppercase cursor-pointer hover:text-primary' onClick={() => handleSort('profile')}>
                  <div className='flex items-center gap-1'>Paket <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                <TableHead className='text-xs font-black uppercase text-right cursor-pointer hover:text-primary' onClick={() => handleSort('harga')}>
                  <div className='flex items-center gap-1 justify-end'>Tagihan <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                <TableHead className='text-xs font-black uppercase text-center cursor-pointer hover:text-primary' onClick={() => handleSort('tanggal_tagihan')}>
                  <div className='flex items-center gap-1 justify-center'>Tgl Tagihan <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                <TableHead className='text-xs font-black uppercase text-center cursor-pointer hover:text-primary' onClick={() => handleSort('months_overdue')}>
                  <div className='flex items-center gap-1 justify-center'>Tunggakan <ArrowUpDown className='h-3 w-3' /></div>
                </TableHead>
                {permissions.canManageFinance && <TableHead className='text-xs font-black uppercase text-right pr-4'>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={permissions.canManageFinance ? 8 : 7} className='text-center py-16 text-muted-foreground animate-pulse'>Memuat data...</TableCell></TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={permissions.canManageFinance ? 8 : 7} className='text-center py-16'>
                    <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                      <CheckCheck className='h-10 w-10 text-green-400' />
                      <p className='font-bold'>Semua pelanggan sudah lunas!</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row: any, idx: number) => (
                  <TableRow key={row.id} className='border-b border-border/30 hover:bg-red-50/30 dark:hover:bg-red-900/10'>
                    <TableCell className='text-center text-xs font-bold text-muted-foreground'>{(page - 1) * perPage + idx + 1}</TableCell>
                    <TableCell className='pl-4 font-bold text-sm'><PrivacyText>{row.username}</PrivacyText></TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden md:table-cell max-w-[140px] truncate'><PrivacyText>{row.alamat || '-'}</PrivacyText></TableCell>
                    <TableCell>
                      <Badge variant='secondary' className='text-[10px] font-bold'>{row.profile}</Badge>
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm font-bold text-red-600'>
                      <PrivacyText>{fmt(parseFloat(row.harga || 0))}</PrivacyText>
                    </TableCell>
                    <TableCell className='text-center text-xs text-muted-foreground'>{row.tanggal_tagihan || '-'}</TableCell>
                    <TableCell className='text-center'>
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', overdueColor(row.months_overdue))}>
                        {row.months_overdue >= 1 ? `${row.months_overdue} bulan` : 'Baru'}
                      </span>
                    </TableCell>
                    {permissions.canManageFinance && (
                      <TableCell className='text-right pr-4'>
                        <div className='flex justify-end gap-1'>
                          <Button size='sm' variant='outline' className='h-7 text-[10px] text-green-600'
                            onClick={() => openWhatsappReminder(row, month, year)}>
                            <MessageCircle className='h-3.5 w-3.5 mr-1' /> WA
                          </Button>
                          <Button size='sm' className='h-7 text-[10px] bg-green-500 hover:bg-green-600'
                            onClick={() => { setPaidDialog(row); setPaidAmount(row.harga || '') }}>
                            <CheckCheck className='h-3.5 w-3.5 mr-1' /> Lunas
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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

      {/* Paid Dialog */}
      <Dialog open={!!paidDialog} onOpenChange={() => setPaidDialog(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-base font-black'>Tandai Lunas — {paidDialog?.username}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div>
              <label className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>Nominal (Rp)</label>
              <Input type={privacyMode ? 'password' : 'number'} value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className='mt-1 font-mono' />
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
