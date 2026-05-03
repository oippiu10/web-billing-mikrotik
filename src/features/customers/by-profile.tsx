import { useMemo } from 'react'
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Shield, Users, BarChart3, Wifi } from 'lucide-react'
import { CustomersSubNav } from './components/customers-sub-nav'
import { PrivacyText } from '@/components/privacy'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4']
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export function CustomersByProfile() {
  const { activeRouter } = useRouterStore()

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers-all', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/get_all_users_paginated.php', {
        params: { router_id: activeRouter?.id, page: 1, per_page: 9999, search: '' }
      })
      return res.data?.data || []
    },
    enabled: !!activeRouter,
  })

  const { data: pppActive } = useQuery({
    queryKey: ['ppp-active', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_active' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 10000,
  })

  const { data: profilePricing } = useQuery({
    queryKey: ['profile-pricing', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/profile_pricing_operations.php', {
        params: { router_id: activeRouter?.software_id || activeRouter?.id }
      })
      return res.data?.data || []
    },
    enabled: !!activeRouter,
  })

  const activeNames = useMemo(() => new Set((pppActive || []).map((a: any) => a.name)), [pppActive])
  const pricingMap: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {}
    ;(profilePricing || []).forEach((p: any) => { m[p.profile_name] = parseFloat(p.price || 0) })
    return m
  }, [profilePricing])

  const byProfile = useMemo(() => {
    const groups: Record<string, { total: number; online: number; profile: string }> = {}
    ;(customersData || []).forEach((c: any) => {
      const p = c.profile || 'Tanpa Profil'
      if (!groups[p]) groups[p] = { profile: p, total: 0, online: 0 }
      groups[p].total++
      if (activeNames.has(c.username)) groups[p].online++
    })
    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [customersData, activeNames])

  const totalAll   = byProfile.reduce((s, g) => s + g.total, 0)
  const totalOnline = byProfile.reduce((s, g) => s + g.online, 0)

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <Shield className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Pelanggan — Per Profil</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <CustomersSubNav active='/customers/by-profile' />

        {/* KPI */}
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Card className='border-none shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600 text-white'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Users className='h-8 w-8 opacity-80' />
              <div>
                <p className='text-[10px] font-black uppercase opacity-80'>Total Pelanggan</p>
                <p className='text-3xl font-black'>{totalAll}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none shadow-sm bg-gradient-to-br from-green-500 to-emerald-600 text-white'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Wifi className='h-8 w-8 opacity-80' />
              <div>
                <p className='text-[10px] font-black uppercase opacity-80'>Sedang Online</p>
                <p className='text-3xl font-black'>{totalOnline}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none shadow-sm col-span-2 md:col-span-1'>
            <CardContent className='py-3 px-4'>
              <p className='text-[10px] font-black uppercase text-muted-foreground'>Jumlah Profil</p>
              <p className='text-3xl font-black text-primary'>{byProfile.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart + Table */}
        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Bar Chart */}
          <Card className='border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <BarChart3 className='h-4 w-4 text-primary' /> Distribusi Pelanggan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={240}>
                <BarChart data={byProfile} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray='3 3' className='opacity-20' />
                  <XAxis dataKey='profile' tick={{ fontSize: 10, fontWeight: 700 }} angle={-30} textAnchor='end' interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: any, name: any) => [v, name === 'total' ? 'Total' : 'Online']}
                  />
                  <Bar dataKey='total' radius={[4, 4, 0, 0]}>
                    {byProfile.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detail Table */}
          <Card className='border-none shadow-lg overflow-hidden'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Shield className='h-4 w-4 text-primary' /> Detail Per Profil
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className='bg-muted/30'>
                <TableRow>
                  <TableHead className='pl-4 text-xs font-black uppercase'>Profil</TableHead>
                  <TableHead className='text-xs font-black uppercase text-center'>Total</TableHead>
                  <TableHead className='text-xs font-black uppercase text-center'>Online</TableHead>
                  <TableHead className='text-xs font-black uppercase text-center'>Rate</TableHead>
                  <TableHead className='text-xs font-black uppercase text-right pr-4'>Harga</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className='text-center py-12 animate-pulse text-muted-foreground'>Memuat...</TableCell></TableRow>
                ) : byProfile.map((g, i) => {
                  const rate = g.total > 0 ? Math.round((g.online / g.total) * 100) : 0
                  return (
                    <TableRow key={g.profile} className='border-b border-border/30'>
                      <TableCell className='pl-4'>
                        <div className='flex items-center gap-2'>
                          <div className='h-3 w-3 rounded-full flex-shrink-0' style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className='font-bold text-sm'>{g.profile}</span>
                        </div>
                      </TableCell>
                      <TableCell className='text-center font-bold'>{g.total}</TableCell>
                      <TableCell className='text-center'>
                        <Badge className='bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border-0 text-[10px]'>
                          {g.online}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <div className='flex items-center gap-1.5 justify-center'>
                          <div className='h-1.5 w-12 rounded-full bg-muted overflow-hidden'>
                            <div className='h-1.5 rounded-full bg-green-500' style={{ width: `${rate}%` }} />
                          </div>
                          <span className='text-[10px] font-black'>{rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className='text-right pr-4 font-mono text-xs font-bold'>
                        <PrivacyText>{pricingMap[g.profile] ? fmt(pricingMap[g.profile]) : '-'}</PrivacyText>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      </Main>
    </>
  )
}
