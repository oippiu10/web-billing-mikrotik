import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Plus, RadioTower, Trash2, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/olt/')({ component: OltCenter })

function OltCenter() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [walkResult, setWalkResult] = useState<any>(null)
  const [probeResult, setProbeResult] = useState<any>(null)
  const [form, setForm] = useState({ name: '', brand: 'Generic', host: '', port: '23', protocol: 'snmp', snmp_community: 'public', pon_ports: '0', total_onu: '0', online_onu: '0', status: 'unknown', location: '', note: '' })
  const { data, isLoading } = useQuery({ queryKey: ['olts'], queryFn: async () => (await api.get('/olt_operations.php', { params: { action: 'list' } })).data })
  const add = useMutation({ mutationFn: async () => {
    const test = (await api.post('/olt_operations.php?action=test_connection', { host: form.host, port: form.port, protocol: form.protocol })).data
    if (!test.success) throw new Error(test.message || 'Ping test gagal')
    if (!test.online && !confirm(`Ping test gagal/offline. Pesan: ${test.message}\n\nTetap simpan OLT?`)) return { success: false, cancelled: true }
    const payload = { ...form, status: test.status || 'unknown' }
    return (await api.post('/olt_operations.php?action=add', payload)).data
  }, onSuccess: (d) => { if (d.cancelled) return; d.success ? toast.success('OLT ditambahkan') : toast.error(d.message || 'Gagal'); setOpen(false); queryClient.invalidateQueries({ queryKey: ['olts'] }) }, onError: (e: any) => toast.error(e?.message || 'Gagal test koneksi') })
  const updateStatus = useMutation({ mutationFn: async ({ id, status }: any) => (await api.post('/olt_operations.php?action=update_status', { id, status })).data, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['olts'] }) })
  const del = useMutation({ mutationFn: async (id: number) => (await api.post('/olt_operations.php?action=delete', { id })).data, onSuccess: (d) => { d.success ? toast.success('OLT dihapus') : toast.error(d.message || 'Gagal'); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
  const checkStatus = useMutation({ mutationFn: async (id: number) => (await api.post('/olt_operations.php?action=check_status', { id })).data, onSuccess: (d) => { d.success ? toast.success(`OLT ${d.status} (${d.response_ms}ms)`) : toast.error(d.message || 'Gagal check OLT'); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
  const snmpBasic = useMutation({ mutationFn: async (id: number) => (await api.post('/olt_operations.php?action=snmp_basic', { id })).data, onSuccess: (d) => { d.success ? toast.success(`SNMP OK: ${d.sys_name || 'OLT'}`) : toast.error(d.message || 'SNMP gagal'); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
  const updateSnmp = useMutation({ mutationFn: async ({ id, snmp_community }: any) => (await api.post('/olt_operations.php?action=update_snmp', { id, snmp_community })).data, onSuccess: (d) => { d.success ? toast.success('SNMP community disimpan') : toast.error(d.message || 'Gagal simpan SNMP'); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
  const snmpWalk = useMutation({ mutationFn: async ({ id, oid }: any) => (await api.post('/olt_operations.php?action=snmp_walk', { id, oid, limit: 80 })).data, onSuccess: (d) => { d.success ? (setWalkResult(d), toast.success(`Walk OK: ${d.count} data`)) : toast.error(d.message || 'SNMP walk gagal') } })
  const snmpProbe = useMutation({ mutationFn: async (id: number) => (await api.post('/olt_operations.php?action=snmp_probe', { id })).data, onSuccess: (d) => { d.success ? (setProbeResult(d), toast.success(`Probe selesai: ${d.hits} reply`)) : toast.error(d.message || 'SNMP probe gagal') }, onError: (e: any) => toast.error(`SNMP probe gagal: ${e?.response?.status || ''} ${e?.response?.data?.message || e?.message || 'timeout'}`) })
  const olts = data?.data || []
  const s = data?.summary || {}

  const statusBadge = (st: string) => st === 'online' ? 'default' : st === 'offline' ? 'destructive' : 'secondary'

  return <>
    <Header fixed><div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><Network className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>OLT Center</h1></div><RouterSelector /><ThemeSwitch /><ProfileDropdown /></Header>
    <Main className='space-y-4' fluid>
      <div className='flex items-center justify-between gap-3'><div><h2 className='text-2xl font-bold tracking-tight'>OLT Monitoring & Provisioning</h2><p className='text-muted-foreground'>Inventory OLT, kapasitas PON/ONU, status perangkat, dan pondasi integrasi SNMP/Telnet vendor.</p></div><Button onClick={() => setOpen(true)}><Plus className='mr-2 h-4 w-4' /> Tambah OLT</Button></div>
      <div className='grid gap-3 md:grid-cols-4'>
        <Card><CardContent className='flex items-center gap-3 py-4'><RadioTower className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Total OLT</p><p className='text-2xl font-black'>{s.total || 0}</p></div></CardContent></Card>
        <Card><CardContent className='flex items-center gap-3 py-4'><Wifi className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Online OLT</p><p className='text-2xl font-black'>{s.online || 0}</p></div></CardContent></Card>
        <Card><CardContent className='flex items-center gap-3 py-4'><WifiOff className='h-8 w-8 text-red-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Offline OLT</p><p className='text-2xl font-black'>{s.offline || 0}</p></div></CardContent></Card>
        <Card><CardContent className='flex items-center gap-3 py-4'><Network className='h-8 w-8 text-purple-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>ONU Online</p><p className='text-2xl font-black'>{s.onu_online || 0}/{s.onu_total || 0}</p></div></CardContent></Card>
      </div>
      <div className='grid gap-3 md:grid-cols-3'>
        <Card><CardContent className='space-y-2 py-4'><p className='font-bold'>Vendor Adapter</p><p className='text-sm text-muted-foreground'>Struktur siap untuk Huawei, ZTE, Fiberhome, VSOL/BDCOM/C-Data via SNMP/Telnet/SSH.</p><Badge variant='secondary'>Next connector</Badge></CardContent></Card>
        <Card><CardContent className='space-y-2 py-4'><p className='font-bold'>ONU Provisioning</p><p className='text-sm text-muted-foreground'>Roadmap auto authorize ONU, bind ke pelanggan, dan template service-port.</p><Badge variant='secondary'>Planned</Badge></CardContent></Card>
        <Card><CardContent className='space-y-2 py-4'><p className='font-bold'>Optical Power Alarm</p><p className='text-sm text-muted-foreground'>Roadmap monitoring redaman RX/TX, LOS, dying gasp, flapping ONU.</p><Badge variant='secondary'>Planned</Badge></CardContent></Card>
      </div>
      {walkResult && <Card className='overflow-hidden'>
        <CardContent className='space-y-3 py-4'>
          <div className='flex items-center justify-between gap-2'><div><p className='font-bold'>SNMP Walk Result</p><p className='text-xs text-muted-foreground'>OID {walkResult.oid} · {walkResult.count} data · read-only manual</p></div><Button size='sm' variant='outline' onClick={() => setWalkResult(null)}>Tutup</Button></div>
          <div className='max-h-80 overflow-auto rounded-md border'><Table><TableHeader><TableRow><TableHead>OID</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>{walkResult.data?.map((r: any, i: number) => <TableRow key={i}><TableCell className='font-mono text-xs'>{r.oid}</TableCell><TableCell className='font-mono text-xs'>{r.value}</TableCell></TableRow>)}</TableBody></Table></div>
        </CardContent>
      </Card>}
      {probeResult && <Card className='overflow-hidden'>
        <CardContent className='space-y-3 py-4'>
          <div className='flex items-center justify-between gap-2'><div><p className='font-bold'>HSGQ OID Probe Result</p><p className='text-xs text-muted-foreground'>{probeResult.hits} reply dari {probeResult.count} candidate · read-only manual</p></div><Button size='sm' variant='outline' onClick={() => setProbeResult(null)}>Tutup</Button></div>
          <div className='max-h-96 overflow-auto rounded-md border'><Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Label</TableHead><TableHead>OID</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>{probeResult.data?.map((r: any, i: number) => <TableRow key={i}><TableCell><Badge variant={r.status === 'reply' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell><TableCell className='text-xs'>{r.label}</TableCell><TableCell className='font-mono text-xs'>{r.oid}</TableCell><TableCell className='font-mono text-xs'>{r.value || '-'}</TableCell></TableRow>)}</TableBody></Table></div>
        </CardContent>
      </Card>}
      <Card className='overflow-hidden'><Table><TableHeader><TableRow><TableHead>OLT</TableHead><TableHead>Host</TableHead><TableHead>Protocol</TableHead><TableHead>PON</TableHead><TableHead>ONU</TableHead><TableHead>Status</TableHead><TableHead>Lokasi</TableHead><TableHead>Last Check</TableHead><TableHead className='text-right'>Aksi</TableHead></TableRow></TableHeader><TableBody>
        {isLoading ? <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : olts.length === 0 ? <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Belum ada OLT</TableCell></TableRow> : olts.map((o: any) => <TableRow key={o.id}><TableCell><b>{o.name}</b><p className='text-xs text-muted-foreground'>{o.brand}</p></TableCell><TableCell className='font-mono text-xs'>{o.host}:{o.port}</TableCell><TableCell><p>{o.protocol}</p><Input className='mt-1 h-7 w-36 text-xs' defaultValue={o.snmp_community || 'public-read'} onBlur={(e) => e.target.value !== o.snmp_community && updateSnmp.mutate({ id: o.id, snmp_community: e.target.value })} /></TableCell><TableCell>{o.pon_ports}</TableCell><TableCell>{o.online_onu}/{o.total_onu}</TableCell><TableCell><Select value={o.status} onValueChange={(status) => updateStatus.mutate({ id: o.id, status })}><SelectTrigger className='h-8 w-32'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='unknown'>unknown</SelectItem><SelectItem value='online'>online</SelectItem><SelectItem value='offline'>offline</SelectItem><SelectItem value='maintenance'>maintenance</SelectItem></SelectContent></Select><Badge className='mt-1' variant={statusBadge(o.status) as any}>{o.status}</Badge></TableCell><TableCell>{o.location || '-'}</TableCell><TableCell><p className='text-xs'>{o.last_checked_at || '-'}</p><p className='text-xs text-muted-foreground'>{o.response_ms ? `${o.response_ms}ms` : ''} {o.last_check_message || ''}</p>{o.sys_name && <p className='mt-1 text-xs font-semibold'>SNMP: {o.sys_name}</p>}</TableCell><TableCell className='text-right'><div className='flex justify-end gap-1'><Button size='sm' variant='outline' onClick={() => snmpBasic.mutate(Number(o.id))} disabled={snmpBasic.isPending}>SNMP</Button><Button size='sm' variant='outline' onClick={() => snmpWalk.mutate({ id: Number(o.id), oid: '1.3.6.1.2.1.1' })} disabled={snmpWalk.isPending}>Walk</Button><Button size='sm' variant='outline' onClick={() => snmpProbe.mutate(Number(o.id))} disabled={snmpProbe.isPending}>{snmpProbe.isPending ? 'Probe...' : 'Probe'}</Button><Button size='icon' variant='outline' onClick={() => checkStatus.mutate(Number(o.id))} disabled={checkStatus.isPending}><RefreshCw className='h-4 w-4' /></Button><Button size='icon' variant='ghost' onClick={() => confirm('Hapus OLT?') && del.mutate(Number(o.id))}><Trash2 className='h-4 w-4 text-red-500' /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></Card>
    </Main>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='max-w-md'>
        <DialogHeader><DialogTitle>Tambah OLT</DialogTitle></DialogHeader>
        <div className='grid gap-3 py-2'>
          <div>
            <label className='text-xs font-bold uppercase text-muted-foreground'>Nama</label>
            <Input className='mt-1' placeholder='Contoh: OLT POP 1' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className='text-xs font-bold uppercase text-muted-foreground'>IP / Host</label>
            <Input className='mt-1' placeholder='192.168.10.2' value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div>
            <label className='text-xs font-bold uppercase text-muted-foreground'>Port</label>
            <Input className='mt-1' placeholder='23 / 22 / 80 / 443 / 161' value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          </div>
          <div>
            <label className='text-xs font-bold uppercase text-muted-foreground'>SNMP Community</label>
            <Input className='mt-1' placeholder='public' value={form.snmp_community} onChange={(e) => setForm({ ...form, snmp_community: e.target.value })} />
          </div>
          <div>
            <label className='text-xs font-bold uppercase text-muted-foreground'>Type OLT</label>
            <Select value={form.brand} onValueChange={(brand) => setForm({ ...form, brand })}>
              <SelectTrigger className='mt-1'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='Generic'>Generic / Unknown</SelectItem>
                <SelectItem value='Huawei MA5600/MA5608/MA5680'>Huawei MA5600/MA5608/MA5680</SelectItem>
                <SelectItem value='Huawei MA5800'>Huawei MA5800</SelectItem>
                <SelectItem value='ZTE C300/C320'>ZTE C300/C320</SelectItem>
                <SelectItem value='ZTE C600/C650'>ZTE C600/C650</SelectItem>
                <SelectItem value='Fiberhome AN5516'>Fiberhome AN5516</SelectItem>
                <SelectItem value='Fiberhome AN6000'>Fiberhome AN6000</SelectItem>
                <SelectItem value='VSOL V1600'>VSOL V1600 Series</SelectItem>
                <SelectItem value='VSOL V2800'>VSOL V2800 Series</SelectItem>
                <SelectItem value='BDCOM GP3600'>BDCOM GP3600 Series</SelectItem>
                <SelectItem value='BDCOM GP1700'>BDCOM GP1700 Series</SelectItem>
                <SelectItem value='C-Data FD1600'>C-Data FD1600 Series</SelectItem>
                <SelectItem value='C-Data FD8000'>C-Data FD8000 Series</SelectItem>
                <SelectItem value='HSGQ'>HSGQ</SelectItem>
                <SelectItem value='HSGQ G-series'>HSGQ G-Series</SelectItem>
                <SelectItem value='HSGQ XPON'>HSGQ XPON OLT</SelectItem>
                <SelectItem value='Raisecom'>Raisecom</SelectItem>
                <SelectItem value='Dasan/Zhone'>Dasan / Zhone</SelectItem>
                <SelectItem value='Nokia/Alcatel ISAM'>Nokia / Alcatel ISAM</SelectItem>
                <SelectItem value='MikroTik GPEN'>MikroTik GPEN</SelectItem>
                <SelectItem value='TP-Link OLT'>TP-Link OLT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant='outline' onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => add.mutate()} disabled={add.isPending}>{add.isPending ? 'Ping test...' : 'Simpan'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
