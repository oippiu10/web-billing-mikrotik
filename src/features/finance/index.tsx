import { useState } from 'react'
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, Users, AlertCircle,
  Wallet, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, CreditCard,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { usePrivacyStore } from '@/stores/privacy-store'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4']

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

interface KpiData {
  total_customers: string
  paid_count: string
  unpaid_count: string
  revenue: string
  receivable: string
}

export function FinanceDashboard() {
  const { activeRouter } = useRouterStore()
  const now = new Date()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const [selMonth] = useState(now.getMonth() + 1)
  const [selYear]  = useState(now.getFullYear())

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
      return res.data.data || []
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
  const receivable   = parseFloat(cur.receivable ?? '0')
  const prevRevenue  = parseFloat(prev.revenue ?? '0')
  const revDelta     = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0
  const collectionRate = total > 0 ? Math.round((paidCount / total) * 100) : 0

  const kpiCards = [
    {
      label: 'Pendapatan Bulan Ini',
      value: fmt(revenue),
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      sub: `${revDelta >= 0 ? '+' : ''}${revDelta.toFixed(1)}% vs bulan lalu`,
      trend: revDelta >= 0,
    },
    {
      label: 'Pelanggan Lunas',
      value: paidCount.toString(),
      icon: CheckCircle2,
      color: 'from-blue-500 to-blue-600',
      sub: `${collectionRate}% collection rate`,
      trend: true,
    },
    {
      label: 'Belum Bayar',
      value: unpaidCount.toString(),
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      sub: `dari ${total} total pelanggan`,
      trend: false,
    },
    {
      label: 'Total Piutang',
      value: fmt(receivable),
      icon: AlertCircle,
      color: 'from-red-500 to-rose-600',
      sub: 'estimasi berdasarkan paket',
      trend: false,
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

        <FinanceSubNav
          active='/finance'
          rightSlot={<div className='text-xs text-muted-foreground font-semibold'>{MONTHS[selMonth - 1]} {selYear}</div>}
        />

        {/* KPI Cards */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {kpiCards.map(({ label, value, icon: Icon, color, sub, trend }) => (
            <Card key={label} className={`relative overflow-hidden border-none shadow-lg bg-gradient-to-br ${color} text-white`}>
              <div className='absolute top-0 right-0 p-3 opacity-10'>
                <Icon className='h-16 w-16' />
              </div>
              <CardHeader className='pb-1'>
                <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-black mb-1 truncate'><PrivacyText>{value}</PrivacyText></div>
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
                <p className='text-2xl font-black text-primary'>{collectionRate}%</p>
              </div>
              <div className='text-right text-xs font-semibold text-muted-foreground'>
                <p>{paidCount} lunas &bull; {unpaidCount} belum bayar</p>
                <p>Total {total} pelanggan</p>
              </div>
            </div>
            <Progress value={collectionRate} className='h-3' />
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Bar Chart - Tren 12 Bulan */}
          <Card className='lg:col-span-2 border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <TrendingUp className='h-4 w-4 text-primary' /> Tren Pendapatan {selYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={240}>
                <BarChart data={annual || []} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' className='opacity-20' />
                  <XAxis dataKey='month_short' tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} />
                  <Tooltip
                    formatter={(v: any) => [privacyMode ? '••••••' : fmt(Number(v)), 'Pendapatan']}
                    labelFormatter={l => `Bulan: ${MONTHS[(l as number) - 1] || l}`}
                    contentStyle={{ fontSize: 12, fontWeight: 700 }}
                  />
                  <Bar dataKey='revenue' fill='#6366f1' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart - Per Profile */}
          <Card className='border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Users className='h-4 w-4 text-primary' /> Per Paket
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={240}>
                <PieChart>
                  <Pie
                    data={profileRev || []}
                    cx='50%' cy='45%'
                    innerRadius={55} outerRadius={85}
                    dataKey='revenue'
                    nameKey='profile'
                    paddingAngle={3}
                  >
                    {(profileRev || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => privacyMode ? '••••••' : fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
                  <Legend iconType='circle' iconSize={8} formatter={v => <span className='text-[10px] font-bold'>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className='border-none shadow-lg'>
          <CardHeader className='pb-2 flex flex-row items-center justify-between'>
            <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
              <CreditCard className='h-4 w-4 text-primary' /> Transaksi Terbaru
            </CardTitle>
            <Link to='/finance/billing'>
              <Button size='sm' variant='outline' className='text-xs h-7'>Lihat Semua</Button>
            </Link>
          </CardHeader>
          <CardContent className='p-0'>
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

      </Main>
    </>
  )
}
