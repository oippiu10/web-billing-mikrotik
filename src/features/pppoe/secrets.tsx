import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KeyRound } from 'lucide-react'
import { PPPoESubNav } from './components/pppoe-sub-nav'
import { PPPoESecretsTable } from './components/secrets-table'
import { usePPPoEData } from './hooks/use-pppoe-data'

export function PPPoESecretsPage() {
  const { pppSecrets, pppProfiles, activeNames, isSecretsLoading } = usePPPoEData()

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg'>
            <KeyRound className='h-5 w-5 text-blue-600' />
          </div>
          <h1 className='text-lg font-bold'>PPPoE — Secrets</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <PPPoESubNav active='/pppoe/secrets' />

        <Card className='border-t-4 border-t-blue-500 shadow-lg border-x-0 border-b-0 rounded-none md:rounded-xl md:border'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-xl flex items-center gap-2'>
                  <KeyRound className='w-5 h-5 text-blue-500' />
                  PPPoE Secrets — All Users
                </CardTitle>
                <CardDescription>Semua akun pengguna yang terdaftar di router MikroTik.</CardDescription>
              </div>
              <Badge variant='outline' className='text-sm px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'>
                {isSecretsLoading ? '...' : `${pppSecrets.length} Secrets`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PPPoESecretsTable
              data={pppSecrets}
              isLoading={isSecretsLoading}
              activeNames={activeNames}
              profiles={pppProfiles.map((p: any) => p.name)}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
