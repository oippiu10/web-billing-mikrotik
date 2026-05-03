import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cpu, HardDrive, Zap, Clock, Activity, Network, MousePointerClick, Filter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { TrafficChart } from './components/traffic-chart'
import { InterfaceCard } from './components/interface-card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Progress } from '../../components/ui/progress'

interface RouterResource {
  'cpu-load': string
  'free-memory': string
  'total-memory': string
  'free-hdd-space': string
  'total-hdd-space': string
  uptime: string
  version: string
  'board-name': string
  cpu: string
  'cpu-frequency': string
  'architecture-name': string
  'build-time': string
  'cpu-count': string
  platform: string
}

interface InterfaceData {
  '.id': string
  name: string
  type: string
  status: string
  'rx-byte': string
  'tx-byte': string
  running: string
  disabled: string
  comment?: string
}

interface TrafficPoint {
  time: string
  rx: number
  tx: number
}

interface InterfaceStats {
  id: string
  name: string
  type: string
  status: string
  rxMbps: number
  txMbps: number
  history: { rx: number; tx: number }[]
}

export function Monitoring() {
  const { activeRouter } = useRouterStore()
  
  // Traffic tracking state
  const [trackedInterfaces, setTrackedInterfaces] = useState<Set<string>>(new Set())
  const [interfaceStats, setInterfaceStats] = useState<Record<string, InterfaceStats>>({})
  const [aggregateHistory, setAggregateHistory] = useState<TrafficPoint[]>([])
  
  const [showAllInterfaces, setShowAllInterfaces] = useState(false)
  
  const prevDataRef = useRef<Record<string, { rx: string; tx: string; time: number }>>({})
  
  // Reset stats when router changes
  useEffect(() => {
    setInterfaceStats({})
    setAggregateHistory([])
    prevDataRef.current = {}
  }, [activeRouter?.id])

  // Fetch Resources (CPU, RAM, Uptime)
  const { data: resource } = useQuery<RouterResource | null>({
    queryKey: ['router-resource', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'resource' }
      })
      const d = res.data.data
      // Daemon menyimpan resource sebagai array [{...}], tapi versi lama mungkin object {...}
      if (Array.isArray(d)) return d[0] || null
      if (d && typeof d === 'object' && !Array.isArray(d)) return d as RouterResource
      return null
    },
    enabled: !!activeRouter,
    refetchInterval: 10000,
  })

  // Polling Interface Data for Traffic
  const { data: interfaces } = useQuery<InterfaceData[]>({
    queryKey: ['interfaces', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'interface' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 3000, // 3 seconds - optimized for performance
  })

  // Fetch Identity
  const { data: identity } = useQuery<{ name: string } | null>({
    queryKey: ['router-identity', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'identity' }
      })
      return res.data.data?.[0] || null
    },
    enabled: !!activeRouter,
    refetchInterval: 60000, // 1 minute
  })

  // Logic to calculate Mbps and update history
  useEffect(() => {
    if (!interfaces) return

    const now = Date.now()
    const newStats: Record<string, InterfaceStats> = { ...interfaceStats }
    let totalRxMbps = 0
    let totalTxMbps = 0

    interfaces.forEach(iface => {
      const id = iface['.id']
      const name = iface.name
      const currRx = iface['rx-byte'] || '0'
      const currTx = iface['tx-byte'] || '0'
      const prev = prevDataRef.current[id]

      let rxMbps = 0
      let txMbps = 0

      if (prev) {
        const timeDiff = (now - prev.time) / 1000
        if (timeDiff > 0) {
          // Calculate delta bits, then convert to Mbps
          const deltaRx = Math.max(0, parseInt(currRx) - parseInt(prev.rx))
          const deltaTx = Math.max(0, parseInt(currTx) - parseInt(prev.tx))
          rxMbps = (deltaRx * 8) / (1024 * 1024 * timeDiff)
          txMbps = (deltaTx * 8) / (1024 * 1024 * timeDiff)
        }
      }

      totalRxMbps += rxMbps
      totalTxMbps += txMbps

      // Update individual interface stats
      const prevStats = interfaceStats[id]
      const isTracked = trackedInterfaces.has(id)
      
      // Optimize: Only keep long history for tracked interfaces. 
      // Non-tracked only need 15 points for the sparkline.
      const historyLimit = isTracked ? 60 : 15
      const newHistory = [...(prevStats?.history || []), { rx: rxMbps, tx: txMbps }].slice(-historyLimit)

      newStats[id] = {
        id,
        name,
        type: iface.type,
        status: `${iface.running === 'true' ? 'running' : 'down'} ${iface.disabled === 'true' ? 'disabled' : ''}`,
        rxMbps,
        txMbps,
        history: newHistory
      }

      // Update refs
      prevDataRef.current[id] = { rx: currRx, tx: currTx, time: now }
    })

    setInterfaceStats(newStats)

    // Update aggregate history
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    
    // If tracking specific interfaces, aggregate only those. Otherwise aggregate all.
    let displayRx = totalRxMbps
    let displayTx = totalTxMbps
    
    if (trackedInterfaces.size > 0) {
       displayRx = 0
       displayTx = 0
       trackedInterfaces.forEach(id => {
          if (newStats[id]) {
             displayRx += newStats[id].rxMbps
             displayTx += newStats[id].txMbps
          }
       })
    }

    setAggregateHistory(prev => [...prev, { time: timeStr, rx: displayRx, tx: displayTx }].slice(-60))

  }, [interfaces])

  // Helper to format bytes for system resource tab
  const formatBytes = (bytes: string | number) => {
    const b = parseInt(bytes.toString())
    if (isNaN(b)) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (b === 0) return '0 B'
    const i = Math.floor(Math.log(b) / Math.log(k))
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const toggleTrack = (id: string) => {
    setTrackedInterfaces(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // Reset aggregate history when tracking changes to avoid weird jumps
    setAggregateHistory([])
  }

  const clearTrack = () => {
    setTrackedInterfaces(new Set())
    setAggregateHistory([])
  }

  const sortedInterfaces = useMemo(() => {
    let list = Object.values(interfaceStats)

    // Optimization: Filter out idle interfaces if not showing all
    if (!showAllInterfaces) {
      list = list.filter(stat => 
        trackedInterfaces.has(stat.id) || 
        (stat.status.includes('running') && (stat.rxMbps > 0.05 || stat.txMbps > 0.05))
      )
    }

    const sorted = list.sort((a, b) => {
       // Put tracked interfaces first
       if (trackedInterfaces.has(a.id) && !trackedInterfaces.has(b.id)) return -1
       if (!trackedInterfaces.has(a.id) && trackedInterfaces.has(b.id)) return 1
       // Then sort by traffic
       return (b.rxMbps + b.txMbps) - (a.rxMbps + a.txMbps)
    })

    // Optimization: Limit to top 8 interfaces if not showing all
    return showAllInterfaces ? sorted : sorted.slice(0, 8)
  }, [interfaceStats, trackedInterfaces, showAllInterfaces])

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
            <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 text-primary" />
            </div>
            <h1 className='text-lg font-bold'>Live Monitoring</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        {/* Router Identity Header */}
        <div className="flex items-center justify-between pb-2 border-b border-dashed border-primary/20">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20">
                    <Activity className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                        {identity?.name || activeRouter?.name || '...'}
                        <Badge variant="secondary" className="text-[10px] uppercase font-black px-2 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                            {activeRouter?.host}
                        </Badge>
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                           System Live Status
                        </p>
                        <div className="h-3 w-[1px] bg-muted" />
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                           ROS: {resource?.version || '--'}
                        </p>
                    </div>
                </div>
            </div>
            <div className="text-right hidden md:block bg-muted/30 px-4 py-2 rounded-xl border border-dashed border-muted">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-60">Board Identity</p>
                <p className="text-sm font-black text-primary flex items-center gap-2">
                   <Cpu className="w-3.5 h-3.5" />
                   {resource?.['board-name'] || '--'}
                </p>
            </div>
        </div>

        {/* Top Stats Overview - Premium Design */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <Cpu className="h-16 w-16" />
            </div>
            <CardHeader className='pb-2'>
              <CardTitle className='text-xs font-black uppercase tracking-[0.2em] opacity-80'>CPU Load</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-4xl font-black mb-4'>{resource?.['cpu-load']}%</div>
              <Progress value={parseInt(resource?.['cpu-load'] || '0')} className="h-1.5 bg-white/20" indicatorClassName="bg-white" />
              <p className="text-[10px] mt-2 font-bold opacity-70 uppercase tracking-widest">Router Hardware Status</p>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <Zap className="h-16 w-16" />
            </div>
            <CardHeader className='pb-2'>
              <CardTitle className='text-xs font-black uppercase tracking-[0.2em] opacity-80'>Free Memory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-black mb-1'>{formatBytes(resource?.['free-memory'] || 0)}</div>
              <p className='text-[10px] font-bold opacity-80 uppercase tracking-widest mb-4'>
                Total: {formatBytes(resource?.['total-memory'] || 0)}
              </p>
              <Progress 
                value={(parseInt(resource?.['free-memory'] || '0') / parseInt(resource?.['total-memory'] || '1')) * 100} 
                className="h-1.5 bg-white/20" 
                indicatorClassName="bg-white" 
              />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <HardDrive className="h-16 w-16" />
            </div>
            <CardHeader className='pb-2'>
              <CardTitle className='text-xs font-black uppercase tracking-[0.2em] opacity-80'>Free HDD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-black mb-1'>{formatBytes(resource?.['free-hdd-space'] || 0)}</div>
              <p className='text-[10px] font-bold opacity-80 uppercase tracking-widest mb-4'>
                Total: {formatBytes(resource?.['total-hdd-space'] || 0)}
              </p>
              <Progress 
                value={(parseInt(resource?.['free-hdd-space'] || '0') / parseInt(resource?.['total-hdd-space'] || '1')) * 100} 
                className="h-1.5 bg-white/20" 
                indicatorClassName="bg-white" 
              />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-purple-600 to-purple-700 text-white">
            <div className="absolute top-0 right-0 p-3 opacity-20">
               <Clock className="h-16 w-16" />
            </div>
            <CardHeader className='pb-2'>
              <CardTitle className='text-xs font-black uppercase tracking-[0.2em] opacity-80'>Uptime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-black mb-1 truncate' title={resource?.uptime}>
                {resource?.uptime || '--:--:--'}
              </div>
              <p className='text-[10px] font-bold opacity-80 uppercase tracking-widest mt-4'>
                 RouterOS v{resource?.version} (Stable)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Traffic and Distribution Row */}
        <div className='grid gap-6 lg:grid-cols-4'>
            <div className="lg:col-span-3">
                <TrafficChart 
                    data={aggregateHistory} 
                    title={trackedInterfaces.size > 0 ? "Tracked Interfaces Traffic" : "Aggregate Router Traffic"} 
                    extraAction={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-2 font-bold uppercase text-[10px] tracking-widest">
                            <Filter className="w-3.5 h-3.5" />
                            {trackedInterfaces.size > 0 ? `Selected (${trackedInterfaces.size})` : 'Select Interfaces'}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Available Interfaces
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {interfaces?.map((iface) => (
                            <DropdownMenuCheckboxItem
                              key={iface['.id']}
                              checked={trackedInterfaces.has(iface['.id'])}
                              onCheckedChange={() => toggleTrack(iface['.id'])}
                              className="text-xs font-bold"
                            >
                              {iface.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {trackedInterfaces.size > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuCheckboxItem
                                checked={false}
                                onCheckedChange={clearTrack}
                                className="text-xs font-bold text-destructive"
                              >
                                Clear Selection
                              </DropdownMenuCheckboxItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                />
            </div>

            <div className="lg:col-span-1 space-y-6">
                {/* Detailed System Information Card */}
                <Card className="shadow-xl border-none bg-card/50 backdrop-blur-sm overflow-hidden h-full">
                  <CardHeader className="border-b bg-muted/20 py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                       <Activity className="w-4 h-4" />
                       System Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Board Name</span>
                           <span className="text-xs font-black text-primary truncate">
                              {resource?.['board-name'] || '--'}
                           </span>
                       </div>
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CPU Model</span>
                           <span className="text-xs font-black text-primary truncate max-w-[150px]">
                              {resource?.cpu || '--'}
                           </span>
                       </div>
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CPU Cores</span>
                           <span className="text-xs font-black text-primary">
                              {resource?.['cpu-count'] ? `${resource['cpu-count']} Cores @ ${resource['cpu-frequency']}MHz` : '--'}
                           </span>
                       </div>
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Architecture</span>
                           <span className="text-xs font-black text-primary">{resource?.['architecture-name'] || '--'}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">OS Version</span>
                           <span className="text-xs font-black text-primary">RouterOS v{resource?.version || '--'}</span>
                       </div>
                       <div className="flex justify-between items-center border-b border-dashed pb-3">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Build Time</span>
                           <span className="text-[10px] font-bold text-primary">{resource?.['build-time'] || '--'}</span>
                       </div>
                       <div className="flex justify-between items-center pt-2">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                           <Badge variant="default" className="bg-green-500 h-5 px-3 hover:bg-green-600 font-bold border-0 text-[10px] uppercase">Connected</Badge>
                       </div>
                  </CardContent>
                  
                  {/* Bottom footer for the card */}
                  <div className="p-4 bg-muted/20 border-t mt-auto text-center">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
                        MikroTik Monitoring System
                      </p>
                  </div>
                </Card>
            </div>
        </div>

        {/* Interfaces Section */}
        <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-black uppercase tracking-tight">Interfaces</h2>
                <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 font-bold bg-muted/50">
                    {interfaces?.length || 0}
                </Badge>
                </div>
                <div className="flex items-center gap-3">
                {trackedInterfaces.size > 0 && (
                    <button 
                        onClick={clearTrack}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                        <MousePointerClick className="w-3 h-3" /> Clear ({trackedInterfaces.size})
                    </button>
                )}
                <div className="h-4 w-[1px] bg-muted mx-1" />
                <button 
                    onClick={() => setShowAllInterfaces(!showAllInterfaces)}
                    className={cn(
                    "text-xs font-bold px-2 py-1 rounded-md transition-colors",
                    showAllInterfaces ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    {showAllInterfaces ? "Hide Idle" : "Show All"}
                </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedInterfaces.map(stats => (
                <InterfaceCard
                key={stats.id}
                name={stats.name}
                type={stats.type}
                status={stats.status}
                rxMbps={stats.rxMbps}
                txMbps={stats.txMbps}
                history={stats.history}
                isTracked={trackedInterfaces.has(stats.id)}
                onTrackToggle={() => toggleTrack(stats.id)}
                />
            ))}
            {sortedInterfaces.length === 0 && (
                <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground border border-dashed rounded-xl">
                    Sedang mengambil data interface...
                </div>
            )}
            </div>
        </div>
      </Main>
    </>
  )
}

