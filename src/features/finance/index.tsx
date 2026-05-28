import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, Users, AlertCircle,
  Wallet, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, CreditCard,
  BarChart3, MessageSquare, Loader2, Play, Square, Trash2, Settings as SettingsIcon
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { usePrivacyStore } from '@/stores/privacy-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4']

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

interface KpiData {
  total_customers: string
  paid_count: string
  unpaid_count: string
  revenue: string
  expense?: string
  net_profit?: string
  receivable: string
}

export function FinanceDashboard() {
  const { activeRouter } = useRouterStore()
  const now = new Date()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear, setSelYear]  = useState(now.getFullYear())

  // WA Monitor & Settings States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [gwType, setGwType] = useState<'fonnte' | 'custom'>('fonnte')
  const [apiToken, setApiToken] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  
  // Background Worker State
  const [isWorkerRunning, setIsWorkerRunning] = useState(false)
  const [workerProgress, setWorkerProgress] = useState('')

  // WA Gateway status & Queue Stats
  const { data: waMonitor, refetch: refetchWa } = useQuery({
    queryKey: ['finance-wa-monitor', routerId],
    queryFn: async () => {
      const res = await api.get('/wa_operations.php', {
        params: { action: 'get_queue_status', router_id: routerId }
      })
      return res.data
    },
    enabled: !!routerId,
    refetchInterval: 10000, // Sync status setiap 10 detik secara live!
  })

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if ((window as any)._waWorkerTimeout) {
        clearTimeout((window as any)._waWorkerTimeout);
      }
    }
  }, [])

  const openGatewaySettings = async () => {
    try {
      const res = await api.get('/wa_operations.php?action=get_settings')
      if (res.data?.success) {
        setGwType(res.data.settings.gateway_type || 'fonnte')
        setApiToken(res.data.settings.api_token_masked || '')
        setCustomUrl(res.data.settings.custom_url || '')
        setIsSettingsOpen(true)
      }
    } catch (err: any) {
      toast.error('Gagal mengambil setelan WA Gateway')
    }
  }

  const saveGatewaySettings = async () => {
    setIsSavingSettings(true)
    try {
      const res = await api.post('/wa_settings', {
        gateway_type: gwType,
        api_token: apiToken,
        custom_url: customUrl
      })
      // wait, the actual API path is /wa_operations.php?action=save_settings
      const resOp = await api.post('/wa_operations.php?action=save_settings', {
        gateway_type: gwType,
        api_token: apiToken,
        custom_url: customUrl
      })
      if (resOp.data?.success) {
        toast.success(resOp.data.message)
        setIsSettingsOpen(false)
        refetchWa()
      } else {
        toast.error(resOp.data?.message || 'Gagal menyimpan setelan')
      }
    } catch (err: any) {
      toast.error('Gagal menyimpan setelan WA Gateway')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const clearQueue = async (type: 'failed' | 'all') => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${type === 'failed' ? 'antrean gagal' : 'seluruh antrean'}?`)) return
    try {
      const action = type === 'failed' ? 'clear_failed' : 'clear_all'
      const res = await api.get(`/wa_operations.php`, {
        params: { action, router_id: routerId }
      })
      if (res.data?.success) {
        toast.success(res.data.message)
        refetchWa()
      } else {
        toast.error(res.data?.message || 'Gagal membersihkan antrean')
      }
    } catch (err) {
      toast.error('Gagal membersihkan antrean')
    }
  }

  const runBackgroundWorker = async () => {
    if (isWorkerRunning) {
      if ((window as any)._waWorkerTimeout) {
        clearTimeout((window as any)._waWorkerTimeout);
      }
      setIsWorkerRunning(false);
      setWorkerProgress('Pengiriman dihentikan.');
      return;
    }
    
    setIsWorkerRunning(true);
    setWorkerProgress('Memulai pengiriman pesan...');
    
    const runStep = async () => {
      try {
        const procRes = await api.get('/wa_operations.php?action=process_queue')
        refetchWa();
        if (procRes.data?.completed) {
          setIsWorkerRunning(false);
          setWorkerProgress('Semua antrean selesai diproses!');
          toast.success('Semua antrean pesan selesai diproses!');
          return;
        }
        
        // Dapatkan data terbaru
        const statsRes = await api.get('/wa_operations.php', {
          params: { action: 'get_queue_status', router_id: routerId }
        })
        const counts = statsRes.data?.counts || { pending: 0 }
        
        if (counts.pending > 0) {
          setWorkerProgress(`Mengirim pesan... Sisa antrean: ${counts.pending}`);
          (window as any)._waWorkerTimeout = setTimeout(runStep, 2500);
        } else {
          setIsWorkerRunning(false);
          setWorkerProgress('Semua antrean selesai diproses!');
          toast.success('Semua antrean pesan selesai diproses!');
        }
      } catch (err) {
        setIsWorkerRunning(false);
        setWorkerProgress('Pengiriman terhenti karena kesalahan.');
        toast.error('Terjadi kesalahan pada background worker');
      }
    }
    
    runStep();
  }

  // KPI
  const { data: kpi } = useQuery({
    queryKey: ['finance-kpi', routerId, selMonth, selYear],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'monthly_kpi', router_id: routerId, month: selMonth, year: selYear }
      })
      return res.data
    },
    enabled: !!routerId,
    refetchInterval: 60000,
  })

  // Revenue 12 bulan terakhir
  const { data: annual } = useQuery({
    queryKey: ['finance-annual', routerId, selYear],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'annual_report', router_id: routerId, year: selYear }
      })
      return res.data
    },
    enabled: !!routerId,
  })

  // Revenue per profile
  const { data: profileRev } = useQuery({
    queryKey: ['finance-profile', routerId, selMonth, selYear],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'profile_revenue', router_id: routerId, month: selMonth, year: selYear }
      })
      return res.data.data || []
    },
    enabled: !!routerId,
  })

  // Revenue per ODP
  const { data: odpRev } = useQuery({
    queryKey: ['finance-odp', routerId, selMonth, selYear],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'odp_revenue', router_id: routerId, month: selMonth, year: selYear }
      })
      return res.data.data || []
    },
    enabled: !!routerId,
  })

  // Recent payments
  const { data: recent } = useQuery({
    queryKey: ['finance-recent', routerId],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'recent_payments', router_id: routerId, limit: 8 }
      })
      return res.data.data || []
    },
    enabled: !!routerId,
    refetchInterval: 30000,
  })

  const cur: KpiData  = kpi?.current  || {}
  const prev: KpiData = kpi?.previous || {}

  const paidCount    = parseInt(cur.paid_count ?? '0')
  const unpaidCount  = parseInt(cur.unpaid_count ?? '0')
  const total        = parseInt(cur.total_customers ?? '0')
  const revenue      = parseFloat(cur.revenue ?? '0')
  const expense      = parseFloat(cur.expense ?? '0')
  const netProfit    = parseFloat(cur.net_profit ?? '0')
  const receivable   = parseFloat(cur.receivable ?? '0')
  const prevNetProfit = parseFloat(prev.net_profit ?? '0')
  const profitDelta   = prevNetProfit > 0 ? ((netProfit - prevNetProfit) / prevNetProfit) * 100 : 0
  const collectionRate = total > 0 ? Math.round((paidCount / total) * 100) : 0

  const kpiCards = [
    {
      label: 'Total Pemasukan',
      value: fmt(revenue),
      icon: DollarSign,
      color: 'from-blue-500 to-indigo-600',
      sub: <>{privacyMode ? '•••' : paidCount} lunas dari {privacyMode ? '•••' : total} pelanggan</>,
      trend: true,
    },
    {
      label: 'Total Pengeluaran',
      value: fmt(expense),
      icon: Wallet,
      color: 'from-orange-500 to-red-500',
      sub: `Tercatat di bulan ini`,
      trend: false,
    },
    {
      label: 'Estimasi Piutang',
      value: fmt(receivable),
      icon: AlertCircle,
      color: 'from-rose-500 to-pink-600',
      sub: <>{privacyMode ? '•••' : unpaidCount} pelanggan belum bayar</>,
      trend: false,
    },
    {
      label: 'Laba Bersih',
      value: fmt(netProfit),
      icon: CheckCircle2,
      color: 'from-emerald-500 to-green-600',
      sub: `Pemasukan - Pengeluaran`,
      trend: profitDelta >= 0,
    },
  ]

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <Wallet className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Dashboard Keuangan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <FinanceSubNav active='/finance' />
          
          <div className="flex items-center gap-2">
            <Select value={String(selMonth)} onValueChange={v => setSelMonth(parseInt(v))}>
              <SelectTrigger className='h-9 w-32 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selYear)} onValueChange={v => setSelYear(parseInt(v))}>
              <SelectTrigger className='h-9 w-24 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y =>
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {kpiCards.map(({ label, value, icon: Icon, color, sub, trend }) => (
            <Card key={label} className={`relative overflow-hidden border-none shadow-lg bg-linear-to-br ${color} text-white`}>
              <div className='absolute top-0 right-0 p-3 opacity-10'>
                <Icon className='h-16 w-16' />
              </div>
              <CardHeader className='pb-1'>
                <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-xl xl:text-2xl font-black mb-1 truncate'><PrivacyText>{value}</PrivacyText></div>
                <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
                  {trend
                    ? <ArrowUpRight className='h-3 w-3' />
                    : <ArrowDownRight className='h-3 w-3' />}
                  {sub}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Collection Progress */}
        <Card className='border-none shadow-lg'>
          <CardContent className='pt-5'>
            <div className='flex items-center justify-between mb-2'>
              <div>
                <p className='text-xs font-black uppercase tracking-widest text-muted-foreground'>Tingkat Penagihan Bulan Ini</p>
                <p className='text-2xl font-black text-primary'>{privacyMode ? '•••' : collectionRate}%</p>
              </div>
              <div className='text-right text-xs font-semibold text-muted-foreground'>
                <p>{privacyMode ? '•••' : paidCount} lunas &bull; {privacyMode ? '•••' : unpaidCount} belum bayar</p>
                <p>Total {privacyMode ? '•••' : total} pelanggan</p>
              </div>
            </div>
            <Progress value={collectionRate} className='h-3' />
          </CardContent>
        </Card>

        {/* Tren Pendapatan 12 Bulan - Lebar Penuh */}
        <Card className='border-none shadow-lg w-full'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
              <TrendingUp className='h-4 w-4 text-primary' /> Tren Pendapatan {selYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <BarChart data={annual?.data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='4 4' vertical={false} className='stroke-muted' />
                <XAxis dataKey='month_short' tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{ fontSize: 10, fontWeight: 600 }} tickFormatter={v => privacyMode ? '•••' : `${(v/1000000).toFixed(0)}jt`} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  formatter={(v: any) => [privacyMode ? '••••••' : fmt(Number(v)), 'Pendapatan']}
                  labelFormatter={l => `Bulan: ${MONTHS[(l as number) - 1] || l}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', fontSize: 12, fontWeight: 800 }}
                />
                <Bar dataKey='revenue' fill='url(#colorRevenue)' radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grid 2 Kolom: Sebaran Per Paket & Sebaran Per ODP */}
        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Profile Revenue */}
          <Card className='border-none shadow-lg flex flex-col'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Users className='h-4 w-4 text-primary' /> Sebaran per Paket ({MONTHS[selMonth - 1]})
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-5 pt-4 flex-1'>
              {(profileRev || []).length === 0 ? (
                <div className='flex h-32 items-center justify-center text-muted-foreground text-xs font-bold'>
                  Belum ada data profile
                </div>
              ) : (
                (profileRev || []).slice(0, 5).map((p: any, i: number) => {
                  const maxRev = Math.max(...(profileRev || []).map((x: any) => parseFloat(x.revenue || 0)))
                  const pct = maxRev > 0 ? (parseFloat(p.revenue || 0) / maxRev) * 100 : 0
                  const colors = ['from-indigo-500 to-blue-500', 'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500', 'from-violet-500 to-purple-600']
                  const gradient = colors[i % colors.length]
                  
                  return (
                    <div key={i} className='group'>
                      <div className='flex items-end justify-between mb-2'>
                        <div>
                          <p className='text-sm font-black leading-none mb-1 text-foreground'>{p.profile}</p>
                          <p className='text-[10px] font-bold text-muted-foreground tracking-wider uppercase'>
                            {privacyMode ? '•••' : p.paid_count} Lunas &bull; {privacyMode ? '•••' : p.total_users} Total
                          </p>
                        </div>
                        <div className='text-sm font-black text-right min-w-[70px]'>
                          <PrivacyText>{fmtShort(parseFloat(p.revenue || 0))}</PrivacyText>
                        </div>
                      </div>
                      <div className='h-2.5 w-full rounded-full bg-muted/60 overflow-hidden shadow-3xs'>
                        <div className={`h-full rounded-full bg-linear-to-r ${gradient} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* ODP Revenue & Piutang */}
          <Card className='border-none shadow-lg flex flex-col'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <BarChart3 className='h-4 w-4 text-indigo-500' /> Sebaran per ODP ({MONTHS[selMonth - 1]})
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-5 pt-4 flex-1'>
              {(odpRev || []).length === 0 ? (
                <div className='flex h-32 items-center justify-center text-muted-foreground text-xs font-bold'>
                  Belum ada data ODP
                </div>
              ) : (
                (odpRev || []).slice(0, 5).map((o: any, i: number) => {
                  const revenueVal = parseFloat(o.revenue || 0)
                  const receivableVal = parseFloat(o.receivable || 0)
                  const totalVal = revenueVal + receivableVal
                  
                  // Hitung rasio pembayaran di ODP ini
                  const paymentRatio = totalVal > 0 ? (revenueVal / totalVal) * 100 : 0
                  
                  return (
                    <div key={i} className='group'>
                      <div className='flex items-end justify-between mb-2'>
                        <div>
                          <p className='text-sm font-black leading-none mb-1 text-foreground'>{o.odp_name}</p>
                          <p className='text-[10px] font-bold text-muted-foreground tracking-wider uppercase'>
                            {privacyMode ? '•••' : o.paid_count} Lunas &bull; {privacyMode ? '•••' : o.total_users} Total Plg
                          </p>
                        </div>
                        <div className='text-right text-xs font-semibold'>
                          <p className='text-emerald-600 font-extrabold'>Lunas: <PrivacyText>{fmtShort(revenueVal)}</PrivacyText></p>
                          {receivableVal > 0 && (
                            <p className='text-rose-500 font-bold'>Piutang: <PrivacyText>{fmtShort(receivableVal)}</PrivacyText></p>
                          )}
                        </div>
                      </div>
                      <div className='h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex shadow-3xs'>
                        <div 
                          className='h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-1000 ease-out' 
                          style={{ width: `${paymentRatio}%` }} 
                          title={`Terkumpul: ${Math.round(paymentRatio)}%`}
                        />
                        <div 
                          className='h-full bg-linear-to-r from-rose-500 to-pink-500 transition-all duration-1000 ease-out' 
                          style={{ width: `${100 - paymentRatio}%` }}
                          title={`Tertahan: ${Math.round(100 - paymentRatio)}%`}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Per-Month Table */}
          <Card className='lg:col-span-2 border-none shadow-lg overflow-hidden flex flex-col'>
            <CardHeader className='pb-2 border-b border-border/50 bg-muted/10'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <BarChart3 className='h-4 w-4 text-primary' /> Detail Per Bulan {selYear}
              </CardTitle>
            </CardHeader>
            <div className='flex-1 overflow-auto'>
              <Table>
                <TableHeader className='bg-muted/30 sticky top-0 z-10'>
                  <TableRow>
                    <TableHead className='w-12 text-center text-xs font-black'>#</TableHead>
                    <TableHead className='pl-4 text-xs font-black uppercase'>Bulan</TableHead>
                    <TableHead className='text-xs font-black uppercase text-center'>Lunas</TableHead>
                    <TableHead className='text-xs font-black uppercase text-center'>Belum</TableHead>
                    <TableHead className='text-xs font-black uppercase text-center'>Collection</TableHead>
                    <TableHead className='text-xs font-black uppercase text-right'>Pendapatan</TableHead>
                    <TableHead className='text-xs font-black uppercase text-right'>Pengeluaran</TableHead>
                    <TableHead className='text-xs font-black uppercase text-right pr-4'>Laba Bersih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!annual?.data ? (
                    <TableRow><TableCell colSpan={6} className='text-center py-12 animate-pulse text-muted-foreground'>Memuat data...</TableCell></TableRow>
                  ) : (annual.data || []).map((m: any, idx: number) => {
                    const currentMonthIdx = now.getMonth()
                    const isCurrent = idx === currentMonthIdx && selYear === now.getFullYear()
                    const isFuture = (idx > currentMonthIdx && selYear === now.getFullYear()) || selYear > now.getFullYear()
                    return (
                      <TableRow key={m.month} className={cn(
                        'border-b border-border/30 hover:bg-muted/30 transition-colors',
                        isCurrent && 'bg-primary/5',
                        isFuture && 'opacity-40'
                      )}>
                        <TableCell className='text-center text-xs font-bold text-muted-foreground'>{idx + 1}</TableCell>
                        <TableCell className='pl-4 font-bold text-sm'>
                          {m.month_name}
                          {isCurrent && <Badge className='ml-2 text-[9px] h-4 px-1.5 bg-primary/20 text-primary hover:bg-primary/20'>Berjalan</Badge>}
                        </TableCell>
                        <TableCell className='text-center text-sm font-bold text-green-600'><PrivacyText>{m.paid}</PrivacyText></TableCell>
                        <TableCell className='text-center text-sm font-bold text-orange-600'><PrivacyText>{m.unpaid}</PrivacyText></TableCell>
                        <TableCell className='text-center'>
                          <div className='flex items-center gap-2 justify-center'>
                            <Progress value={m.collection_rate} className='h-1.5 w-16' />
                            <span className='text-[11px] font-black'><PrivacyText>{m.collection_rate}</PrivacyText>%</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right font-black font-mono text-sm', m.revenue > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                          <PrivacyText>{m.revenue > 0 ? fmt(m.revenue) : '-'}</PrivacyText>
                        </TableCell>
                        <TableCell className={cn('text-right font-black font-mono text-sm', m.expense > 0 ? 'text-rose-600' : 'text-muted-foreground')}>
                          <PrivacyText>{m.expense > 0 ? fmt(m.expense) : '-'}</PrivacyText>
                        </TableCell>
                        <TableCell className={cn('text-right pr-4 font-black font-mono text-sm', m.net_profit > 0 ? 'text-emerald-600' : (m.net_profit < 0 ? 'text-red-600' : 'text-muted-foreground'))}>
                          <PrivacyText>{m.net_profit !== 0 ? fmt(m.net_profit) : '-'}</PrivacyText>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Total Row */}
                  {(annual?.data || []).length > 0 && (
                    <TableRow className='bg-muted/30 font-black border-t-2'>
                      <TableCell colSpan={2} className='pl-4 font-black uppercase text-xs tracking-widest'>Total YTD</TableCell>
                      <TableCell className='text-center font-black text-green-600'>
                        <PrivacyText>{annual?.data?.reduce((acc: number, cur: any) => acc + (parseInt(cur.paid) || 0), 0) || '-'}</PrivacyText>
                      </TableCell>
                      <TableCell className='text-center font-black text-orange-600'>-</TableCell>
                      <TableCell className='text-center'>-</TableCell>
                      <TableCell className='text-right text-green-600 font-mono'>
                        <PrivacyText>{fmt(annual?.ytd_revenue || 0)}</PrivacyText>
                      </TableCell>
                      <TableCell className='text-right text-rose-600 font-mono'>
                        <PrivacyText>{fmt(annual?.ytd_expense || 0)}</PrivacyText>
                      </TableCell>
                      <TableCell className='text-right pr-4 text-emerald-600 font-mono'>
                        <PrivacyText>{fmt(annual?.ytd_net_profit || 0)}</PrivacyText>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className='border-none shadow-lg flex flex-col'>
            <CardHeader className='pb-2 flex flex-row items-center justify-between border-b border-border/50 bg-muted/10'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <CreditCard className='h-4 w-4 text-primary' /> Transaksi Terbaru
              </CardTitle>
              <Link to='/finance/billing'>
                <Button size='sm' variant='outline' className='text-xs h-7 hover:bg-primary hover:text-primary-foreground transition-colors'>Lihat Semua</Button>
              </Link>
            </CardHeader>
            <CardContent className='p-0 flex-1 overflow-auto max-h-[500px]'>
            <div className='divide-y divide-border/50'>
              {(recent || []).length === 0 && (
                <p className='text-center text-muted-foreground text-sm py-8'>Belum ada transaksi</p>
              )}
              {(recent || []).map((t: any) => (
                <div key={t.id} className='flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors'>
                  <div className='flex items-center gap-3'>
                    <div className='h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                      <CheckCircle2 className='h-4 w-4 text-green-600' />
                    </div>
                    <div>
                      <p className='text-sm font-bold'><PrivacyText>{t.username}</PrivacyText></p>
                      <p className='text-[10px] text-muted-foreground'>{t.profile} &bull; {t.payment_date}</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-black text-green-600'><PrivacyText>{fmt(parseFloat(t.amount))}</PrivacyText></p>
                    <Badge variant='secondary' className='text-[9px] h-4 px-1.5'>{t.method || 'cash'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      </Main>
    </>
  )
}
