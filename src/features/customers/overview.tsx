import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RouterSelector } from '@/components/router-selector'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CustomersSubNav } from './components/customers-sub-nav'
import { Users, Globe, UserCheck, UserMinus, PieChart as PieChartIcon, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Package, Share2, AlertTriangle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

export function CustomerOverview() {
  const { activeRouter } = useRouterStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch Total Data from DB
  const { data: dbData, isLoading: isDbLoading } = useQuery({
    queryKey: ['customers-summary', activeRouter?.id],
    queryFn: async () => {
      if (!activeRouter) return null
      const res = await api.get('/get_all_users_paginated.php', {
        params: { router_id: activeRouter.id, page: 1, per_page: 1 },
      })
      return res.data
    },
    enabled: !!activeRouter,
  })

  // Fetch Live Active Users from MikroTik
  const { data: activeUsers, isLoading: isActiveLoading } = useQuery({
    queryKey: ['ppp-active', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_active' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 5000,
  })

  // Fetch Secrets for Profile Distribution
  const { data: secrets, isLoading: isSecretsLoading } = useQuery({
    queryKey: ['ppp-secret', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_secret' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  // Fetch ODP Data for Top 5 Chart
  const { data: odpList, isLoading: isOdpLoading } = useQuery({
    queryKey: ['odps-summary', activeRouter?.id],
    queryFn: async () => {
      if (!activeRouter) return []
      const res = await api.get('/odp.php', {
        params: { router_id: activeRouter.id },
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  // Calculations
  const totalCustomers = dbData?.total_all || 0
  const onlineCount = activeUsers?.length || 0
  const offlineCount = Math.max(0, totalCustomers - onlineCount)
  const completeData = dbData?.total_complete || 0
  const incompleteData = Math.max(0, totalCustomers - completeData)

  const onlinePercentage = totalCustomers > 0 ? Math.round((onlineCount / totalCustomers) * 100) : 0
  const completePercentage = totalCustomers > 0 ? Math.round((completeData / totalCustomers) * 100) : 0

  // Chart Data: Status Pie
  const statusData = [
    { name: 'Online', value: onlineCount, color: '#10b981' },
    { name: 'Offline', value: offlineCount, color: '#f43f5e' },
  ]

  // Chart Data: Profiles
  const profileChartData = useMemo(() => {
    if (!secrets) return []
    const counts: Record<string, number> = {}
    secrets.forEach((s: any) => {
      const p = s.profile || 'default'
      counts[p] = (counts[p] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [secrets])

  // Chart Data: ODP Distribution (Top 5)
  const odpChartData = useMemo(() => {
    if (!odpList) return []
    return [...odpList]
      .map((o: any) => ({
        name: o.name,
        value: parseInt(o.total_users) || 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [odpList])

  const stats = [
    {
      label: 'Total Pelanggan',
      value: totalCustomers,
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      desc: 'Terdaftar di database'
    },
    {
      label: 'Sedang Online',
      value: onlineCount,
      icon: Globe,
      color: 'from-emerald-500 to-teal-600',
      desc: `${onlinePercentage}% dari total`
    },
    {
      label: 'Data Lengkap',
      value: completeData,
      icon: UserCheck,
      color: 'from-sky-500 to-blue-600',
      desc: 'Alamat, ODP, & WA valid'
    },
    {
      label: 'Data Tidak Lengkap',
      value: incompleteData,
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-600',
      desc: 'Butuh validasi database'
    }
  ]

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <PieChartIcon className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Overview Pelanggan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <CustomersSubNav active='/customers/overview' />

        {/* KPI Cards */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {stats.map((item) => (
            <Card key={item.label} className={cn(
              "relative overflow-hidden border-none shadow-xl bg-gradient-to-br text-white transition-all duration-500",
              item.color,
              isMounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}>
              <div className='absolute top-0 right-0 p-3 opacity-10'>
                <item.icon className='h-16 w-16' />
              </div>
              <CardHeader className='pb-1'>
                <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-4xl font-black mb-1'>
                  {isDbLoading || isActiveLoading ? <span className='animate-pulse'>...</span> : item.value}
                </div>
                <p className='text-[10px] font-bold opacity-70 uppercase tracking-wider'>{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Status Distribution */}
          <Card className='lg:col-span-1 border-none shadow-lg'>
            <CardHeader>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Activity className='h-4 w-4 text-primary' />
                Status Koneksi
              </CardTitle>
              <CardDescription className='text-[10px]'>Rasio pelanggan online vs offline saat ini.</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col items-center justify-center pt-0'>
              <div className='h-[200px] w-full'>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className='flex gap-4 mt-2'>
                <div className='flex items-center gap-1.5'>
                  <div className='h-3 w-3 rounded-full bg-[#10b981]' />
                  <span className='text-[10px] font-bold'>Online</span>
                </div>
                <div className='flex items-center gap-1.5'>
                  <div className='h-3 w-3 rounded-full bg-[#f43f5e]' />
                  <span className='text-[10px] font-bold'>Offline</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Distribution */}
          <Card className='lg:col-span-2 border-none shadow-lg'>
            <CardHeader>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Package className='h-4 w-4 text-primary' />
                Distribusi Paket / Profile
              </CardTitle>
              <CardDescription className='text-[10px]'>Jumlah pelanggan berdasarkan profil PPPoE.</CardDescription>
            </CardHeader>
            <CardContent className='pt-0'>
              <div className='h-[250px] w-full'>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profileChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold' }}
                      width={80}
                    />
                    <Tooltip 
                       cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                       contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} animationBegin={500} animationDuration={1500}>
                      {profileChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Top ODPs */}
          <Card className='border-none shadow-lg'>
            <CardHeader>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <Share2 className='h-4 w-4 text-primary' />
                Top 5 Titik Distribusi (ODP)
              </CardTitle>
              <CardDescription className='text-[10px]'>ODP dengan jumlah pelanggan terbanyak.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className='space-y-4'>
                 {isOdpLoading ? (
                    <div className='space-y-3 animate-pulse'>
                        {[1,2,3,4,5].map(i => <div key={i} className='h-4 bg-muted rounded' />)}
                    </div>
                 ) : (
                    odpChartData.map((odp: any, i: number) => {
                        const percentage = totalCustomers > 0 ? Math.round((odp.value / totalCustomers) * 100) : 0
                        return (
                          <div key={i} className='space-y-1.5'>
                            <div className='flex justify-between items-center'>
                              <span className='text-xs font-bold'>{odp.name}</span>
                              <span className='text-[10px] font-black opacity-60'>{odp.value} User ({percentage}%)</span>
                            </div>
                            <Progress value={isMounted ? percentage : 0} className='h-1.5' />
                          </div>
                        )
                    })
                 )}
                 {!isOdpLoading && odpChartData.length === 0 && (
                    <p className='text-center py-6 text-xs text-muted-foreground italic font-bold'>Belum ada data ODP terhubung.</p>
                 )}
               </div>
            </CardContent>
          </Card>

          {/* Data Quality */}
          <Card className='border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white'>
             <CardHeader>
               <CardTitle className='text-lg font-black uppercase tracking-tight'>Insight Pelanggan</CardTitle>
             </CardHeader>
             <CardContent className='space-y-6'>
                <div className='p-4 rounded-xl bg-white/5 border border-white/10'>
                  <h4 className='text-sm font-bold mb-1 flex items-center gap-2'>
                    <Activity className='h-4 w-4 text-emerald-400' />
                    Kesehatan Jaringan
                  </h4>
                  <p className='text-[10px] opacity-70 leading-relaxed'>
                    Tingkat online pelanggan saat ini berada di angka <b>{onlinePercentage}%</b>. 
                    {onlinePercentage > 80 ? ' Jaringan dalam kondisi sangat stabil.' : onlinePercentage > 50 ? ' Jaringan dalam kondisi normal.' : ' Periksa log aktivitas untuk melihat adanya gangguan area.'}
                  </p>
                </div>

                <div className='p-4 rounded-xl bg-white/5 border border-white/10'>
                  <h4 className='text-sm font-bold mb-1 flex items-center gap-2'>
                    <AlertTriangle className='h-4 w-4 text-amber-400' />
                    Kelengkapan Database
                  </h4>
                  <p className='text-[10px] opacity-70 leading-relaxed mb-3'>
                    Ada <b>{incompleteData}</b> pelanggan yang belum dipetakan ke ODP atau koordinat lokasi secara lengkap.
                  </p>
                  <Progress value={completePercentage} className='h-1.5 bg-white/10' />
                  <p className='text-[9px] mt-2 opacity-50 font-bold uppercase'>INTEGRASI DATA: {completePercentage}% SELESAI</p>
                </div>
             </CardContent>
          </Card>
        </div>

      </Main>
    </>
  )
}
