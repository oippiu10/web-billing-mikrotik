import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { RouterSelector } from '@/components/router-selector'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Analytics } from './components/analytics'
import { Overview } from './components/overview'
import { ActivePPP } from './components/active-ppp'
import { RecentLogs } from './components/recent-logs'
import { Users, DollarSign, Activity, AlertCircle, RefreshCw, TrendingUp, UserCheck, LayoutDashboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { PrivacyText } from '@/components/privacy'
import { ChevronDown, Settings2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dashboard() {
  const { activeRouter } = useRouterStore()

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-stats', activeRouter?.id],
    queryFn: async () => {
      if (!activeRouter) return null
      const res = await api.get('/dashboard_stats.php', {
        params: { router_id: activeRouter.id }
      })
      return res.data.data
    },
    enabled: !!activeRouter,
    refetchInterval: 15000, // Refresh tiap 15 detik untuk PPP live
  })

  // Real-time Traffic State
  const [realtimeTraffic, setRealtimeTraffic] = useState<{time: string, rx: number, tx: number}[]>([])
  const [mainInterface, setMainInterface] = useState('ether1')
  const [isIfaceOpen, setIsIfaceOpen] = useState(false)

  // Fetch available interfaces
  const { data: interfacesData, isLoading: isLoadingInterfaces } = useQuery({
    queryKey: ['router-interfaces', activeRouter?.id],
    queryFn: async () => {
      if (!activeRouter) return []
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter.id, cmd: 'interface' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    staleTime: 60000,
  })

  // Detect/Load Main Interface when interfaces are loaded
  useEffect(() => {
    if (!interfacesData || interfacesData.length === 0) return
    
    const names = interfacesData.map((i: any) => i.name)
    const saved = localStorage.getItem(`dashboard-main-interface-${activeRouter?.id}`)
    
    if (saved && names.includes(saved)) {
      setMainInterface(saved)
    } else {
      const best = interfacesData.find((i: any) => 
        i.comment?.toLowerCase().includes('wan') || 
        i.name?.toLowerCase().includes('wan') ||
        i.name?.toLowerCase().includes('internet') ||
        (i.type === 'ether' && i.running === 'true')
      )
      if (best) setMainInterface(best.name)
      else if (names.length > 0) setMainInterface(names[0])
    }
  }, [interfacesData, activeRouter?.id])

  const handleInterfaceChange = (name: string) => {
    setMainInterface(name)
    setRealtimeTraffic([]) // Reset chart history
    if (activeRouter) {
      localStorage.setItem(`dashboard-main-interface-${activeRouter.id}`, name)
    }
  }

  // Poll Real-time Traffic
  useEffect(() => {
    if (!activeRouter) {
        setRealtimeTraffic([]);
        return;
    }

    const fetchTraffic = async () => {
      try {
        const res = await api.get('/mikrotik_live.php', {
          params: { 
            router_id: activeRouter.id, 
            cmd: 'interface'
          }
        })
        
        if (res.data.success && res.data.data) {
          const allInterfaces = res.data.data
          const traffic = allInterfaces.find((i: any) => i.name === mainInterface) || {}
          
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            rx: parseFloat(traffic['rx-bits-per-second'] || 0) / (1024 * 1024), // Mbps
            tx: parseFloat(traffic['tx-bits-per-second'] || 0) / (1024 * 1024), // Mbps
          }
          
          setRealtimeTraffic(prev => [...prev, newPoint].slice(-30))
        }
      } catch (err) {
        console.error('Failed to fetch realtime traffic', err)
      }
    }

    // Initial fetch
    fetchTraffic()

    const interval = setInterval(fetchTraffic, 2000)
    return () => clearInterval(interval)
  }, [activeRouter, mainInterface])

  // Format IDR currency
  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  const latestTraffic = realtimeTraffic[realtimeTraffic.length - 1] || { rx: 0, tx: 0 }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <RouterSelector />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main fluid>
        <div className='mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4'>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <LayoutDashboard className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Main Overview</span>
            </div>
            <h1 className='text-4xl font-black tracking-tighter uppercase'>Dashboard</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Selamat datang kembali. Berikut adalah ringkasan performa router <span className="text-primary font-bold">{activeRouter?.name}</span> hari ini.
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            <Button 
                variant='outline' 
                size='sm' 
                className="h-9 font-bold uppercase text-[10px] tracking-widest border-primary/20 bg-background/50 backdrop-blur-sm"
                onClick={() => refetch()}
                disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
            <Button size='sm' className="h-9 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
              Download Report
            </Button>
          </div>
        </div>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='analytics'>Analytics</TabsTrigger>
              <TabsTrigger value='reports' disabled>
                Reports
              </TabsTrigger>
              <TabsTrigger value='notifications' disabled>
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {/* Revenue Card - Emerald */}
              <Card className='relative overflow-hidden border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative z-10'>
                  <CardTitle className='text-[10px] font-bold uppercase tracking-widest opacity-80'>
                    Revenue (Bulan Ini)
                  </CardTitle>
                  <DollarSign className='h-4 w-4 opacity-80' />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className='text-3xl font-black tracking-tighter'>
                    <PrivacyText>{isLoading ? '...' : formatIDR(stats?.revenue || 0)}</PrivacyText>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">Target: 100%</span>
                  </div>
                </CardContent>
                <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-12" />
              </Card>

              {/* Total Secret - Purple */}
              <Card className='relative overflow-hidden border-none bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-xl shadow-purple-500/20'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative z-10'>
                  <CardTitle className='text-[10px] font-bold uppercase tracking-widest opacity-80'>Total Secret</CardTitle>
                  <Users className='h-4 w-4 opacity-80' />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className='text-4xl font-black tracking-tighter'>
                    {isLoading ? '...' : stats?.total_secrets || 0}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase opacity-80 tracking-widest">
                    Database Pelanggan
                  </div>
                </CardContent>
                <Users className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-6" />
              </Card>

              {/* Online Users - Blue */}
              <Card className='relative overflow-hidden border-none bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/20'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative z-10'>
                  <CardTitle className='text-[10px] font-bold uppercase tracking-widest opacity-80'>
                    Online Users
                  </CardTitle>
                  <Activity className='h-4 w-4 opacity-80' />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className='text-4xl font-black tracking-tighter'>
                    {isLoading ? '...' : stats?.online_users || 0}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sesi Aktif Sekarang</span>
                  </div>
                </CardContent>
                <Activity className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 -rotate-12" />
              </Card>

              {/* Pending Payments - Orange */}
              <Card className='relative overflow-hidden border-none bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-500/20'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative z-10'>
                  <CardTitle className='text-[10px] font-bold uppercase tracking-widest opacity-80'>
                    Belum Bayar
                  </CardTitle>
                  <AlertCircle className='h-4 w-4 opacity-80' />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className='text-4xl font-black tracking-tighter'>
                    {isLoading ? '...' : stats?.pending_payments || 0}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] border-white/30 text-white uppercase font-black bg-white/10 px-1.5 h-4">
                      Perlu Tindakan
                    </Badge>
                  </div>
                </CardContent>
                <AlertCircle className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-12" />
              </Card>
            </div>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4 shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden'>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <CardTitle className="text-lg font-black uppercase tracking-tight whitespace-nowrap">Traffic Overview</CardTitle>
                    <div className="flex items-center gap-3">
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 whitespace-nowrap">
                        Real-time Network
                      </CardDescription>
                      <Popover open={isIfaceOpen} onOpenChange={setIsIfaceOpen}>
                        <PopoverTrigger asChild>
                           <Button variant="ghost" size="sm" className="h-6 gap-1.5 px-2 font-bold uppercase text-[9px] tracking-wider bg-muted/30 hover:bg-muted border border-dashed border-muted-foreground/20 max-w-[150px]">
                              <Settings2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{mainInterface}</span>
                              <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                           <Command>
                              <CommandInput placeholder="Cari interface..." className="h-9 text-[11px]" />
                              <CommandList>
                                 <CommandEmpty className="py-2 text-[10px] text-muted-foreground">Tidak ditemukan.</CommandEmpty>
                                 <CommandGroup heading="Pilih Interface" className="text-[10px] font-bold uppercase opacity-60">
                                    {interfacesData?.map((iface: any) => (
                                       <CommandItem
                                          key={iface['.id']}
                                          value={iface.name}
                                          onSelect={(currentValue) => {
                                             handleInterfaceChange(currentValue)
                                             setIsIfaceOpen(false)
                                          }}
                                          className="text-xs font-bold"
                                       >
                                          <Check
                                             className={cn(
                                                "mr-2 h-3 w-3",
                                                mainInterface === iface.name ? "opacity-100" : "opacity-0"
                                             )}
                                          />
                                          {iface.name}
                                       </CommandItem>
                                    ))}
                                 </CommandGroup>
                                 {isLoadingInterfaces && (
                                    <div className="p-2 text-[10px] text-muted-foreground text-center">Loading...</div>
                                 )}
                              </CommandList>
                           </Command>
                        </PopoverContent>
                     </Popover>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-4 border-dashed border-muted-foreground/20">
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2 rounded-full h-2 bg-blue-500 shadow-sm shadow-blue-500/50" />
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Download</span>
                       </div>
                       <span className="text-sm font-black text-blue-500 leading-none tabular-nums">
                          {latestTraffic.rx.toFixed(2)} <span className="text-[10px] opacity-70">Mbps</span>
                       </span>
                    </div>
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2 rounded-full h-2 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Upload</span>
                       </div>
                       <span className="text-sm font-black text-emerald-500 leading-none tabular-nums">
                          {latestTraffic.tx.toFixed(2)} <span className="text-[10px] opacity-70">Mbps</span>
                       </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='ps-2'>
                  <Overview data={realtimeTraffic as any} />
                </CardContent>
              </Card>
              <Card className='col-span-1 lg:col-span-3 shadow-xl border-none bg-card/50 backdrop-blur-sm'>
                <CardHeader>
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Active PPP Sessions</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Live Connections Feed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivePPP sessions={stats?.active_sessions} />
                </CardContent>
              </Card>
            </div>
            <RecentLogs 
              mikrotikLogs={stats?.mikrotik_logs} 
              systemLogs={stats?.recent_activities} 
            />
          </TabsContent>
          <TabsContent value='analytics' className='space-y-4'>
            <Analytics />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: '/',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Monitoring',
    href: '/monitoring',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Customers',
    href: '/customers',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Settings',
    href: '/settings',
    isActive: false,
    disabled: false,
  },
]
