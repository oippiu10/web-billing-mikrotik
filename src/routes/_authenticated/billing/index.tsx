import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, FileText, Receipt, Send, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/billing/')({ component: BillingCenter })

const rupiah = (n: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0))

function BillingCenter() {
  const { activeRouter } = useRouterStore()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const params = { router_id: routerId, month, year }

  const { data: kpi } = useQuery({ queryKey: ['billing-center-kpi', routerId, month, year], queryFn: async () => (await api.get('/finance_report.php', { params: { ...params, action: 'monthly_kpi' } })).data, enabled: !!routerId, refetchInterval: 60000 })
  const { data: recent } = useQuery({ queryKey: ['billing-center-recent', routerId], queryFn: async () => (await api.get('/finance_report.php', { params: { router_id: routerId, action: 'recent_payments', limit: 8 } })).data, enabled: !!routerId })
  const { data: receivable } = useQuery({ queryKey: ['billing-center-receivable', routerId, month, year], queryFn: async () => (await api.get('/finance_report.php', { params: { ...params, action: 'receivable', per_page: 8 } })).data, enabled: !!routerId })

  const cur = kpi?.current || {}
  const collection = cur.total_customers ? Math.round((Number(cur.paid_count || 0) / Number(cur.total_customers)) * 100) : 0

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><CreditCard className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>Billing Center</h1></div>
        <RouterSelector /><ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main className='space-y-4' fluid>
        <div className='flex flex-col justify-between gap-3 md:flex-row md:items-center'>
          <div><h2 className='text-2xl font-bold tracking-tight'>Billing Center</h2><p className='text-muted-foreground'>Pusat invoice, pembayaran, piutang, reminder WA, dan laporan billing.</p></div>
          <div className='flex gap-2'><Input className='w-24' type='number' min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /><Input className='w-28' type='number' value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <Card><CardContent className='flex items-center gap-3 py-4'><Wallet className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Revenue</p><p className='text-xl font-black'>{rupiah(cur.revenue)}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><CheckCircle2 className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Lunas</p><p className='text-xl font-black'>{cur.paid_count || 0}/{cur.total_customers || 0}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><AlertCircle className='h-8 w-8 text-red-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Piutang</p><p className='text-xl font-black'>{rupiah(cur.receivable)}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Receipt className='h-8 w-8 text-purple-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Collection</p><p className='text-xl font-black'>{collection}%</p></div></CardContent></Card>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <Button asChild className='h-16 justify-start gap-3'><Link to='/finance/billing'><Receipt className='h-5 w-5' /> Invoice & Pembayaran</Link></Button>
          <Button asChild variant='outline' className='h-16 justify-start gap-3'><Link to='/finance/receivable'><Send className='h-5 w-5' /> Piutang & Reminder WA</Link></Button>
          <Button asChild variant='outline' className='h-16 justify-start gap-3'><Link to='/finance/report'><FileText className='h-5 w-5' /> Laporan Finance</Link></Button>
          <Button asChild variant='outline' className='h-16 justify-start gap-3'><Link to='/reports'><FileText className='h-5 w-5' /> Analytics Lengkap</Link></Button>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='overflow-hidden'><div className='border-b p-4'><p className='font-bold'>Pembayaran Terbaru</p></div><Table><TableHeader><TableRow><TableHead>Pelanggan</TableHead><TableHead>Periode</TableHead><TableHead className='text-right'>Nominal</TableHead></TableRow></TableHeader><TableBody>{(recent?.data || []).map((p: any) => <TableRow key={p.id}><TableCell><b>{p.username}</b><p className='text-xs text-muted-foreground'>{p.payment_date}</p></TableCell><TableCell>{p.payment_month}/{p.payment_year}</TableCell><TableCell className='text-right'>{rupiah(p.amount)}</TableCell></TableRow>)}</TableBody></Table></Card>
          <Card className='overflow-hidden'><div className='border-b p-4'><p className='font-bold'>Piutang Periode Ini</p></div><Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Profile</TableHead><TableHead className='text-right'>Nominal</TableHead></TableRow></TableHeader><TableBody>{(receivable?.data || []).map((r: any) => <TableRow key={r.id || r.username}><TableCell className='font-bold'>{r.username}</TableCell><TableCell>{r.profile}</TableCell><TableCell className='text-right'>{rupiah(r.harga || r.amount || r.receivable)}</TableCell></TableRow>)}</TableBody></Table></Card>
        </div>
      </Main>
    </>
  )
}
