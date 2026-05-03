import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WifiOff } from 'lucide-react'
import { PPPoESubNav } from './components/pppoe-sub-nav'
import { PPPoEOfflineTable } from './components/offline-table'
import { usePPPoEData } from './hooks/use-pppoe-data'

export function PPPoEOfflinePage() {
  const { offlineUsers, pppProfiles, isSecretsLoading, isActiveLoading } = usePPPoEData()

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-red-100 dark:bg-red-900/30 rounded-lg'>
            <WifiOff className='h-5 w-5 text-red-500' />
          </div>
          <h1 className='text-lg font-bold'>PPPoE — Offline Users</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <PPPoESubNav active='/pppoe/offline' />

        <Card className='border-t-4 border-t-destructive shadow-lg border-x-0 border-b-0 rounded-none md:rounded-xl md:border'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-xl flex items-center gap-2'>
                  <WifiOff className='w-5 h-5 text-destructive' />
                  Offline PPPoE Users
                </CardTitle>
                <CardDescription>Daftar user yang saat ini sedang tidak terhubung (offline).</CardDescription>
              </div>
              <Badge variant='destructive' className='text-sm px-3 py-1 bg-destructive/20 text-destructive hover:bg-destructive/30 border-0'>
                {(isSecretsLoading || isActiveLoading) ? '...' : `${offlineUsers.length} Offline`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PPPoEOfflineTable
              data={offlineUsers}
              isLoading={isSecretsLoading || isActiveLoading}
              profiles={pppProfiles.map((p: any) => p.name)}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
