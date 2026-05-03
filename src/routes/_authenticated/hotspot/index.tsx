import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ticket, Plus, Printer, Wifi, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
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

export const Route = createFileRoute('/_authenticated/hotspot/')({ component: HotspotPage })

function printVouchers(vouchers: any[]) {
  const cards = vouchers.map((v) => `<div class="voucher"><h3>HOTSPOT VOUCHER</h3><p class="muted">${v.profile || 'default'}</p><div class="code">${v.username}</div><div>PASS: <b>${v.password}</b></div><p class="muted">Login via halaman hotspot</p></div>`).join('')
  const html = `<!doctype html><html><head><title>Print Voucher</title><style>body{font-family:Arial;padding:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.voucher{border:2px dashed #111;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}.code{font-size:24px;font-weight:900;letter-spacing:2px;margin:10px 0}.muted{color:#666;font-size:12px}@media print{button{display:none}.grid{grid-template-columns:repeat(3,1fr)}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><div class="grid">${cards}</div></body></html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

function HotspotPage() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const [openGenerate, setOpenGenerate] = useState(false)
  const [generated, setGenerated] = useState<any[]>([])
  const [form, setForm] = useState({ qty: '10', profile: 'default', server: 'all', mode: 'vc', length: '6', prefix: 'VC-' })

  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['hotspot-vouchers', routerId],
    queryFn: async () => (await api.get('/hotspot_operations.php', { params: { action: 'list_vouchers', router_id: routerId } })).data,
    enabled: !!routerId,
  })
  const { data: activeData } = useQuery({
    queryKey: ['hotspot-active', routerId],
    queryFn: async () => (await api.get('/hotspot_operations.php', { params: { action: 'list_active', router_id: routerId } })).data,
    enabled: !!routerId,
    refetchInterval: 30000,
  })
  const { data: profileData } = useQuery({
    queryKey: ['hotspot-profiles', routerId],
    queryFn: async () => (await api.get('/hotspot_operations.php', { params: { action: 'get_profiles', router_id: routerId } })).data,
    enabled: !!routerId,
  })

  const generate = useMutation({
    mutationFn: async () => {
      const body = new URLSearchParams({ ...form, qty: form.qty, length: form.length })
      return (await api.post(`/hotspot_operations.php?action=generate&router_id=${routerId}`, body)).data
    },
    onSuccess: (d) => {
      if (d.success) { setGenerated(d.data || []); toast.success(`${d.data?.length || 0} voucher dibuat`); queryClient.invalidateQueries({ queryKey: ['hotspot-vouchers'] }) }
      else toast.error(d.message || 'Gagal generate')
    },
  })

  const vouchers = vouchersData?.data || []
  const active = activeData?.data || []
  const profiles = profileData?.profiles || []

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><Ticket className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>Hotspot & Voucher</h1></div>
        <RouterSelector /><ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main className='space-y-4' fluid>
        <div className='flex items-center justify-between gap-3'>
          <div><h2 className='text-2xl font-bold tracking-tight'>Hotspot & Voucher</h2><p className='text-muted-foreground'>Generate voucher MikroTik, pantau user aktif, dan print voucher.</p></div>
          <Button onClick={() => setOpenGenerate(true)}><Plus className='mr-2 h-4 w-4' /> Generate Voucher</Button>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          <Card><CardContent className='flex items-center gap-3 py-4'><Ticket className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Voucher History</p><p className='text-2xl font-black'>{vouchers.length}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Users className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Active Sessions</p><p className='text-2xl font-black'>{active.length}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Wifi className='h-8 w-8 text-purple-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Profiles</p><p className='text-2xl font-black'>{profiles.length}</p></div></CardContent></Card>
        </div>

        {generated.length > 0 && <Card className='border-green-200 bg-green-50/50 dark:bg-green-950/20'><CardContent className='flex items-center justify-between gap-3 py-4'><div><p className='font-bold'>Voucher baru siap dicetak</p><p className='text-sm text-muted-foreground'>{generated.length} voucher terakhir dari proses generate.</p></div><Button onClick={() => printVouchers(generated)}><Printer className='mr-2 h-4 w-4' /> Print Voucher Baru</Button></CardContent></Card>}

        <Card className='overflow-hidden'>
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Password</TableHead><TableHead>Profile</TableHead><TableHead>Server</TableHead><TableHead>Comment</TableHead><TableHead className='text-right'>Print</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : vouchers.length === 0 ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Belum ada voucher</TableCell></TableRow> : vouchers.map((v: any) => (
                <TableRow key={v.id}><TableCell className='font-mono font-bold'>{v.username}</TableCell><TableCell className='font-mono'>{v.password}</TableCell><TableCell><Badge variant='secondary'>{v.profile}</Badge></TableCell><TableCell>{v.server}</TableCell><TableCell className='text-sm text-muted-foreground'>{v.comment}</TableCell><TableCell className='text-right'><Button size='sm' variant='outline' onClick={() => printVouchers([v])}><Printer className='mr-1 h-3.5 w-3.5' /> Print</Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Main>

      <Dialog open={openGenerate} onOpenChange={setOpenGenerate}>
        <DialogContent><DialogHeader><DialogTitle>Generate Voucher Hotspot</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <div className='grid grid-cols-2 gap-2'><Input type='number' placeholder='Jumlah' value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /><Input type='number' placeholder='Panjang kode' value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} /></div>
            <Input placeholder='Prefix' value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
            <Input placeholder='Server' value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
            <Select value={form.profile} onValueChange={(profile) => setForm({ ...form, profile })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='default'>default</SelectItem>{profiles.map((p: any) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select>
            <Select value={form.mode} onValueChange={(mode) => setForm({ ...form, mode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='vc'>Username = Password</SelectItem><SelectItem value='up'>Username & Password beda</SelectItem></SelectContent></Select>
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setOpenGenerate(false)}>Batal</Button><Button onClick={() => generate.mutate()} disabled={generate.isPending}>Generate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
