import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, FileText, TrendingUp, Users, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/reports/')({ component: ReportsPage })

const rupiah = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0))
const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function ReportsPage() {
  const { activeRouter } = useRouterStore()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const params = { router_id: routerId, month, year }
  const { data: kpi } = useQuery({ queryKey: ['report-kpi', routerId, month, year], queryFn: async () => (await api.get('/finance_report.php', { params: { ...params, action: 'monthly_kpi' } })).data, enabled: !!routerId })
  const { data: annual } = useQuery({ queryKey: ['report-annual', routerId, year], queryFn: async () => (await api.get('/finance_report.php', { params: { router_id: routerId, year, action: 'annual_report' } })).data, enabled: !!routerId })
  const { data: profiles } = useQuery({ queryKey: ['report-profile', routerId, month, year], queryFn: async () => (await api.get('/finance_report.php', { params: { ...params, action: 'profile_revenue' } })).data, enabled: !!routerId })
  const { data: recent } = useQuery({ queryKey: ['report-recent', routerId], queryFn: async () => (await api.get('/finance_report.php', { params: { router_id: routerId, action: 'recent_payments', limit: 10 } })).data, enabled: !!routerId })
  const { data: receivable } = useQuery({ queryKey: ['report-receivable', routerId, month, year], queryFn: async () => (await api.get('/finance_report.php', { params: { ...params, action: 'receivable', per_page: 8 } })).data, enabled: !!routerId })

  const current = kpi?.current || {}
  const yearly = annual?.data || []
  const maxRevenue = useMemo(() => Math.max(...yearly.map((x: any) => Number(x.revenue || 0)), 1), [yearly])
  const exportUrl = `/api/finance_report.php?action=export_receivable_csv&router_id=${routerId}&month=${month}&year=${year}`

  return (
    <>
      <Header fixed><div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><BarChart3 className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>Reports & Analytics</h1></div><RouterSelector /><ThemeSwitch /><ProfileDropdown /></Header>
      <Main className='space-y-4' fluid>
        <div className='flex flex-col justify-between gap-3 md:flex-row md:items-center'>
          <div><h2 className='text-2xl font-bold tracking-tight'>Reports & Analytics</h2><p className='text-muted-foreground'>Laporan pembayaran, tunggakan, revenue profile, dan performa tahunan.</p></div>
          <div className='flex gap-2'><Input className='w-24' type='number' min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /><Input className='w-28' type='number' value={year} onChange={(e) => setYear(Number(e.target.value))} /><Button variant='outline' asChild><a href={exportUrl}><Download className='mr-2 h-4 w-4' /> CSV Piutang</a></Button></div>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <Card><CardContent className='flex items-center gap-3 py-4'><Wallet className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Revenue</p><p className='text-xl font-black'>{rupiah(current.revenue)}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Users className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Paid / Total</p><p className='text-xl font-black'>{current.paid_count || 0}/{current.total_customers || 0}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><FileText className='h-8 w-8 text-red-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Piutang</p><p className='text-xl font-black'>{rupiah(current.receivable)}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><TrendingUp className='h-8 w-8 text-purple-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Collection</p><p className='text-xl font-black'>{current.total_customers ? Math.round((Number(current.paid_count || 0) / Number(current.total_customers)) * 100) : 0}%</p></div></CardContent></Card>
        </div>

        <Card><CardContent className='py-4'><div className='mb-4 flex items-center justify-between'><div><p className='font-bold'>Revenue Tahunan {year}</p><p className='text-sm text-muted-foreground'>Grafik sederhana pendapatan per bulan.</p></div><Badge variant='secondary'>YTD {rupiah(annual?.ytd_revenue)}</Badge></div><div className='flex h-56 items-end gap-2'>{yearly.map((m: any) => <div key={m.month} className='flex flex-1 flex-col items-center gap-2'><div className='w-full rounded-t bg-primary/80 transition-all' style={{ height: `${Math.max((Number(m.revenue || 0) / maxRevenue) * 190, 4)}px` }} title={rupiah(m.revenue)} /><span className='text-xs text-muted-foreground'>{months[m.month - 1]}</span></div>)}</div></CardContent></Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='overflow-hidden'><div className='border-b p-4'><p className='font-bold'>Revenue per Paket/Profile</p></div><Table><TableHeader><TableRow><TableHead>Profile</TableHead><TableHead>User</TableHead><TableHead>Paid</TableHead><TableHead className='text-right'>Revenue</TableHead></TableRow></TableHeader><TableBody>{(profiles?.data || []).map((p: any) => <TableRow key={p.profile}><TableCell className='font-bold'>{p.profile}</TableCell><TableCell>{p.total_users}</TableCell><TableCell>{p.paid_count}</TableCell><TableCell className='text-right'>{rupiah(p.revenue)}</TableCell></TableRow>)}</TableBody></Table></Card>
          <Card className='overflow-hidden'><div className='border-b p-4'><p className='font-bold'>Pembayaran Terbaru</p></div><Table><TableHeader><TableRow><TableHead>Pelanggan</TableHead><TableHead>Periode</TableHead><TableHead className='text-right'>Nominal</TableHead></TableRow></TableHeader><TableBody>{(recent?.data || []).map((p: any) => <TableRow key={p.id}><TableCell><b>{p.username}</b><p className='text-xs text-muted-foreground'>{p.payment_date}</p></TableCell><TableCell>{p.payment_month}/{p.payment_year}</TableCell><TableCell className='text-right'>{rupiah(p.amount)}</TableCell></TableRow>)}</TableBody></Table></Card>
        </div>

        <Card className='overflow-hidden'><div className='border-b p-4'><p className='font-bold'>Top Piutang Bulan Ini</p><p className='text-sm text-muted-foreground'>Data pelanggan belum bayar periode terpilih.</p></div><Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Profile</TableHead><TableHead>Alamat</TableHead><TableHead className='text-right'>Nominal</TableHead></TableRow></TableHeader><TableBody>{(receivable?.data || []).map((r: any) => <TableRow key={r.id || r.username}><TableCell className='font-bold'>{r.username}</TableCell><TableCell>{r.profile}</TableCell><TableCell className='text-sm text-muted-foreground'>{r.alamat}</TableCell><TableCell className='text-right'>{rupiah(r.harga || r.amount || r.receivable)}</TableCell></TableRow>)}</TableBody></Table></Card>
      </Main>
    </>
  )
}
