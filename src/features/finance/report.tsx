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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { BarChart3, TrendingUp, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { usePrivacyStore } from '@/stores/privacy-store'
import { Progress } from '@/components/ui/progress'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

export function FinanceReport() {
  const { activeRouter } = useRouterStore()
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data, isLoading } = useQuery({
    queryKey: ['finance-annual', activeRouter?.id, year],
    queryFn: async () => {
      const res = await api.get('/finance_report.php', {
        params: { action: 'annual_report', router_id: activeRouter?.software_id || activeRouter?.id, year }
      })
      return res.data
    },
    enabled: !!activeRouter,
  })

  const { data: profileRevData } = useQuery({
    queryKey: ['finance-profile-all', activeRouter?.id, year],
    queryFn: async () => {
      // Ambil revenue per profile untuk bulan ini
      const now = new Date()
      const res = await api.get('/finance_report.php', {
        params: {
          action: 'profile_revenue',
          router_id: activeRouter?.software_id || activeRouter?.id,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  const months = data?.data || []
  const ytd = data?.ytd_revenue || 0
  const totalUsers = data?.total_users || 0

  // Bulan terbaik
  const bestMonth = [...months].sort((a: any, b: any) => b.revenue - a.revenue)[0]
  const currentMonthIdx = new Date().getMonth()
  const ytdPaid = months.slice(0, currentMonthIdx + 1).reduce((sum: number, m: any) => sum + m.paid, 0)

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'><BarChart3 className='h-5 w-5 text-primary' /></div>
          <h1 className='text-lg font-bold'>Laporan Tahunan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <FinanceSubNav
          active='/finance/report'
          rightSlot={(
            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className='h-8 w-24 text-xs font-bold'><SelectValue /></SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map(y =>
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        />

        {/* KPI Cards */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          {[
            { label: `YTD Revenue ${year}`, value: fmt(ytd), icon: Wallet, color: 'from-indigo-500 to-violet-600' },
            { label: 'Total Pelanggan', value: totalUsers.toString(), icon: Users, color: 'from-blue-500 to-cyan-600' },
            { label: 'Bulan Terbaik', value: bestMonth?.month_name || '-', icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
            { label: 'Revenue Terbaik', value: fmt(bestMonth?.revenue || 0), icon: BarChart3, color: 'from-amber-500 to-orange-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className={`border-none shadow-lg bg-gradient-to-br ${color} text-white overflow-hidden relative`}>
              <div className='absolute top-0 right-0 p-3 opacity-10'><Icon className='h-14 w-14' /></div>
              <CardHeader className='pb-1'>
                <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-2xl font-black truncate'><PrivacyText>{value}</PrivacyText></p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Area */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Revenue Chart */}
          <Card className='lg:col-span-2 border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <TrendingUp className='h-4 w-4 text-primary' /> Tren Pendapatan & Pembayaran {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={260}>
                <LineChart data={months} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' className='opacity-20' />
                  <XAxis dataKey='month_short' tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      name === 'revenue' ? (privacyMode ? '••••••' : fmt(Number(v))) : v,
                      name === 'revenue' ? 'Pendapatan' : 'Lunas'
                    ]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Legend formatter={v => <span className='text-[10px] font-bold'>{v === 'revenue' ? 'Pendapatan' : 'Pelanggan Lunas'}</span>} />
                  <Line type='monotone' dataKey='revenue' stroke='#6366f1' strokeWidth={2.5} dot={false} />
                  <Line type='monotone' dataKey='paid' stroke='#22c55e' strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Profile Revenue */}
          <Card className='border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Users className='h-4 w-4 text-primary' /> Revenue per Paket
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 pt-2'>
              {(profileRevData || []).slice(0, 6).map((p: any, i: number) => {
                const maxRev = Math.max(...(profileRevData || []).map((x: any) => parseFloat(x.revenue)))
                const pct = maxRev > 0 ? (parseFloat(p.revenue) / maxRev) * 100 : 0
                const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500']
                return (
                  <div key={i}>
                    <div className='flex justify-between items-center mb-1'>
                      <span className='text-[11px] font-bold'>{p.profile}</span>
                      <span className='text-[10px] text-muted-foreground'>{p.paid_count}/{p.total_users}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'>
                        <div className={`h-2 rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className='text-[10px] font-black text-right min-w-[60px]'><PrivacyText>{fmtShort(parseFloat(p.revenue))}</PrivacyText></span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Per-Month Table */}
        <Card className='border-none shadow-lg overflow-hidden'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
              <BarChart3 className='h-4 w-4 text-primary' /> Detail Per Bulan
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader className='bg-muted/30'>
              <TableRow>
                <TableHead className='w-12 text-center text-xs font-black'>#</TableHead>
                <TableHead className='pl-4 text-xs font-black uppercase'>Bulan</TableHead>
                <TableHead className='text-xs font-black uppercase text-center'>Lunas</TableHead>
                <TableHead className='text-xs font-black uppercase text-center'>Belum</TableHead>
                <TableHead className='text-xs font-black uppercase text-center'>Collection</TableHead>
                <TableHead className='text-xs font-black uppercase text-right pr-4'>Pendapatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className='text-center py-12 animate-pulse text-muted-foreground'>Memuat data...</TableCell></TableRow>
              ) : months.map((m: any, idx: number) => {
                const isCurrent = idx === currentMonthIdx
                const isFuture = idx > currentMonthIdx
                return (
                  <TableRow key={m.month} className={cn(
                    'border-b border-border/30',
                    isCurrent && 'bg-primary/5',
                    isFuture && 'opacity-40'
                  )}>
                    <TableCell className='text-center text-xs font-bold text-muted-foreground'>{idx + 1}</TableCell>
                    <TableCell className='pl-4 font-bold text-sm'>
                      {m.month_name}
                      {isCurrent && <Badge className='ml-2 text-[9px] h-4 px-1.5 bg-primary/20 text-primary hover:bg-primary/20'>Berjalan</Badge>}
                    </TableCell>
                    <TableCell className='text-center text-sm font-bold text-green-600'>{m.paid}</TableCell>
                    <TableCell className='text-center text-sm font-bold text-orange-600'>{m.unpaid}</TableCell>
                    <TableCell className='text-center'>
                      <div className='flex items-center gap-2 justify-center'>
                        <Progress value={m.collection_rate} className='h-1.5 w-16' />
                        <span className='text-[11px] font-black'>{m.collection_rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right pr-4 font-black font-mono text-sm', m.revenue > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                      <PrivacyText>{m.revenue > 0 ? fmt(m.revenue) : '-'}</PrivacyText>
                    </TableCell>
                  </TableRow>
                )
              })}
              {/* Total Row */}
              {months.length > 0 && (
                <TableRow className='bg-muted/30 font-black border-t-2'>
                  <TableCell colSpan={2} className='pl-4 font-black uppercase text-xs tracking-widest'>Total YTD</TableCell>
                  <TableCell className='text-center font-black text-green-600'>{ytdPaid}</TableCell>
                  <TableCell className='text-center font-black text-muted-foreground'>-</TableCell>
                  <TableCell className='text-center'>-</TableCell>
                  <TableCell className='text-right pr-4 font-black text-primary'><PrivacyText>{fmt(ytd)}</PrivacyText></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

      </Main>
    </>
  )
}
