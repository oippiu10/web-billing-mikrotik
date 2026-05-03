import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Plus, RadioTower, Trash2, Wifi, WifiOff } from 'lucide-react'
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
  const [form, setForm] = useState({ name: '', brand: 'Generic', host: '', port: '23', protocol: 'manual', snmp_community: 'public', pon_ports: '0', total_onu: '0', online_onu: '0', status: 'unknown', location: '', note: '' })
  const { data, isLoading } = useQuery({ queryKey: ['olts'], queryFn: async () => (await api.get('/olt_operations.php', { params: { action: 'list' } })).data })
  const add = useMutation({ mutationFn: async () => (await api.post('/olt_operations.php?action=add', form)).data, onSuccess: (d) => { d.success ? toast.success('OLT ditambahkan') : toast.error(d.message || 'Gagal'); setOpen(false); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
  const updateStatus = useMutation({ mutationFn: async ({ id, status }: any) => (await api.post('/olt_operations.php?action=update_status', { id, status })).data, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['olts'] }) })
  const del = useMutation({ mutationFn: async (id: number) => (await api.post('/olt_operations.php?action=delete', { id })).data, onSuccess: (d) => { d.success ? toast.success('OLT dihapus') : toast.error(d.message || 'Gagal'); queryClient.invalidateQueries({ queryKey: ['olts'] }) } })
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
      <Card className='overflow-hidden'><Table><TableHeader><TableRow><TableHead>OLT</TableHead><TableHead>Host</TableHead><TableHead>Protocol</TableHead><TableHead>PON</TableHead><TableHead>ONU</TableHead><TableHead>Status</TableHead><TableHead>Lokasi</TableHead><TableHead className='text-right'>Aksi</TableHead></TableRow></TableHeader><TableBody>
        {isLoading ? <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : olts.length === 0 ? <TableRow><TableCell colSpan={8} className='py-10 text-center text-muted-foreground'>Belum ada OLT</TableCell></TableRow> : olts.map((o: any) => <TableRow key={o.id}><TableCell><b>{o.name}</b><p className='text-xs text-muted-foreground'>{o.brand}</p></TableCell><TableCell className='font-mono text-xs'>{o.host}:{o.port}</TableCell><TableCell>{o.protocol}</TableCell><TableCell>{o.pon_ports}</TableCell><TableCell>{o.online_onu}/{o.total_onu}</TableCell><TableCell><Select value={o.status} onValueChange={(status) => updateStatus.mutate({ id: o.id, status })}><SelectTrigger className='h-8 w-32'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='unknown'>unknown</SelectItem><SelectItem value='online'>online</SelectItem><SelectItem value='offline'>offline</SelectItem><SelectItem value='maintenance'>maintenance</SelectItem></SelectContent></Select><Badge className='mt-1' variant={statusBadge(o.status) as any}>{o.status}</Badge></TableCell><TableCell>{o.location || '-'}</TableCell><TableCell className='text-right'><Button size='icon' variant='ghost' onClick={() => confirm('Hapus OLT?') && del.mutate(Number(o.id))}><Trash2 className='h-4 w-4 text-red-500' /></Button></TableCell></TableRow>)}
      </TableBody></Table></Card>
    </Main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Tambah OLT</DialogTitle></DialogHeader><div className='grid gap-3 py-2'><Input placeholder='Nama OLT' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><div className='grid grid-cols-2 gap-2'><Input placeholder='Brand' value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /><Input placeholder='Host/IP' value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></div><div className='grid grid-cols-2 gap-2'><Input placeholder='Port' value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /><Select value={form.protocol} onValueChange={(protocol) => setForm({ ...form, protocol })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='manual'>manual</SelectItem><SelectItem value='snmp'>snmp</SelectItem><SelectItem value='telnet'>telnet</SelectItem><SelectItem value='ssh'>ssh</SelectItem><SelectItem value='api'>api</SelectItem></SelectContent></Select></div><div className='grid grid-cols-3 gap-2'><Input placeholder='PON' value={form.pon_ports} onChange={(e) => setForm({ ...form, pon_ports: e.target.value })} /><Input placeholder='Total ONU' value={form.total_onu} onChange={(e) => setForm({ ...form, total_onu: e.target.value })} /><Input placeholder='ONU Online' value={form.online_onu} onChange={(e) => setForm({ ...form, online_onu: e.target.value })} /></div><Input placeholder='SNMP Community' value={form.snmp_community} onChange={(e) => setForm({ ...form, snmp_community: e.target.value })} /><Input placeholder='Lokasi' value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /><Input placeholder='Catatan' value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div><DialogFooter><Button variant='outline' onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => add.mutate()} disabled={add.isPending}>Simpan</Button></DialogFooter></DialogContent></Dialog>
  </>
}
