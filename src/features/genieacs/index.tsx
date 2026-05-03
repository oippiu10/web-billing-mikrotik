import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Server, Wifi, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { GenieACSDeviceTable } from './components/device-table'

export function GenieACSPage() {
  const { data: devices, isLoading, isError, error } = useQuery({
    queryKey: ['genieacs-devices'],
    queryFn: async () => {
      // Query parameters for device summary
      const projection = [
        '_id',
        '_lastInform',
        'Device.DeviceInfo.SerialNumber',
        'Device.DeviceInfo.ProductClass',
        'Device.DeviceInfo.Manufacturer',
        'InternetGatewayDevice.DeviceInfo.SerialNumber',
        'InternetGatewayDevice.DeviceInfo.ModelName',
        'InternetGatewayDevice.DeviceInfo.Manufacturer',
        'Device.ManagementServer.ConnectionRequestURL',
        'InternetGatewayDevice.ManagementServer.ConnectionRequestURL',
        'VirtualParameters.RXPower',
        'VirtualParameters.gettemp',
        'VirtualParameters.activedevices',
        'VirtualParameters.pppoeUsername',
        'VirtualParameters.WiFi SSID'
      ].join(',')
      
      const res = await api.get(`/genieacs_proxy.php?path=/devices&projection=${projection}`)
      return res.data || []
    },
    refetchInterval: false,
    staleTime: 60_000,
  })

  const onlineCount = (devices?.filter((d: any) => {
    if (!d._lastInform) return false
    const lastInform = new Date(d._lastInform).getTime()
    const fiveMinutesAgo = new Date().getTime() - (5 * 60 * 1000)
    return lastInform > fiveMinutesAgo
  })?.length) || 0



  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <h1 className='text-lg font-bold'>GenieACS — Device Management</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-4' fluid>
        <div className='relative overflow-hidden rounded-xl border-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-sm'>
          <div className='absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10' />
          <div className='absolute bottom-0 right-24 h-20 w-20 rounded-full bg-white/10' />
          <div className='relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-xl font-bold tracking-tight'>ACS Device Center</h2>
              <p className='text-sm text-white/80'>Monitoring CPE, summon offline, dan inventaris TR-069/GenieACS.</p>
            </div>
            <div className='rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white'>Mode ringan • refresh manual</div>
          </div>
        </div>
        {isError && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>API Error</AlertTitle>
                <AlertDescription>
                    Gagal terhubung ke GenieACS. Pastikan kredensial di Settings sudah benar. 
                    {(error as any)?.response?.data?.error || (error as any)?.message}
                </AlertDescription>
            </Alert>
        )}
        {/* Lightweight KPI Cards */}
      <div className='grid gap-3 md:grid-cols-3'>
        <Card className='overflow-hidden border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm'>
          <CardContent className='relative flex items-center justify-between p-4'>
            <div className='absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10' />
            <div><p className='text-xs font-bold uppercase tracking-wide text-white/70'>Total CPE</p><div className='text-3xl font-black tabular-nums'>{devices?.length || 0}</div></div>
            <div className='rounded-lg bg-white/15 p-2'><Server className='h-5 w-5 text-white' /></div>
          </CardContent>
        </Card>
        <Card className='overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm'>
          <CardContent className='relative flex items-center justify-between p-4'>
            <div className='absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10' />
            <div><p className='text-xs font-bold uppercase tracking-wide text-white/70'>Online</p><div className='text-3xl font-black tabular-nums'>{onlineCount}</div></div>
            <div className='rounded-lg bg-white/15 p-2'><Wifi className='h-5 w-5 text-white' /></div>
          </CardContent>
        </Card>
        <Card className='overflow-hidden border-0 bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-sm'>
          <CardContent className='relative flex items-center justify-between p-4'>
            <div className='absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10' />
            <div><p className='text-xs font-bold uppercase tracking-wide text-white/70'>Offline</p><div className='text-3xl font-black tabular-nums'>{(devices?.length || 0) - onlineCount}</div></div>
            <div className='rounded-lg bg-white/15 p-2'><AlertTriangle className='h-5 w-5 text-white' /></div>
          </CardContent>
        </Card>
      </div>

        {isError && (
          <div className='p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3'>
            <AlertTriangle className='h-5 w-5' />
            <p className='text-sm font-bold'>Gagal terhubung ke server GenieACS. Pastikan proxy dan konfigurasi URL sudah benar.</p>
          </div>
        )}

        <Card>
          <CardHeader className='border-b pb-4'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2 text-lg'>
                  <span className='rounded-md bg-teal-500/10 p-1.5'><Server className='h-4 w-4 text-teal-600' /></span>
                  CPE Inventory List
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Cari modem, filter status, summon offline, dan buka detail parameter ACS.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <GenieACSDeviceTable data={devices || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
