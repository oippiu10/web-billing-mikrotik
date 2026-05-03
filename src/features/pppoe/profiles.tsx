import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'
import { PPPoESubNav } from './components/pppoe-sub-nav'
import { PPPoEProfilesTable } from './components/profiles-table'
import { usePPPoEData } from './hooks/use-pppoe-data'

export function PPPoEProfilesPage() {
  const { pppProfiles, isProfilesLoading } = usePPPoEData()

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg'>
            <Shield className='h-5 w-5 text-purple-600' />
          </div>
          <h1 className='text-lg font-bold'>PPPoE — Profiles</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <PPPoESubNav active='/pppoe/profiles' />

        <Card className='border-t-4 border-t-purple-500 shadow-lg border-x-0 border-b-0 rounded-none md:rounded-xl md:border'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-xl flex items-center gap-2'>
                  <Shield className='w-5 h-5 text-purple-500' />
                  PPPoE Profiles
                </CardTitle>
                <CardDescription>Daftar profil paket PPPoE yang tersedia di router.</CardDescription>
              </div>
              <Badge variant='outline' className='text-sm px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'>
                {isProfilesLoading ? '...' : `${pppProfiles.length} Profile`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PPPoEProfilesTable data={pppProfiles} isLoading={isProfilesLoading} />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
