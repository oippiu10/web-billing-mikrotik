import { useState, useEffect } from 'react'
import { 
  Wifi, 
  Cpu, 
  Zap, 
  Activity,
  Loader2,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Globe,
  Thermometer,
  ShieldCheck,
  Info,
  Settings2,
  Monitor
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
} from '@/components/ui/dialog'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface DeviceDetailDialogProps {
  deviceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeviceDetailDialog({ deviceId, open, onOpenChange }: DeviceDetailDialogProps) {
  const { data: device, isLoading } = useQuery({
    queryKey: ['genieacs-device-detail', deviceId],
    queryFn: async () => {
      if (!deviceId) return null
      const query = JSON.stringify({ _id: deviceId })
      const res = await api.get(`/genieacs_proxy.php?path=/devices&query=${encodeURIComponent(query)}`)
      return (Array.isArray(res.data) ? res.data[0] : null) || null
    },
    enabled: !!deviceId && open,
  })

  const getParam = (path: string) => {
    if (!device) return undefined
    if (device[path] !== undefined) return device[path]?._value
    const parts = path.split('.')
    let current = device
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        if (parts[0] !== 'VirtualParameters' && device[`VirtualParameters.${path}`]) {
            return device[`VirtualParameters.${path}`]?._value
        }
        return undefined
      }
    }
    return current?._value
  }

  const lastInform = device?._lastInform
  const isOnline = lastInform ? (new Date().getTime() - new Date(lastInform).getTime()) < 300000 : false

  const queryClient = useQueryClient()
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (device) {
       setSsid(getParam('VirtualParameters.WiFi SSID') || getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') || '')
    }
  }, [device])

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/genieacs_proxy.php?path=/devices/${deviceId}/tasks?timeout=3000&connection_request`, { name: 'refreshObject', objectName: '' })
      return res.data
    },
    onSuccess: () => {
      toast.success('Sync task initiated', { description: 'GenieACS is fetching latest data from CPE.' })
      queryClient.invalidateQueries({ queryKey: ['genieacs-device-detail', deviceId] })
    },
    onError: () => toast.error('Failed to sync data from device')
  })

  const rebootMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/genieacs_proxy.php?path=/devices/${deviceId}/tasks?timeout=3000&connection_request`, { name: 'reboot' })
      return res.data
    },
    onSuccess: () => toast.success('Reboot command sent', { description: 'The device should restart shortly.' }),
    onError: () => toast.error('Failed to send reboot command')
  })

  const wifiMutation = useMutation({
    mutationFn: async () => {
      // Trying common parameters. GenieACS handles this gracefully usually.
      const paramPath = getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') !== undefined 
          ? 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID' 
          : 'VirtualParameters.WiFi SSID'
      
      const values: any[] = [[paramPath, ssid, 'xsd:string']]
      if (password) {
          const passPath = getParam('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase') !== undefined
              ? 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase'
              : 'VirtualParameters.WiFi Password'
          values.push([passPath, password, 'xsd:string'])
      }

      const res = await api.post(`/genieacs_proxy.php?path=/devices/${deviceId}/tasks?timeout=3000&connection_request`, {
         name: 'setParameterValues',
         parameterValues: values
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('WiFi Config Saved', { description: 'Parameters have been queued to the device.' })
      setPassword('') // Clear password field for security
      queryClient.invalidateQueries({ queryKey: ['genieacs-device-detail', deviceId] })
    },
    onError: () => toast.error('Failed to update WiFi configuration')
  })

  const getConnectedDevices = () => {
    const hosts: any[] = []
    Object.keys(device || {}).forEach(key => {
        if (key.includes('.Hosts.Host.') && key.endsWith('.HostName')) {
            const prefix = key.replace('.HostName', '')
            hosts.push({
                name: device[`${prefix}.HostName`]?._value || 'Unknown Device',
                ip: device[`${prefix}.IPAddress`]?._value || '0.0.0.0',
                mac: device[`${prefix}.MACAddress`]?._value || '---',
                active: device[`${prefix}.Active`]?._value === true || device[`${prefix}.Active`]?._value === 'true'
            })
        }
    })
    return hosts.filter(h => h.active)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-950 rounded-2xl">
        <div className="flex flex-col h-[90vh]">
          {/* Header Berstruktur */}
          <div className="p-6 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="bg-primary/10 p-3 rounded-2xl">
                  <Monitor className="w-6 h-6 text-primary" />
               </div>
               <div>
                  <h2 className="text-xl font-black tracking-tight">
                    {getParam('InternetGatewayDevice.DeviceInfo.ModelName') || getParam('Device.DeviceInfo.ProductClass') || 'Device Insight'}
                  </h2>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">{deviceId}</p>
               </div>
            </div>
            <Badge 
              variant={isOnline ? "outline" : "destructive"} 
              className={cn(
                "uppercase px-4 py-1 text-[10px] font-black tracking-[0.2em] rounded-full", 
                isOnline ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "bg-rose-500 text-white"
              )}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
                <p className="text-xs font-bold uppercase tracking-widest">Syncing Data...</p>
              </div>
            ) : !device ? (
              <div className="flex flex-col items-center justify-center py-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                 <Info className="w-12 h-12 text-slate-200 mb-2" />
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Device not reached</p>
              </div>
            ) : (
            <div className="space-y-8 pb-10">
              {/* Grid Info Ringkas (4 Kolom) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                   { label: 'Manufacturer', val: getParam('InternetGatewayDevice.DeviceInfo.Manufacturer') || getParam('Device.DeviceInfo.Manufacturer'), icon: Cpu },
                   { label: 'Firmware', val: getParam('InternetGatewayDevice.DeviceInfo.SoftwareVersion') || getParam('Device.DeviceInfo.SoftwareVersion'), icon: Settings2 },
                   { label: 'WAN IP', val: getParam('VirtualParameters.pppoeIP') || '0.0.0.0', icon: Globe },
                   { label: 'Uptime', val: getParam('VirtualParameters.getdeviceuptime') || '---', icon: Activity }
                 ].map((item, i) => (
                   <div key={i} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-1">
                         <item.icon className="w-3 h-3 text-blue-500" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                      </div>
                      <p className="text-xs font-bold truncate">{item.val || '-'}</p>
                   </div>
                 ))}
              </div>

              {/* Hero Bar: Elegan (Background Gelap Tipis) */}
              <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-20 h-20 text-white" />
                 </div>
                 <div className="space-y-1 border-r border-white/10 pr-6">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                       <Zap className="w-3 h-3" /> RX Power
                    </p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white">{getParam('VirtualParameters.RXPower') || '-'}</span>
                       <span className="text-[10px] font-bold text-white/50">dBm</span>
                    </div>
                 </div>
                 <div className="space-y-1 border-r border-white/10 pr-6">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                       <Thermometer className="w-3 h-3" /> Temp
                    </p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white">{getParam('VirtualParameters.gettemp') || '-'}</span>
                       <span className="text-[10px] font-bold text-white/50">°C</span>
                    </div>
                 </div>
                 <div className="space-y-1 pl-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                       <Wifi className="w-3 h-3" /> SSID
                    </p>
                    <div className="flex flex-col gap-1">
                       <span className="text-sm font-black text-white truncate">{getParam('VirtualParameters.WiFi SSID') || 'Hidden'}</span>
                       <Badge variant="outline" className="text-[8px] h-4 py-0 border-white/20 text-white/50 w-fit">2.4 / 5.0 GHz</Badge>
                    </div>
                 </div>
              </div>

              {/* Tabs System: Shadcn Style */}
              <Tabs defaultValue="wifi" className="space-y-6">
                <TabsList className="bg-slate-100/50 dark:bg-slate-900 p-1 h-12 rounded-xl w-full max-w-2xl">
                   <TabsTrigger value="wifi" className="rounded-lg data-[state=active]:shadow-sm font-bold text-xs px-6">WiFi Setup</TabsTrigger>
                   <TabsTrigger value="devices" className="rounded-lg data-[state=active]:shadow-sm font-bold text-xs px-6">Hosts ({getConnectedDevices().length})</TabsTrigger>
                   <TabsTrigger value="control" className="rounded-lg data-[state=active]:shadow-sm font-bold text-xs px-6">Tools</TabsTrigger>
                </TabsList>

                <TabsContent value="wifi" className="space-y-4 outline-none">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4 p-6 rounded-2xl border bg-slate-50/50">
                         <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Wireless Identity</h5>
                         <div className="space-y-3">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">SSID Name</label>
                            <Input 
                                value={ssid} 
                                onChange={(e) => setSsid(e.target.value)} 
                                placeholder="My WiFi Network" 
                                className="h-10 bg-white" 
                            />
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Security Key</label>
                            <Input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder="•••••••• (Leave blank to keep current)" 
                                className="h-10 bg-white" 
                            />
                         </div>
                      </div>
                      <div className="flex flex-col justify-center items-center p-8 border-2 border-dashed rounded-2xl gap-4">
                         <ShieldCheck className="w-12 h-12 text-emerald-500/30" />
                         <p className="text-center text-xs text-muted-foreground px-10">Konfigurasi WiFi akan langsung diterapkan ke perangkat setelah Anda menyimpan.</p>
                         <Button 
                            className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg"
                            onClick={() => wifiMutation.mutate()}
                            disabled={wifiMutation.isPending || (!ssid && !password)}
                         >
                            {wifiMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Config'}
                         </Button>
                      </div>
                   </div>
                </TabsContent>

                <TabsContent value="devices" className="space-y-4 outline-none">
                   <div className="space-y-2">
                      {getConnectedDevices().map((host, i) => (
                         <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                               <div className="bg-slate-100 p-2 rounded-lg">
                                  <Smartphone className="w-4 h-4 text-slate-500" />
                               </div>
                               <div>
                                  <p className="text-sm font-bold">{host.name}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">{host.ip} • {host.mac}</p>
                               </div>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px]">ACTIVE</Badge>
                         </div>
                      ))}
                      {getConnectedDevices().length === 0 && (
                         <div className="py-20 text-center text-muted-foreground text-xs italic">Tidak ada host aktif terdeteksi.</div>
                      )}
                   </div>
                </TabsContent>

                <TabsContent value="control" className="grid grid-cols-2 gap-4 outline-none">
                   <div className="p-6 border rounded-2xl flex flex-col items-center text-center gap-4 hover:border-orange-200 transition-colors">
                      <RotateCcw className="w-8 h-8 text-orange-500" />
                      <div>
                         <p className="text-sm font-bold">System Reboot</p>
                         <p className="text-[10px] text-muted-foreground mt-1 px-4 text-balance">Restart perangkat secara aman dari jarak jauh.</p>
                      </div>
                      <Button 
                          variant="outline" 
                          className="w-full h-10 border-orange-100 text-orange-600 font-bold text-[10px] uppercase"
                          onClick={() => rebootMutation.mutate()}
                          disabled={rebootMutation.isPending}
                      >
                          {rebootMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...</> : 'Execute Reboot'}
                      </Button>
                   </div>
                   <div className="p-6 border rounded-2xl flex flex-col items-center text-center gap-4 hover:border-blue-200 transition-colors">
                      <RefreshCw className={cn("w-8 h-8 text-blue-500", syncMutation.isPending && "animate-spin")} />
                      <div>
                         <p className="text-sm font-bold">Fetch Parameters</p>
                         <p className="text-[10px] text-muted-foreground mt-1 px-4 text-balance">Paksa GenieACS mengambil data terbaru dari CPE.</p>
                      </div>
                      <Button 
                          variant="outline" 
                          className="w-full h-10 border-blue-100 text-blue-600 font-bold text-[10px] uppercase"
                          onClick={() => syncMutation.mutate()}
                          disabled={syncMutation.isPending}
                      >
                          {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                      </Button>
                   </div>
                </TabsContent>
              </Tabs>
            </div>
            )}
          </div>

          <div className="p-4 border-t bg-slate-50/50 flex justify-end px-6">
             <Button variant="default" className="px-8 h-10 rounded-xl font-black text-xs uppercase tracking-widest" onClick={() => onOpenChange(false)}>Close Manager</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
