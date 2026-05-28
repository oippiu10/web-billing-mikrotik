import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  AlertTriangle, Search, CheckCheck, ChevronLeft, ChevronRight, Wallet, ArrowUpDown, Download, MessageCircle, ShieldCheck, Calendar, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { usePrivacyStore } from '@/stores/privacy-store'
import { usePermission } from '@/lib/permissions'
import { useConfirm } from '@/hooks/use-confirm'
import { PaymentDialog } from './components/payment-dialog'
import { BlastWaDialog } from './components/blast-wa-dialog'

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

const getWhatsappReminderData = (row: any, month: number, year: number) => {
  const phone = normalizeWhatsapp(row.phone || row.no_hp || row.telepon || row.whatsapp)
  const amount = fmt(parseFloat(row.harga || 0))
  const message = `Halo ${row.username}, kami informasikan tagihan internet periode ${MONTHS_ID[month - 1]} ${year} sebesar ${amount} belum tercatat lunas. Mohon abaikan pesan ini jika sudah melakukan pembayaran. Terima kasih.`
  return { phone, message }
}

export function FinanceReceivable() {
  const navigate = useNavigate()
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const permissions = usePermission()
  const now = new Date()

  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [year, setYear]       = useState(now.getFullYear())
  const [search, setSearch]   = useState('')
  const [profile, setProfile] = useState('')
  const [tipe, setTipe]       = useState('')
  const [page, setPage]       = useState(1)
  const perPage = 20

  const [paidDialog, setPaidDialog] = useState<any>(null)
  const [bulkPaidDialog, setBulkPaidDialog] = useState<boolean>(false)
  const [isBlastOpen, setIsBlastOpen] = useState<boolean>(false)
  const [paidDate, setPaidDate] = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')
  const [paidNote, setPaidNote] = useState('')
  
  const { confirm: confirmAction, ConfirmDialog } = useConfirm()
  
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

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

  const openIsolate = useMutation({
    mutationFn: async (row: any) => {
      const res = await api.post('/automation_open_isolate.php', {
        router_id: activeRouter?.software_id || activeRouter?.id,
        user_id: row.id,
        username: row.username,
      })
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) toast.success(d.message || 'Layanan berhasil dibuka')
      else toast.error(d.message || 'Gagal buka isolir')
    },
    onError: () => toast.error('Gagal menghubungi server'),
  })

  const markPaid = useMutation({
    onSuccess: () => {
      toast.success('Pembayaran dicatat!')
      queryClient.invalidateQueries({ queryKey: ['receivable'] })
      queryClient.invalidateQueries({ queryKey: ['billing'] })
      queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
      setPaidDialog(null)
    }
  })

  const bulkMarkPaid = useMutation({
    mutationFn: async () => {
      const usersToPay = (data?.data || []).filter((r: any) => selectedRows.has(r.id))
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
          user_id: u.id,
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
      setSelectedRows(new Set((data?.data || []).map((r: any) => r.id)))
    }
  }

  const toggleSelectRow = (userId: number) => {
    const newSet = new Set(selectedRows)
    if (newSet.has(userId)) newSet.delete(userId)
    else newSet.add(userId)
    setSelectedRows(newSet)
  }

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'username', direction: 'asc' })

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedData = useMemo(() => {
    let list = [...(data?.data || [])]
    // Filter tipe langganan client-side
    if (tipe) {
      list = list.filter((r: any) => (r.tipe_langganan || 'pascabayar') === tipe)
    }
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
  }, [data?.data, sortConfig, tipe])

  const totalPages    = Math.ceil((data?.total || 0) / perPage)
  const totalReceivable = data?.total_receivable || 0
  const exportUrl = `/api/export_excel.php?action=receivable&router_id=${activeRouter?.software_id || activeRouter?.id}&month=${month}&year=${year}&search=${encodeURIComponent(search)}&profile=${encodeURIComponent(profile)}`

  const overdueColor = (n: number) => {
    if (n >= 3) return 'text-red-600 bg-red-50 dark:bg-red-900/20'
    if (n >= 1) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
    return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5' />
          <h1 className='text-lg font-bold'>Piutang</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <FinanceSubNav active='/finance/receivable' />
          
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={v => { setMonth(parseInt(v)); setPage(1) }}>
              <SelectTrigger className='h-9 w-32 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_ID.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => { setYear(parseInt(v)); setPage(1) }}>
              <SelectTrigger className='h-9 w-24 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y =>
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Strip */}
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-rose-500 to-red-600 text-white col-span-1'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Total Belum Bayar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl xl:text-3xl font-black mb-1 truncate'>
                <PrivacyText>{data?.total || 0}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Pelanggan menunggak
              </div>
            </CardContent>
            <AlertTriangle className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>

          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-orange-500 to-amber-600 text-white col-span-1'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Total Piutang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-xl xl:text-2xl font-black mb-1 truncate'>
                <PrivacyText>{fmt(totalReceivable)}</PrivacyText>
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Total dana tertahan
              </div>
            </CardContent>
            <Wallet className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>

          <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-purple-500 to-violet-600 text-white col-span-2 md:col-span-1'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Periode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-xl xl:text-2xl font-black mb-1 truncate'>
                {MONTHS_ID[month - 1]} {year}
              </div>
              <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                Bulan tagihan
              </div>
            </CardContent>
            <Calendar className='absolute top-4 right-4 h-12 w-12 opacity-20' />
          </Card>
        </div>

        {/* Filters */}
        <div className='flex flex-col gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
          {/* Left Side: Selectors & Search Input */}
          <div className='flex flex-wrap items-center gap-2 flex-1 min-w-0'>
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
                setProfile('')
                setTipe('')
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
                  <TableHead className='w-12 pl-4 text-center'>
                    <Checkbox 
                      checked={data?.data?.length > 0 && selectedRows.size === data.data.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className='w-12 text-center text-xs font-black'>#</TableHead>
                <TableHead className={cn('pl-4 text-xs font-black uppercase cursor-pointer hover:text-primary', !permissions.canManageFinance && 'pl-4')} onClick={() => handleSort('username')}>
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
                <TableRow><TableCell colSpan={permissions.canManageFinance ? 9 : 7} className='text-center py-16 text-muted-foreground animate-pulse'>Memuat data...</TableCell></TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={permissions.canManageFinance ? 9 : 7} className='text-center py-16'>
                    <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                      <CheckCheck className='h-10 w-10 text-green-400' />
                      <p className='font-bold'>Semua pelanggan sudah lunas!</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row: any, idx: number) => (
                  <TableRow key={row.id} className={cn('border-b border-border/30 hover:bg-red-50/30 dark:hover:bg-red-900/10', selectedRows.has(row.id) && 'bg-primary/5 hover:bg-primary/10')}>
                    {permissions.canManageFinance && (
                      <TableCell className='pl-4 text-center'>
                        <Checkbox 
                          checked={selectedRows.has(row.id)}
                          onCheckedChange={() => toggleSelectRow(row.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className='text-center text-xs font-bold text-muted-foreground'>{(page - 1) * perPage + idx + 1}</TableCell>
                    <TableCell className={cn('font-bold text-sm', !permissions.canManageFinance && 'pl-4')}><PrivacyText>{row.username}</PrivacyText></TableCell>
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
                        <div className='flex justify-end gap-1.5'>
                          <Button
                            variant='outline'
                            size='icon'
                            className='h-8 w-8 border-amber-100 text-amber-600 bg-amber-50/30 transition-all duration-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/30 dark:text-amber-400 dark:bg-amber-950/10 dark:hover:bg-amber-950/50 rounded-lg shadow-sm'
                            onClick={() => {
                              const waData = getWhatsappReminderData(row, month, year)
                              if (!waData.phone) {
                                toast.error('Pelanggan tidak memiliki nomor WhatsApp')
                                return
                              }
                              navigate({
                                to: '/automation/whatsapp-center',
                                search: { phone: waData.phone, text: waData.message }
                              })
                            }}
                            title='Kirim Pesan Penagihan WA'
                          >
                            <MessageCircle className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='outline'
                            size='icon'
                            className='h-8 w-8 border-indigo-100 text-indigo-600 bg-indigo-50/30 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-900/30 dark:text-indigo-400 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/50 rounded-lg shadow-sm'
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: 'Buka Isolir Pelanggan',
                                description: `Apakah Anda yakin ingin membuka isolir layanan Mikrotik untuk pelanggan ${row.username}?`,
                                confirmText: 'Buka Isolir',
                                cancelText: 'Batal',
                                variant: 'default',
                              })
                              if (ok) openIsolate.mutate(row)
                            }}
                            disabled={openIsolate.isPending}
                            title='Buka Isolir (Open)'
                          >
                            <ShieldCheck className='h-4 w-4' />
                          </Button>
                          <Button
                            size='icon'
                            className='h-8 w-8 bg-emerald-500 text-white shadow-sm shadow-emerald-500/10 transition-all duration-200 hover:bg-emerald-600 hover:shadow-emerald-500/25 rounded-lg'
                            onClick={() => { 
                              setPaidDialog(row)
                            }}
                            title='Tandai Lunas'
                          >
                            <CheckCheck className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>


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
                size="sm" 
                className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                onClick={() => setIsBlastOpen(true)}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" /> Blast WA
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                onClick={() => {
                  setBulkPaidDialog(true)
                }}
              >
                Tandai Lunas
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Paid Dialog */}
      <Dialog open={bulkPaidDialog} onOpenChange={setBulkPaidDialog}>
        <DialogContent className='max-w-sm rounded-3xl border shadow-2xl'>
          <DialogHeader>
            <DialogTitle className='text-base font-black tracking-tight'>Pelunasan Massal ({selectedRows.size} Pelanggan)</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div>
              <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Tanggal Bayar</label>
              <Input type='date' value={paidDate} onChange={e => setPaidDate(e.target.value)} className='mt-1 rounded-xl' />
            </div>
            <div>
              <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Metode</label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger className='mt-1 rounded-xl'><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value='cash'>Tunai</SelectItem>
                  <SelectItem value='transfer'>Transfer Bank</SelectItem>
                  <SelectItem value='qris'>QRIS</SelectItem>
                  <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>Catatan (Opsional)</label>
              <Input value={paidNote} onChange={e => setPaidNote(e.target.value)} className='mt-1 rounded-xl' placeholder='Catatan massal...' />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant='outline' onClick={() => setBulkPaidDialog(false)} className="rounded-xl font-bold border-2">Batal</Button>
            <Button className='bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold px-5' onClick={() => bulkMarkPaid.mutate()} disabled={bulkMarkPaid.isPending}>
              <CheckCheck className='h-4 w-4 mr-1.5' /> Proses ({selectedRows.size}) Lunas
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
          api.post('/payment_operations.php', {
            action: 'mark_paid',
            router_id: activeRouter?.software_id || activeRouter?.id,
            username: paidDialog.username,
            payment_id: paidDialog.id,
            amount: payload.calculatedAmount,
            paid_date: payload.calculatedDate || now.toISOString().slice(0, 10),
            method: payload.calculatedMethod || 'cash',
            note: payload.calculatedNote,
            month, year,
          }).then((res) => {
            if (res.data.success) {
              toast.success('Pembayaran dicatat!')
              queryClient.invalidateQueries({ queryKey: ['receivable'] })
              queryClient.invalidateQueries({ queryKey: ['billing'] })
              queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
              setPaidDialog(null)
            } else {
              toast.error(res.data.message || 'Gagal')
            }
          })
        }}
      />

      <BlastWaDialog
        isOpen={isBlastOpen}
        onClose={() => {
          setIsBlastOpen(false)
          setSelectedRows(new Set())
        }}
        selectedCustomers={(data?.data || []).filter((r: any) => selectedRows.has(r.id))}
        month={month}
        year={year}
        fmt={fmt}
      />

      <ConfirmDialog />
    </>
  )
}
