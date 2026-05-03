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
import { ODPSubNav } from './components/odp-sub-nav'
import { Network, Share2, Users, PieChart, TrendingUp, AlertTriangle, ShieldCheck, Search, ChevronLeft, ChevronRight, ArrowUpDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { usePPPoEData } from '../pppoe/hooks/use-pppoe-data'
import { cn, getPageNumbers } from '@/lib/utils'

export function ODPCapacity() {
  const { activeRouter } = useRouterStore()
  const { pppSecrets } = usePPPoEData()

  // State for search, sort, pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'capacity'>('name')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { data: odpList, isLoading } = useQuery({
    queryKey: ['odps', activeRouter?.id],
    queryFn: async () => {
      if (!activeRouter) return []
      const res = await api.get('/odp.php', {
        params: { router_id: activeRouter.id },
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  // Calculate Stats
  const totalODP = odpList?.length || 0
  const totalSecrets = pppSecrets.length
  
  const totalPorts = useMemo(() => odpList?.reduce((acc: number, odp: any) => {
    if (odp.type === 'splitter') {
      const parts = odp.splitter_type?.split(':')
      const ports = parts && parts.length > 1 ? parseInt(parts[1]) : 0
      return acc + (ports || 0)
    }
    return acc + (parseInt(odp.ratio_total) || 0)
  }, 0) || 0, [odpList])

  const usedPorts = useMemo(() => odpList?.reduce((acc: number, odp: any) => {
    if (odp.type === 'ratio') {
      return acc + (parseInt(odp.ratio_used) || 0)
    }
    return acc + (parseInt(odp.total_users) || 0)
  }, 0) || 0, [odpList])

  const assignedUsersCount = useMemo(() => odpList?.reduce((acc: number, odp: any) => acc + (parseInt(odp.total_users) || 0), 0) || 0, [odpList])
  const unassignedCount = Math.max(0, totalSecrets - assignedUsersCount)

  const freePorts = totalPorts - usedPorts
  const overallUsage = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0

  // Filter and Sort Data
  const filteredAndSortedODP = useMemo(() => {
    if (!odpList) return []
    
    const result = [...odpList].filter(odp => 
      odp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      odp.location?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      
      const getUsage = (o: any) => {
        let cap = 0, u = 0
        if (o.type === 'splitter') {
          const p = o.splitter_type?.split(':')
          cap = p && p.length > 1 ? parseInt(p[1]) : 0
          u = parseInt(o.total_users) || 0
        } else {
          cap = parseInt(o.ratio_total) || 0
          u = parseInt(o.ratio_used) || 0
        }
        return cap > 0 ? (u / cap) : 0
      }

      const getCap = (o: any) => {
        if (o.type === 'splitter') {
          const p = o.splitter_type?.split(':')
          return p && p.length > 1 ? parseInt(p[1]) : 0
        }
        return parseInt(o.ratio_total) || 0
      }

      if (sortBy === 'usage') return getUsage(b) - getUsage(a)
      if (sortBy === 'capacity') return getCap(b) - getCap(a)
      return 0
    })

    return result
  }, [odpList, searchTerm, sortBy])

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedODP.length / itemsPerPage)
  const paginatedODP = filteredAndSortedODP.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  const stats = [
    {
      label: 'Total ODP',
      value: totalODP,
      icon: Network,
      color: 'from-blue-500 to-indigo-600',
      desc: 'Titik distribusi aktif'
    },
    {
      label: 'Total Kapasitas',
      value: totalPorts,
      icon: Share2,
      color: 'from-purple-500 to-violet-600',
      desc: 'Total port tersedia'
    },
    {
      label: 'Terpakai',
      value: usedPorts,
      icon: Users,
      color: 'from-emerald-500 to-teal-600',
      desc: `${overallUsage}% dari total`
    },
    {
      label: 'Tersedia',
      value: freePorts,
      icon: ShieldCheck,
      color: 'from-amber-500 to-orange-600',
      desc: 'Siap untuk pelanggan baru'
    }
  ]

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <PieChart className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Overview ODP</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <ODPSubNav active='/odp/capacity' />

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
                  {isLoading ? <span className='animate-pulse'>...</span> : item.value}
                </div>
                <p className='text-[10px] font-bold opacity-70 uppercase tracking-wider'>{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Unassigned Users Alert */}
        {unassignedCount > 0 && (
            <div className='flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-500'>
                <div className='flex items-center gap-2'>
                    <AlertTriangle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                    <span className='text-[11px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider'>
                        Perhatian: <span className="text-amber-600 dark:text-amber-400 mx-1">{unassignedCount} User</span> 
                        di router belum dipetakan ke ODP manapun.
                    </span>
                </div>
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[9px] font-black h-5">
                    VALIDASI DATABASE
                </Badge>
            </div>
        )}

        {/* Overall Usage Progress - Animated with Gradient */}
        <Card className='border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden'>
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-primary/10 rounded-lg'>
                  <TrendingUp className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <p className='text-xs font-black uppercase tracking-widest text-muted-foreground'>Okupansi Jaringan</p>
                  <h3 className='text-3xl font-black text-primary'>{overallUsage}%</h3>
                </div>
              </div>
              <div className='text-right'>
                <Badge variant='outline' className='font-black border-primary/30 text-primary'>
                  {usedPorts} / {totalPorts} PORT
                </Badge>
                <p className='text-[10px] text-muted-foreground font-bold mt-1 uppercase'>Port Terpakai vs Total</p>
              </div>
            </div>
            
            {/* Custom Dynamic Progress Bar */}
            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className="h-full transition-all duration-1000 ease-out" 
                    style={{ 
                        width: isMounted ? `${overallUsage}%` : '0%',
                        background: overallUsage >= 90 
                            ? 'linear-gradient(to right, #10b981, #ef4444)' 
                            : overallUsage >= 70 
                            ? 'linear-gradient(to right, #10b981, #f59e0b)' 
                            : '#10b981'
                    }}
                />
            </div>
          </CardContent>
        </Card>

        {/* Vertical Stack: Detailed List then Insight */}
        <div className='space-y-6'>
          {/* Detailed List with Professional Pagination */}
          <Card className='border-none shadow-lg'>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b mb-4">
              <div>
                <CardTitle className='text-lg font-black uppercase tracking-tight'>Distribusi Port per ODP</CardTitle>
                <CardDescription className='text-xs'>Daftar penggunaan port dari masing-masing titik ODP.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                 <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                        placeholder="Cari ODP..." 
                        className="h-8 pl-8 text-xs w-48"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setCurrentPage(1)
                        }}
                    />
                 </div>
                 <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="h-8 text-xs w-32">
                        <ArrowUpDown className="mr-2 h-3 w-3" />
                        <SelectValue placeholder="Urutkan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name" className="text-xs">Nama ODP</SelectItem>
                        <SelectItem value="usage" className="text-xs">Penggunaan Tinggi</SelectItem>
                        <SelectItem value="capacity" className="text-xs">Kapasitas Terbesar</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </CardHeader>
            <CardContent className='space-y-6 pt-2 pb-2'>
              {isLoading ? (
                <div className='space-y-4'>
                   {[1,2,3].map(i => <div key={i} className='h-12 bg-muted animate-pulse rounded-lg' />)}
                </div>
              ) : (
                paginatedODP.map((odp: any) => {
                  let capacity = 0
                  let used = 0

                  if (odp.type === 'splitter') {
                    const parts = odp.splitter_type?.split(':')
                    capacity = parts && parts.length > 1 ? parseInt(parts[1]) : 0
                    used = parseInt(odp.total_users) || 0
                  } else {
                    capacity = parseInt(odp.ratio_total) || 0
                    used = parseInt(odp.ratio_used) || 0
                  }

                  const usage = capacity > 0 ? Math.round((used / capacity) * 100) : 0
                  const isFull = usage >= 90
                  const isNearFull = usage >= 70 && usage < 90

                  return (
                    <div key={odp.id} className='group border-b last:border-0 pb-4 last:pb-0'>
                      <div className='flex justify-between items-end mb-2'>
                        <div className='flex flex-col'>
                          <span className='text-sm font-black group-hover:text-primary transition-colors'>{odp.name}</span>
                          <span className='text-[10px] text-muted-foreground font-bold uppercase'>{odp.location || 'Lokasi Belum Diatur'}</span>
                        </div>
                        <div className='flex flex-col items-end'>
                           <div className='flex items-center gap-2'>
                              {isFull && <AlertTriangle className='h-3 w-3 text-red-500 animate-pulse' />}
                              <span className={cn(
                                'text-xs font-black',
                                isFull ? 'text-red-500' : isNearFull ? 'text-orange-500' : 'text-primary'
                              )}>
                                {used} / {capacity} Port
                              </span>
                           </div>
                           <span className='text-[10px] font-bold opacity-60'>{usage}% Terpakai</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                            className={cn(
                                "h-full transition-all duration-1000 ease-out",
                                isFull ? "bg-red-500" : isNearFull ? "bg-orange-500" : "bg-primary"
                            )}
                            style={{ width: isMounted ? `${usage}%` : '0%' }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
              {filteredAndSortedODP.length === 0 && !isLoading && (
                <div className='text-center py-10 text-muted-foreground font-bold italic text-sm'>
                   Data ODP tidak ditemukan.
                </div>
              )}
            </CardContent>

            {/* Professional Pagination Footer (Standard Style) */}
            <div className='flex items-center justify-between border-t px-6 py-4'>
                <div className='flex items-center gap-2'>
                    <Select
                        value={`${itemsPerPage}`}
                        onValueChange={(v) => {
                            setItemsPerPage(Number(v))
                            setCurrentPage(1)
                        }}
                    >
                        <SelectTrigger className='h-8 w-[70px] text-xs'>
                            <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side='top'>
                            {[5, 10, 20, 50].map((size) => (
                                <SelectItem key={size} value={`${size}`} className="text-xs">
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className='text-xs font-medium text-muted-foreground'>Rows per page</p>
                </div>

                <div className='flex items-center gap-6'>
                    <div className='text-xs font-medium'>
                        Page {currentPage} of {totalPages || 1}
                    </div>
                    <div className='flex items-center space-x-1.5'>
                        <Button
                            variant='outline'
                            className='size-8 p-0'
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronsLeft className='h-4 w-4' />
                        </Button>
                        <Button
                            variant='outline'
                            className='size-8 p-0'
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className='h-4 w-4' />
                        </Button>

                        {/* Page Numbers */}
                        {pageNumbers.map((page, i) => (
                            <div key={i}>
                                {page === '...' ? (
                                    <span className='px-1 text-xs text-muted-foreground'>...</span>
                                ) : (
                                    <Button
                                        variant={currentPage === page ? 'default' : 'outline'}
                                        className='h-8 min-w-8 px-2 text-xs'
                                        onClick={() => setCurrentPage(page as number)}
                                    >
                                        {page}
                                    </Button>
                                )}
                            </div>
                        ))}

                        <Button
                            variant='outline'
                            className='size-8 p-0'
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            <ChevronRight className='h-4 w-4' />
                        </Button>
                        <Button
                            variant='outline'
                            className='size-8 p-0'
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            <ChevronsRight className='h-4 w-4' />
                        </Button>
                    </div>
                </div>
            </div>
          </Card>

          <Card className='border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white'>
            <CardHeader>
              <CardTitle className='text-lg font-black uppercase tracking-tight'>Insight Kapasitas</CardTitle>
            </CardHeader>
            <CardContent className='grid md:grid-cols-2 gap-4'>
               <div className='p-4 rounded-xl bg-white/5 border border-white/10'>
                  <h4 className='text-sm font-bold mb-1 flex items-center gap-2'>
                    <AlertTriangle className='h-4 w-4 text-amber-400' />
                    ODP Hampir Penuh
                  </h4>
                  <p className='text-[10px] opacity-70 leading-relaxed mb-3'>ODP berikut telah mencapai penggunaan di atas 80% dan memerlukan perhatian khusus.</p>
                  <div className='space-y-2'>
                    {odpList?.filter((o: any) => {
                      let cap = 0, u = 0
                      if (o.type === 'splitter') {
                        const p = o.splitter_type?.split(':')
                        cap = p && p.length > 1 ? parseInt(p[1]) : 0
                        u = parseInt(o.total_users) || 0
                      } else {
                        cap = parseInt(o.ratio_total) || 0
                        u = parseInt(o.ratio_used) || 0
                      }
                      return cap > 0 && (u / cap) >= 0.8
                    }).slice(0, 3).map((o: any) => (
                      <div key={o.id} className='flex justify-between items-center bg-white/5 p-2 rounded-lg'>
                        <span className='text-xs font-bold'>{o.name}</span>
                        <Badge className='bg-red-500 hover:bg-red-600 text-[9px] font-black'>Critical</Badge>
                      </div>
                    ))}
                    {odpList?.filter((o: any) => {
                      let cap = 0, u = 0
                      if (o.type === 'splitter') {
                        const p = o.splitter_type?.split(':')
                        cap = p && p.length > 1 ? parseInt(p[1]) : 0
                        u = parseInt(o.total_users) || 0
                      } else {
                        cap = parseInt(o.ratio_total) || 0
                        u = parseInt(o.ratio_used) || 0
                      }
                      return cap > 0 && (u / cap) >= 0.8
                    }).length === 0 && (
                      <p className='text-[10px] italic opacity-50'>Tidak ada ODP yang kritis.</p>
                    )}
                  </div>
               </div>

               <div className='p-4 rounded-xl bg-white/5 border border-white/10'>
                  <h4 className='text-sm font-bold mb-1 flex items-center gap-2'>
                    <TrendingUp className='h-4 w-4 text-emerald-400' />
                    Rencana Ekspansi
                  </h4>
                  <p className='text-[10px] opacity-70 leading-relaxed'>
                    Berdasarkan okupansi saat ini sebesar <b>{overallUsage}%</b>, disarankan untuk merencanakan penambahan kapasitas di area dengan konsentrasi ODP merah tinggi.
                  </p>
                  <div className="mt-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-[10px] font-bold">Rekomendasi:</p>
                    <p className="text-[10px] opacity-60">Tambahkan minimal 2 ODP baru atau upgrade splitter 1:8 ke 1:16 pada ODP yang penuh.</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
