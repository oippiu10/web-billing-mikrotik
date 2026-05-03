import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RouterSelector } from '@/components/router-selector'
import { CustomersTable } from './components/customers-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserPlus, SearchIcon, RefreshCw, LayoutGrid, Users, Wifi, WifiOff, CheckCircle2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { CustomerMutateDialog } from './components/customer-mutate-drawer'
import { BatchEditCustomers } from './components/batch-edit-customers'
import { CustomersSubNav } from './components/customers-sub-nav'
import { type Customer } from './data/schema'
import { usePermission } from '@/lib/permissions'

export function Customers() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const permissions = usePermission()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isBatchEditView, setIsBatchEditView] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])
  const perPage = isBatchEditView ? 10 : 20

  const { data, isLoading } = useQuery({
    queryKey: ['customers', activeRouter?.id, page, search, perPage],
    queryFn: async () => {
      if (!activeRouter) return null
      const res = await api.get('/get_all_users_paginated.php', {
        params: {
          router_id: activeRouter.id,
          page,
          per_page: perPage,
          search,
        },
      })
      return res.data
    },
    enabled: !!activeRouter,
    staleTime: 30_000,
  })

  const { data: profilesData } = useQuery({
    queryKey: ['ppp-profile', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_profile' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  const profiles = profilesData?.map((p: any) => p.name) || []

  const mapsConvertMutation = useMutation({
    mutationFn: async () => {
      if (!activeRouter) throw new Error('Pilih router terlebih dahulu')
      const res = await api.post('/maps_bulk_convert.php', {
        router_id: activeRouter.software_id || activeRouter.id,
        limit: 25,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Maps dikonversi: ${data.updated} berhasil, ${data.failed} gagal. Sisa ${data.remaining}.`)
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      } else {
        toast.error(data.message || 'Gagal konversi maps')
      }
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Gagal konversi maps')
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
        if (!activeRouter) throw new Error('Pilih router terlebih dahulu')
        const res = await api.get('/sync_ppp_to_db.php', {
            params: { router_id: activeRouter.id }
        })
        return res.data
    },
    onSuccess: (data) => {
        if (data.success) {
            const { added, updated, deleted } = data.details || { added: 0, updated: 0, deleted: 0 }
            toast.success(`Sinkronisasi berhasil! ${added} ditambah, ${updated} diperbarui, ${deleted} dihapus.`)
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        } else {
            toast.error(data.message || 'Gagal sinkronisasi')
        }
    },
    onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Terjadi kesalahan saat sinkronisasi')
    }
  })

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
            <h1 className='text-lg font-bold'>Manajemen Pelanggan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-col gap-4' fluid>
        <CustomersSubNav active='/customers' />
        <div className='relative overflow-hidden rounded-xl border-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white shadow-sm'>
          <div className='absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10' />
          <div className='absolute bottom-0 right-24 h-20 w-20 rounded-full bg-white/10' />
          <div className='relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-xl font-bold tracking-tight'>Database Pelanggan</h2>
              <p className='text-sm text-white/80'>Kelola PPPoE, billing, ODP, WhatsApp, lokasi, dan data instalasi pelanggan.</p>
            </div>
            <div className='rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold'>Load dari database • sync manual</div>
          </div>
        </div>
        <div className='grid gap-3 md:grid-cols-4'>
          <div className='rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-sm'>
            <div className='flex items-center justify-between'><div><p className='text-xs font-bold uppercase text-white/70'>Total</p><p className='text-3xl font-black'>{data?.total_all ?? data?.total ?? 0}</p></div><Users className='h-6 w-6 text-white/80' /></div>
          </div>
          <div className='rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-sm'>
            <div className='flex items-center justify-between'><div><p className='text-xs font-bold uppercase text-white/70'>Online</p><p className='text-3xl font-black'>{data?.active ?? '-'}</p></div><Wifi className='h-6 w-6 text-white/80' /></div>
          </div>
          <div className='rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 p-4 text-white shadow-sm'>
            <div className='flex items-center justify-between'><div><p className='text-xs font-bold uppercase text-white/70'>Offline</p><p className='text-3xl font-black'>{data?.total_all !== undefined && data?.active !== undefined ? Math.max(0, data.total_all - data.active) : '-'}</p></div><WifiOff className='h-6 w-6 text-white/80' /></div>
          </div>
          <div className='rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white shadow-sm'>
            <div className='flex items-center justify-between'><div><p className='text-xs font-bold uppercase text-white/70'>Data Lengkap</p><p className='text-3xl font-black'>{data?.total_complete ?? 0}</p></div><CheckCircle2 className='h-6 w-6 text-white/80' /></div>
          </div>
        </div>
        {isBatchEditView ? (
            <BatchEditCustomers 
                selectedCustomers={selectedCustomers.length > 0 ? selectedCustomers : (data?.data || [])}
                profiles={profiles}
                odps={data?.odps || []}
                total={data?.total || 0}
                totalComplete={data?.total_complete || 0}
                page={page}
                onPageChange={setPage}
                isLoading={isLoading}
                onClose={() => {
                    setIsBatchEditView(false)
                    setSelectedCustomers([])
                }}
            />
        ) : (
            <div className='space-y-4 rounded-xl border bg-card p-4 shadow-sm'>
                <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 p-3'>
                    <div className='relative flex-1 max-w-md'>
                        <SearchIcon className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                            placeholder='Cari username, alamat, atau WA...'
                            className='pl-9 h-9 text-xs'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className='flex items-center gap-2'>
                        {permissions.canManageCustomers && (
                          <Button
                              variant='outline'
                              size='sm'
                              className='h-9 text-xs font-bold border-primary/20 hover:bg-primary/5'
                              onClick={() => setIsBatchEditView(true)}
                              disabled={!activeRouter || isLoading}
                          >
                              <LayoutGrid className='mr-2 h-4 w-4 text-primary' />
                              Penataan Data (Batch Edit)
                          </Button>
                        )}
                        {permissions.canManageCustomers && (
                          <Button
                              variant='outline'
                              size='sm'
                              className='h-9 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50'
                              onClick={() => mapsConvertMutation.mutate()}
                              disabled={!activeRouter || mapsConvertMutation.isPending}
                          >
                              <MapPin className='mr-2 h-4 w-4' />
                              {mapsConvertMutation.isPending ? 'Convert Maps...' : 'Convert Maps'}
                          </Button>
                        )}
                        <Button
                            variant='outline'
                            size='sm'
                            className='h-9 text-xs font-bold'
                            onClick={() => syncMutation.mutate()}
                            disabled={syncMutation.isPending || !activeRouter}
                        >
                            <RefreshCw className={cn('mr-2 h-4 w-4', syncMutation.isPending && 'animate-spin')} />
                            Sync dari MikroTik
                        </Button>
                        {permissions.canManageCustomers && (
                          <Button
                              size='sm'
                              className='h-9 text-xs font-bold'
                              onClick={() => setIsAddDialogOpen(true)}
                              disabled={!activeRouter}
                          >
                              <UserPlus className='mr-2 h-4 w-4' />
                              Tambah Pelanggan
                          </Button>
                        )}
                    </div>
                </div>

                <div className='flex-1 overflow-auto'>
                <CustomersTable
                    data={data?.data || []}
                    total={data?.total || 0}
                    page={page}
                    perPage={perPage}
                    _onPageChange={setPage}
                    isLoading={isLoading}
                    profiles={profiles}
                    odps={data?.odps || []}
                    onBatchEdit={(customers) => {
                        setSelectedCustomers(customers)
                        setIsBatchEditView(true)
                    }}
                />
                </div>
            </div>
        )}
      </Main>

      <CustomerMutateDialog 
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        profiles={profiles}
        odps={data?.odps || []}
      />
    </>
  )
}
