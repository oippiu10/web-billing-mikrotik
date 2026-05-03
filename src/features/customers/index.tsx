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
import { UserPlus, SearchIcon, RefreshCw, LayoutGrid } from 'lucide-react'
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
      await api.get('/sync_ppp_to_db.php', {
        params: { router_id: activeRouter.id },
      })
      queryClient.invalidateQueries({ queryKey: ['ppp-active', activeRouter.id] })
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
            <div className='space-y-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
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
