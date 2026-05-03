import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Wifi, Search, Users } from 'lucide-react'
import { CustomersSubNav } from './components/customers-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { useState } from 'react'

export function CustomersOnline() {
  const { activeRouter } = useRouterStore()
  const [search, setSearch] = useState('')

  // PPPoE Active dari daemon/cache
  const { data: pppActive, isLoading: isPppLoading } = useQuery({
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

  // Data pelanggan dari DB untuk info tambahan
  const { data: customersData } = useQuery({
    queryKey: ['customers', activeRouter?.id, 1, '', 500],
    queryFn: async () => {
      const res = await api.get('/get_all_users_paginated.php', {
        params: { router_id: activeRouter?.id, page: 1, per_page: 500, search: '' }
      })
      return res.data?.data || []
    },
    enabled: !!activeRouter,
  })

  // Map username → customer data
  const customerMap = useMemo(() => {
    const map: Record<string, any> = {}
    ;(customersData || []).forEach((c: any) => { map[c.username] = c })
    return map
  }, [customersData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (pppActive || []).filter((a: any) =>
      !q || a.name?.toLowerCase().includes(q) || a.address?.toLowerCase().includes(q) || a['caller-id']?.toLowerCase().includes(q)
    )
  }, [pppActive, search])


  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-green-100 dark:bg-green-900/30 rounded-lg'>
            <Wifi className='h-5 w-5 text-green-600' />
          </div>
          <h1 className='text-lg font-bold'>Pelanggan — Sedang Online</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <CustomersSubNav active='/customers/online' />

        {/* KPI */}
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Card className='border-none bg-green-50 dark:bg-green-900/20 shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Wifi className='h-8 w-8 text-green-500' />
              <div>
                <p className='text-[10px] font-black uppercase text-green-700 dark:text-green-400'>Online Sekarang</p>
                <p className='text-3xl font-black text-green-600'>
                  {isPppLoading ? '...' : (pppActive || []).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none shadow-sm'>
            <CardContent className='py-3 px-4 flex items-center gap-3'>
              <Users className='h-8 w-8 text-primary/50' />
              <div>
                <p className='text-[10px] font-black uppercase text-muted-foreground'>Hasil Filter</p>
                <p className='text-3xl font-black'>{filtered.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className='border-none shadow-sm col-span-2 md:col-span-1'>
            <CardContent className='py-3 px-4'>
              <p className='text-[10px] font-black uppercase text-muted-foreground'>Update</p>
              <p className='text-sm font-bold text-green-600 flex items-center gap-1'>
                <span className='h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block' />
                Real-time (5 detik)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className='relative max-w-xs'>
          <Search className='absolute left-2.5 top-2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Cari username, IP, MAC...'
            className='pl-8 h-8 text-xs'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <Card className='border-none shadow-lg overflow-hidden'>
          <Table>
            <TableHeader className='bg-muted/30'>
              <TableRow>
                <TableHead className='pl-4 text-xs font-black uppercase'>Username</TableHead>
                <TableHead className='text-xs font-black uppercase hidden md:table-cell'>Paket</TableHead>
                <TableHead className='text-xs font-black uppercase'>IP Address</TableHead>
                <TableHead className='text-xs font-black uppercase hidden lg:table-cell'>MAC / Caller ID</TableHead>
                <TableHead className='text-xs font-black uppercase hidden md:table-cell'>Alamat</TableHead>
                <TableHead className='text-xs font-black uppercase text-right pr-4'>Uptime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPppLoading ? (
                <TableRow><TableCell colSpan={6} className='text-center py-16 animate-pulse text-muted-foreground'>Memuat data live...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className='text-center py-16 text-muted-foreground'>Tidak ada pelanggan online</TableCell></TableRow>
              ) : filtered.map((a: any, idx: number) => {
                const customer = customerMap[a.name]
                return (
                  <TableRow key={a['.id'] || idx} className='border-b border-border/30 hover:bg-green-50/20 dark:hover:bg-green-900/10'>
                    <TableCell className='pl-4'>
                      <div className='flex items-center gap-2'>
                        <span className='h-2 w-2 rounded-full bg-green-500 flex-shrink-0' />
                        <span className='font-bold text-sm'><PrivacyText>{a.name}</PrivacyText></span>
                      </div>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      <Badge variant='secondary' className='text-[10px] font-bold'>
                        {customer?.profile || a.service || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className='font-mono text-xs text-blue-600'><PrivacyText>{a.address || '-'}</PrivacyText></TableCell>
                    <TableCell className='text-xs text-muted-foreground font-mono hidden lg:table-cell'>
                      <PrivacyText>{a['caller-id'] || '-'}</PrivacyText>
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden md:table-cell max-w-[150px] truncate'>
                      <PrivacyText>{customer?.alamat || '-'}</PrivacyText>
                    </TableCell>
                    <TableCell className='text-right pr-4 text-xs font-mono font-bold text-green-600'>
                      {a.uptime || '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </Main>
    </>
  )
}
