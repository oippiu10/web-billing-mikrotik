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
import { UserPlus, SearchIcon, RefreshCw, LayoutGrid, WifiOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { CustomerMutateDialog } from './components/customer-mutate-drawer'
import { BatchEditCustomers } from './components/batch-edit-customers'
import { CustomersSubNav } from './components/customers-sub-nav'
import { type Customer } from './data/schema'
import { usePermission } from '@/lib/permissions'

export default function CustomersOffline() {
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
    queryKey: ['customers-offline', activeRouter?.id, page, search, perPage],
    queryFn: async () => {
      if (!activeRouter) return null
      const res = await api.get('/get_all_users_paginated.php', {
        params: {
          router_id: activeRouter.id,
          page,
          per_page: perPage,
          search,
          status: 'offline',
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
            queryClient.invalidateQueries({ queryKey: ['customers-offline'] })
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
            <div className='p-2 bg-destructive/10 rounded-lg'>
                <WifiOff className='h-5 w-5 text-destructive' />
            </div>
            <h1 className='text-lg font-bold text-destructive'>Pelanggan Sedang Offline</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-col gap-4' fluid>
        <CustomersSubNav active='/customers/offline' />
        <div className='relative overflow-hidden rounded-xl border-0 bg-gradient-to-r from-orange-500 via-rose-600 to-red-600 p-5 text-white shadow-sm'>
          <div className='absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10' />
          <div className='relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-xl font-bold tracking-tight'>Pelanggan Offline</h2>
              <p className='text-sm text-white/80'>Daftar pelanggan tidak aktif untuk follow-up, pengecekan ODP, dan penagihan.</p>
            </div>
            <div className='rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold'>Offline terfilter • sync manual</div>
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
            <div className='space-y-4 rounded-xl border border-destructive/10 bg-card p-4 shadow-sm'>
                <div className='grid gap-3 md:grid-cols-3'>
                    <div className='rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 p-4 text-white'>
                        <div className='flex items-center justify-between'><div><p className='text-xs font-bold uppercase text-white/70'>Offline</p><p className='text-3xl font-black'>{data?.total ?? 0}</p></div><WifiOff className='h-6 w-6 text-white/80' /></div>
                    </div>
                    <div className='rounded-xl border bg-muted/30 p-4'>
                        <p className='text-xs font-bold uppercase text-muted-foreground'>Halaman</p><p className='text-2xl font-black'>{page}</p>
                    </div>
                    <div className='rounded-xl border bg-amber-500/10 p-4'>
                        <div className='flex items-center gap-2 text-amber-700 dark:text-amber-400'><AlertTriangle className='h-5 w-5' /><p className='text-xs font-bold uppercase'>Prioritas Follow-up</p></div>
                        <p className='mt-1 text-xs text-muted-foreground'>Cek modem, ODP, payment, atau isolir.</p>
                    </div>
                </div>
                <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 p-3'>
                    <div className='flex flex-1 items-center gap-2 max-w-md'>
                        <div className='relative flex-1'>
                            <SearchIcon className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                            <Input
                                placeholder='Cari pelanggan offline...'
                                className='pl-9 h-9 text-xs border-destructive/20'
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
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
                            Batch Edit
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
                            Sync
                        </Button>
                        {permissions.canManageCustomers && (
                        <Button
                            size='sm'
                            variant='destructive'
                            className='h-9 text-xs font-bold'
                            onClick={() => setIsAddDialogOpen(true)}
                            disabled={!activeRouter}
                        >
                            <UserPlus className='mr-2 h-4 w-4' />
                            Tambah
                        </Button>
                        )}
                    </div>
                </div>

                <div className='flex-1 overflow-auto border rounded-lg border-destructive/10'>
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
