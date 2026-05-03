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
    refetchInterval: 30000, // Refresh every 30s
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

      <Main className='space-y-6' fluid>
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
        {/* KPI Cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 border-0 text-white overflow-hidden relative group shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
             <Server className="w-16 h-16" />
          </div>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-xs font-black uppercase tracking-widest opacity-70'>Total CPE Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-5xl font-black tabular-nums'>{devices?.length || 0}</div>
            <p className='text-[10px] bg-white/20 inline-block px-2 py-0.5 rounded-full font-bold mt-2 uppercase tracking-tighter'>ACS Management System</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 text-white overflow-hidden relative group shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
             <Wifi className="w-16 h-16" />
          </div>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-xs font-black uppercase tracking-widest opacity-70'>Online CPE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-5xl font-black tabular-nums'>{onlineCount}</div>
            <p className='text-[10px] bg-white/20 inline-block px-2 py-0.5 rounded-full font-bold mt-2 uppercase tracking-tighter'>ACS Management System</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-rose-600 border-0 text-white overflow-hidden relative group shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
             <AlertTriangle className="w-16 h-16" />
          </div>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-xs font-black uppercase tracking-widest opacity-70'>Offline CPE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-5xl font-black tabular-nums'>{(devices?.length || 0) - onlineCount}</div>
            <p className='text-[10px] bg-white/20 inline-block px-2 py-0.5 rounded-full font-bold mt-2 uppercase tracking-tighter'>ACS Management System</p>
          </CardContent>
        </Card>
      </div>

        {isError && (
          <div className='p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3'>
            <AlertTriangle className='h-5 w-5' />
            <p className='text-sm font-bold'>Gagal terhubung ke server GenieACS. Pastikan proxy dan konfigurasi URL sudah benar.</p>
          </div>
        )}

        <Card className='border-none shadow-xl bg-card/50 backdrop-blur-xl'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-xl flex items-center gap-2'>
                  <Server className='w-5 h-5 text-teal-500' />
                  CPE Inventory List
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Mengelola semua modem/router pelanggan via TR-069.</p>
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
