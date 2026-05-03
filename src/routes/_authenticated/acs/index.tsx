import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, Bot, Router, Server, Settings, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/acs/')({ component: AcsCenter })

const getParam = (obj: any, path: string) => path.split('.').reduce((acc, key) => acc?.[key], obj)?._value || path.split('.').reduce((acc, key) => acc?.[key], obj) || ''
const isOnline = (lastInform?: string) => lastInform ? new Date(lastInform).getTime() > Date.now() - 5 * 60 * 1000 : false

function AcsCenter() {
  const projection = ['_id','_lastInform','Device.DeviceInfo.SerialNumber','Device.DeviceInfo.ProductClass','Device.DeviceInfo.Manufacturer','InternetGatewayDevice.DeviceInfo.SerialNumber','InternetGatewayDevice.DeviceInfo.ModelName','InternetGatewayDevice.DeviceInfo.Manufacturer','VirtualParameters.RXPower','VirtualParameters.pppoeUsername','VirtualParameters.WiFi SSID'].join(',')
  const { data: acsState, isLoading } = useQuery({
    queryKey: ['acs-center-devices'],
    queryFn: async () => {
      try {
        const res = await api.get(`/genieacs_proxy.php?path=/devices&projection=${encodeURIComponent(projection)}`)
        return { devices: Array.isArray(res.data) ? res.data : [], error: '' }
      } catch (err: any) {
        return { devices: [], error: err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Tidak bisa menghubungi GenieACS' }
      }
    },
    retry: false,
    refetchInterval: 30000,
  })
  const list = Array.isArray(acsState?.devices) ? acsState.devices : []
  const acsError = acsState?.error || ''
  const online = list.filter((d: any) => isOnline(d._lastInform)).length
  const offline = Math.max(0, list.length - online)

  return (
    <>
      <Header fixed><div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><Bot className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>ACS / TR-069 Center</h1></div><RouterSelector /><ThemeSwitch /><ProfileDropdown /></Header>
      <Main className='space-y-4' fluid>
        <div className='flex flex-col justify-between gap-3 md:flex-row md:items-center'>
          <div><h2 className='text-2xl font-bold tracking-tight'>ACS / TR-069 Center</h2><p className='text-muted-foreground'>Dashboard ringkas CPE/ONT dari GenieACS, status online, dan shortcut remote management.</p></div>
          <div className='flex gap-2'><Button asChild><Link to='/genieacs'>Buka Device Manager</Link></Button><Button asChild variant='outline'><Link to='/genieacs/settings'><Settings className='mr-2 h-4 w-4' /> Settings</Link></Button></div>
        </div>

        {acsError && <Card className='border-red-200 bg-red-50 dark:bg-red-950/20'><CardContent className='py-4 text-sm text-red-600'>Gagal konek ke GenieACS. Cek URL, username, password di GenieACS Settings. <span className='text-xs opacity-80'>{acsError}</span></CardContent></Card>}

        <div className='grid gap-3 md:grid-cols-4'>
          <Card><CardContent className='flex items-center gap-3 py-4'><Server className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Total CPE</p><p className='text-2xl font-black'>{list.length}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Wifi className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Online</p><p className='text-2xl font-black'>{online}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><WifiOff className='h-8 w-8 text-red-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Offline</p><p className='text-2xl font-black'>{offline}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Activity className='h-8 w-8 text-purple-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Refresh</p><p className='text-2xl font-black'>30s</p></div></CardContent></Card>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          <Card><CardContent className='space-y-2 py-4'><Router className='h-6 w-6 text-primary' /><p className='font-bold'>Remote CPE Management</p><p className='text-sm text-muted-foreground'>Gunakan GenieACS device manager untuk reboot, parameter, dan task.</p><Button asChild size='sm' variant='outline'><Link to='/genieacs'>Kelola CPE</Link></Button></CardContent></Card>
          <Card><CardContent className='space-y-2 py-4'><Wifi className='h-6 w-6 text-primary' /><p className='font-bold'>WiFi & PPPoE Provisioning</p><p className='text-sm text-muted-foreground'>Siapkan preset provisioning SSID, password, mode bridge/router.</p><Badge variant='secondary'>Roadmap next</Badge></CardContent></Card>
          <Card><CardContent className='space-y-2 py-4'><Settings className='h-6 w-6 text-primary' /><p className='font-bold'>ACS Configuration</p><p className='text-sm text-muted-foreground'>Atur endpoint GenieACS dan credential proxy.</p><Button asChild size='sm' variant='outline'><Link to='/genieacs/settings'>Settings</Link></Button></CardContent></Card>
        </div>

        <Card className='overflow-hidden'>
          <div className='border-b p-4'><p className='font-bold'>Recent CPE Devices</p><p className='text-sm text-muted-foreground'>Ringkasan 20 device terbaru dari GenieACS.</p></div>
          <Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Serial / ID</TableHead><TableHead>Model</TableHead><TableHead>PPPoE</TableHead><TableHead>RX Power</TableHead><TableHead>Last Inform</TableHead></TableRow></TableHeader><TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>Memuat perangkat...</TableCell></TableRow> : list.slice(0, 20).map((d: any) => {
              const serial = getParam(d, 'Device.DeviceInfo.SerialNumber') || getParam(d, 'InternetGatewayDevice.DeviceInfo.SerialNumber') || d._id
              const model = getParam(d, 'Device.DeviceInfo.ProductClass') || getParam(d, 'InternetGatewayDevice.DeviceInfo.ModelName') || '-'
              return <TableRow key={d._id}><TableCell><Badge variant={isOnline(d._lastInform) ? 'default' : 'destructive'}>{isOnline(d._lastInform) ? 'Online' : 'Offline'}</Badge></TableCell><TableCell className='font-mono text-xs'>{serial}</TableCell><TableCell>{model}</TableCell><TableCell>{getParam(d, 'VirtualParameters.pppoeUsername') || '-'}</TableCell><TableCell>{getParam(d, 'VirtualParameters.RXPower') || '-'}</TableCell><TableCell className='text-xs text-muted-foreground'>{d._lastInform ? new Date(d._lastInform).toLocaleString('id-ID') : '-'}</TableCell></TableRow>
            })}
          </TableBody></Table>
        </Card>
      </Main>
    </>
  )
}
