import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Network, Wifi, WifiOff, KeyRound, Shield, TrendingUp, Activity } from 'lucide-react'
import { PPPoESubNav } from './components/pppoe-sub-nav'
import { usePPPoEData } from './hooks/use-pppoe-data'
import { Link } from '@tanstack/react-router'

export function PPPoEOverview() {
  const {
    pppActive, pppSecrets, pppProfiles,
    offlineUsers, isActiveLoading, isSecretsLoading,
  } = usePPPoEData()

  const totalSecrets  = pppSecrets.length
  const activeCount   = pppActive.length
  const offlineCount  = offlineUsers.length
  const onlineRate    = totalSecrets > 0 ? Math.round((activeCount / totalSecrets) * 100) : 0

  const stats = [
    {
      label: 'Active Now',
      value: activeCount,
      icon: Wifi,
      color: 'from-green-500 to-emerald-600',
      url: '/pppoe/active',
      badge: 'Online',
      loading: isActiveLoading,
    },
    {
      label: 'Offline Users',
      value: offlineCount,
      icon: WifiOff,
      color: 'from-red-500 to-rose-600',
      url: '/pppoe/offline',
      badge: 'Offline',
      loading: isSecretsLoading || isActiveLoading,
    },
    {
      label: 'Total Secrets',
      value: totalSecrets,
      icon: KeyRound,
      color: 'from-blue-500 to-blue-600',
      url: '/pppoe/secrets',
      badge: 'Users',
      loading: isSecretsLoading,
    },
    {
      label: 'Profiles',
      value: pppProfiles.length,
      icon: Shield,
      color: 'from-purple-500 to-violet-600',
      url: '/pppoe/profiles',
      badge: 'Paket',
      loading: false,
    },
  ]

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <Network className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>PPPoE Management</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <PPPoESubNav active='/pppoe' />

        {/* KPI Cards */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {stats.map(({ label, value, icon: Icon, color, url, badge, loading }) => (
            <Link to={url} key={url}>
              <Card className={`relative overflow-hidden border-none shadow-lg bg-gradient-to-br ${color} text-white cursor-pointer hover:scale-[1.02] transition-transform`}>
                <div className='absolute top-0 right-0 p-3 opacity-10'>
                  <Icon className='h-16 w-16' />
                </div>
                <CardHeader className='pb-1'>
                  <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-5xl font-black mb-2'>
                    {loading ? <span className='animate-pulse'>...</span> : value}
                  </div>
                  <Badge className='bg-white/20 text-white border-0 text-[10px] font-black hover:bg-white/30'>
                    {badge}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Online Rate */}
        <Card className='border-none shadow-lg'>
          <CardContent className='pt-5'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <Activity className='h-5 w-5 text-primary' />
                <div>
                  <p className='text-xs font-black uppercase tracking-widest text-muted-foreground'>Tingkat Online</p>
                  <p className='text-3xl font-black text-primary'>{onlineRate}%</p>
                </div>
              </div>
              <div className='text-right text-sm text-muted-foreground'>
                <p className='font-bold'>{activeCount} online &bull; {offlineCount} offline</p>
                <p>Total {totalSecrets} user terdaftar</p>
              </div>
            </div>
            <div className='h-3 rounded-full bg-muted overflow-hidden'>
              <div
                className='h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700'
                style={{ width: `${onlineRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Profile Distribution */}
        {pppProfiles.length > 0 && (
          <Card className='border-none shadow-lg'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-black uppercase tracking-widest flex items-center gap-2'>
                <TrendingUp className='h-4 w-4 text-primary' /> Distribusi Per Profil
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {pppProfiles.slice(0, 6).map((profile: any) => {
                const profileName = profile.name
                const activeInProfile = pppActive.filter((a: any) => {
                  const secret = pppSecrets.find((s: any) => s.name === a.name)
                  return secret?.profile === profileName
                }).length
                const totalInProfile = pppSecrets.filter((s: any) => s.profile === profileName).length
                const pct = totalInProfile > 0 ? Math.round((activeInProfile / totalInProfile) * 100) : 0

                return (
                  <div key={profileName}>
                    <div className='flex justify-between mb-1'>
                      <span className='text-sm font-bold'>{profileName}</span>
                      <span className='text-xs text-muted-foreground font-semibold'>
                        {activeInProfile}/{totalInProfile} online ({pct}%)
                      </span>
                    </div>
                    <div className='h-2 rounded-full bg-muted overflow-hidden'>
                      <div
                        className='h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500'
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
          {[
            { label: 'Lihat Active', url: '/pppoe/active', icon: Wifi, color: 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100' },
            { label: 'Lihat Offline', url: '/pppoe/offline', icon: WifiOff, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100' },
            { label: 'Kelola Secrets', url: '/pppoe/secrets', icon: KeyRound, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100' },
            { label: 'Kelola Profiles', url: '/pppoe/profiles', icon: Shield, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100' },
          ].map(({ label, url, icon: Icon, color }) => (
            <Link to={url} key={url}>
              <Card className={`border-none shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${color}`}>
                <CardContent className='py-4 flex items-center gap-3'>
                  <Icon className='h-5 w-5' />
                  <span className='text-sm font-black'>{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Main>
    </>
  )
}
