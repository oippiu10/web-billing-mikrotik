import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Network, Wifi, WifiOff, Shield, KeyRound } from 'lucide-react'
import { PPPoEActiveTable } from './components/active-table'
import { PPPoEOfflineTable } from './components/offline-table'
import { PPPoESecretsTable } from './components/secrets-table'
import { PPPoEProfilesTable } from './components/profiles-table'
import { useMemo } from 'react'

interface PPPActiveConnection {
  '.id': string
  name: string
  service: string
  'caller-id': string
  address: string
  uptime: string
  'bytes-in': string | number
  'bytes-out': string | number
}

interface PPPSecret {
  '.id': string
  name: string
  service: string
  profile: string
  password?: string
  'last-caller-id'?: string
  'last-logged-out'?: string
  disabled?: string
}

interface PPPProfile {
  '.id': string
  name: string
  'local-address'?: string
  'remote-address'?: string
  'rate-limit'?: string
  default?: string
}

export function PPPoE() {
  const { activeRouter } = useRouterStore()

  // Fetch Active PPP Connections
  const { data: pppActive, isLoading: isPppLoading } = useQuery<PPPActiveConnection[]>({
    queryKey: ['ppp-active', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_active' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 1000,
  })

  // Fetch PPP Secrets
  const { data: pppSecrets, isLoading: isSecretsLoading } = useQuery<PPPSecret[]>({
    queryKey: ['ppp-secret', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_secret' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 1000,
  })

  // Fetch PPP Profiles
  const { data: pppProfiles, isLoading: isProfilesLoading } = useQuery<PPPProfile[]>({
    queryKey: ['ppp-profile', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_profile' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 300000,
  })

  // Calculate Derived Data
  const activeNames = useMemo(() => {
    return new Set(pppActive?.map(a => a.name) || [])
  }, [pppActive])

  const offlineUsers = useMemo(() => {
    return pppSecrets?.filter(secret => !activeNames.has(secret.name)) || []
  }, [pppSecrets, activeNames])

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
            <div className="p-2 bg-primary/10 rounded-lg">
                <Network className="h-5 w-5 text-primary" />
            </div>
            <h1 className='text-lg font-bold'>PPPoE Management</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid>
        <Tabs defaultValue='secrets' className='space-y-6'>
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-muted/50 p-1">
            <TabsTrigger value='secrets' className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
              <KeyRound className="w-4 h-4 mr-2" />
              Secrets
            </TabsTrigger>
            <TabsTrigger value='active' className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400">
              <Wifi className="w-4 h-4 mr-2" />
              Active
            </TabsTrigger>
            <TabsTrigger value='offline' className="data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive">
              <WifiOff className="w-4 h-4 mr-2" />
              Offline
            </TabsTrigger>
            <TabsTrigger value='profiles' className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400">
              <Shield className="w-4 h-4 mr-2" />
              Profiles
            </TabsTrigger>
          </TabsList>

          {/* Active Sessions Tab */}
          <TabsContent value='active' className='space-y-4'>
            <Card className="border-t-4 border-t-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-green-500" />
                      Active PPPoE Connections
                    </CardTitle>
                    <CardDescription>Daftar user yang sedang terhubung ke router.</CardDescription>
                  </div>
                  <Badge variant="default" className="text-sm px-3 py-1 bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 border-0">
                    Total: {pppActive?.length || 0} User
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
              <PPPoEActiveTable
                data={pppActive || []}
                isLoading={isPppLoading}
                profiles={pppProfiles?.map(p => p.name) || ['default']}
              />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Offline Users Tab */}
          <TabsContent value='offline' className='space-y-4'>
            <Card className="border-t-4 border-t-destructive shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <WifiOff className="w-5 h-5 text-destructive" />
                      Offline PPPoE Users
                    </CardTitle>
                    <CardDescription>Daftar user yang saat ini sedang tidak terhubung (offline).</CardDescription>
                  </div>
                  <Badge variant="destructive" className="text-sm px-3 py-1 bg-destructive/20 text-destructive hover:bg-destructive/30 border-0">
                    Total: {offlineUsers.length} Offline
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PPPoEOfflineTable 
                  data={offlineUsers} 
                  isLoading={isSecretsLoading || isPppLoading} 
                  profiles={pppProfiles?.map(p => p.name) || []}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Secrets Tab */}
          <TabsContent value='secrets' className='space-y-4'>
            <Card className="border-t-4 border-t-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-blue-500" />
                      PPPoE Secrets (All Users)
                    </CardTitle>
                    <CardDescription>Semua akun pengguna yang terdaftar di router.</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                    Total: {pppSecrets?.length || 0} Secrets
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PPPoESecretsTable 
                  data={pppSecrets || []} 
                  isLoading={isSecretsLoading} 
                  activeNames={activeNames} 
                  profiles={pppProfiles?.map(p => p.name) || ['default']}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profiles Tab */}
          <TabsContent value='profiles' className='space-y-4'>
            <Card className="border-t-4 border-t-purple-500 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Shield className="w-5 h-5 text-purple-500" />
                      PPPoE Profiles
                    </CardTitle>
                    <CardDescription>Daftar profil paket PPPoE yang tersedia.</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                    Total: {pppProfiles?.length || 0} Profile
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PPPoEProfilesTable data={pppProfiles || []} isLoading={isProfilesLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
