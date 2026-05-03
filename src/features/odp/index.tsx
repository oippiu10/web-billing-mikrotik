import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RouterSelector } from '@/components/router-selector'
import { Button } from '@/components/ui/button'
import { Plus, Network } from 'lucide-react'
import { ODPTable } from './components/odp-table'
import { ODPMutateDialog } from './components/odp-mutate-drawer'
import { ODPSubNav } from './components/odp-sub-nav'
import { usePermission } from '@/lib/permissions'

export default function ODPPage() {
  const { activeRouter } = useRouterStore()
  const permissions = usePermission()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

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
            <Button size='sm' onClick={() => setIsAddDialogOpen(true)} disabled={!activeRouter}>
              <Plus className='mr-2 h-4 w-4' /> Tambah ODP
            </Button>
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
