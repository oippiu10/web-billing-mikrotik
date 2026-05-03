import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RouterSelector } from '@/components/router-selector'
import { Button } from '@/components/ui/button'
import { Link2, Plus, Network } from 'lucide-react'
import { toast } from 'sonner'
import { ODPTable } from './components/odp-table'
import { ODPMutateDialog } from './components/odp-mutate-drawer'
import { ODPSubNav } from './components/odp-sub-nav'
import { usePermission } from '@/lib/permissions'

export default function ODPPage() {
  const { activeRouter } = useRouterStore()
  const permissions = usePermission()
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isConvertingMaps, setIsConvertingMaps] = useState(false)

  const { data, isLoading } = useQuery({
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

  const convertOdpMaps = async () => {
    if (!activeRouter) return
    setIsConvertingMaps(true)
    try {
      const res = await api.post('/odp_maps_bulk_convert.php', {
        router_id: activeRouter.software_id || activeRouter.id,
        limit: 25,
      })
      if (res.data?.success) {
        toast.success(`ODP Maps: ${res.data.updated} berhasil, ${res.data.failed} gagal. Sisa ${res.data.remaining}.`)
        queryClient.invalidateQueries({ queryKey: ['odps'] })
      } else {
        toast.error(res.data?.message || 'Gagal konversi maps ODP')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal konversi maps ODP')
    } finally {
      setIsConvertingMaps(false)
    }
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
            <div className="p-2 bg-primary/10 rounded-lg">
                <Network className="h-5 w-5 text-primary" />
            </div>
            <h1 className='text-lg font-bold'>Manajemen ODP</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-col gap-4' fluid>
        <ODPSubNav active='/odp' />
        <div className='flex items-center justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Daftar ODP</h2>
            <p className='text-muted-foreground'>
                Kelola titik distribusi kabel optik dan kapasitasnya.
            </p>
          </div>
          {permissions.canManageCustomers && (
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline' onClick={convertOdpMaps} disabled={!activeRouter || isConvertingMaps}>
                <Link2 className='mr-2 h-4 w-4' /> {isConvertingMaps ? 'Convert...' : 'Convert Maps'}
              </Button>
              <Button size='sm' onClick={() => setIsAddDialogOpen(true)} disabled={!activeRouter}>
                <Plus className='mr-2 h-4 w-4' /> Tambah ODP
              </Button>
            </div>
          )}
        </div>

        <div className='flex-1 overflow-auto'>
          <ODPTable
            data={data || []}
            isLoading={isLoading}
          />
        </div>
      </Main>

      <ODPMutateDialog 
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />
    </>
  )
}
