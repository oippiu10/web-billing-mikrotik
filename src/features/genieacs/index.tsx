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
        <Card>
          <CardContent className='flex items-center justify-between p-4'>
            <div><p className='text-xs text-muted-foreground'>Total CPE</p><div className='text-2xl font-bold'>{devices?.length || 0}</div></div>
            <Server className='h-5 w-5 text-primary' />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center justify-between p-4'>
            <div><p className='text-xs text-muted-foreground'>Online</p><div className='text-2xl font-bold text-emerald-600'>{onlineCount}</div></div>
            <Wifi className='h-5 w-5 text-emerald-600' />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex items-center justify-between p-4'>
            <div><p className='text-xs text-muted-foreground'>Offline</p><div className='text-2xl font-bold text-red-600'>{(devices?.length || 0) - onlineCount}</div></div>
            <AlertTriangle className='h-5 w-5 text-red-600' />
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
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-xl flex items-center gap-2'>
                  <Server className='w-5 h-5 text-teal-500' />
                  CPE Inventory List
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Mode ringan: refresh manual agar halaman tidak berat.</p>
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
