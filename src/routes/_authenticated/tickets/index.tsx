import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Plus, UserCheck, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
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

export const Route = createFileRoute('/_authenticated/tickets/')({ component: TicketsPage })

function TicketsPage() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const [openAdd, setOpenAdd] = useState(false)
  const [assign, setAssign] = useState<any>(null)
  const [form, setForm] = useState({ username: '', category: 'Internet Mati', priority: 'Normal', description: '' })
  const [spk, setSpk] = useState({ technician_name: '', task_description: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', routerId],
    queryFn: async () => (await api.get('/ticket_operations.php', { params: { action: 'list', router_id: routerId } })).data,
    enabled: !!routerId,
  })

  const { data: spkData } = useQuery({
    queryKey: ['spk', routerId],
    queryFn: async () => (await api.get('/ticket_operations.php', { params: { action: 'list_spk', router_id: routerId } })).data,
    enabled: !!routerId,
  })

  const addTicket = useMutation({
    mutationFn: async () => (await api.post(`/ticket_operations.php?action=add&router_id=${routerId}`, form)).data,
    onSuccess: (d) => { d.success ? toast.success('Tiket dibuat') : toast.error(d.message || 'Gagal'); setOpenAdd(false); queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: any) => (await api.post(`/ticket_operations.php?action=update_status&router_id=${routerId}`, { id, status })).data,
    onSuccess: (d) => { d.success ? toast.success('Status diperbarui') : toast.error(d.message || 'Gagal'); queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
  })

  const assignSpk = useMutation({
    mutationFn: async () => (await api.post(`/ticket_operations.php?action=assign_spk&router_id=${routerId}`, { ticket_id: assign?.id, ...spk })).data,
    onSuccess: (d) => { d.success ? toast.success('SPK ditugaskan') : toast.error(d.message || 'Gagal'); setAssign(null); queryClient.invalidateQueries({ queryKey: ['tickets'] }); queryClient.invalidateQueries({ queryKey: ['spk'] }) },
  })

  const tickets = data?.data || []
  const summary = data?.summary || {}
  const spks = spkData?.data || []

  const priorityClass = (p: string) => p === 'Urgent' ? 'bg-red-500' : p === 'High' ? 'bg-orange-500' : p === 'Low' ? 'bg-slate-500' : 'bg-blue-500'

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><LifeBuoy className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>Helpdesk & Ticketing</h1></div>
        <RouterSelector /><ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main className='space-y-4' fluid>
        <div className='flex items-center justify-between gap-3'>
          <div><h2 className='text-2xl font-bold tracking-tight'>Helpdesk & Ticketing</h2><p className='text-muted-foreground'>Kelola gangguan pelanggan, assign teknisi, dan SPK lapangan.</p></div>
          <Button onClick={() => setOpenAdd(true)}><Plus className='mr-2 h-4 w-4' /> Buat Tiket</Button>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <Card><CardContent className='flex items-center gap-3 py-4'><AlertTriangle className='h-8 w-8 text-red-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Open</p><p className='text-2xl font-black'>{summary.Open || 0}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Clock className='h-8 w-8 text-orange-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Progress</p><p className='text-2xl font-black'>{summary['In Progress'] || 0}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><CheckCircle2 className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Resolved</p><p className='text-2xl font-black'>{summary.Resolved || 0}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><UserCheck className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>SPK</p><p className='text-2xl font-black'>{spks.length}</p></div></CardContent></Card>
        </div>

        <Card className='overflow-hidden'>
          <Table>
            <TableHeader><TableRow><TableHead>Pelanggan</TableHead><TableHead>Kategori</TableHead><TableHead>Prioritas</TableHead><TableHead>Status</TableHead><TableHead>Deskripsi</TableHead><TableHead className='text-right'>Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : tickets.length === 0 ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Belum ada tiket</TableCell></TableRow> : tickets.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className='font-bold'>{t.username}<p className='text-xs font-normal text-muted-foreground'>{t.created_at}</p></TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell><Badge className={priorityClass(t.priority)}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant='outline'>{t.status}</Badge></TableCell>
                  <TableCell className='max-w-[260px] truncate text-sm text-muted-foreground'>{t.description}</TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button size='sm' variant='outline' className='h-8 text-xs' onClick={() => { setSpk({ technician_name: '', task_description: t.description || '' }); setAssign(t) }}>Assign</Button>
                      <Button size='sm' className='h-8 text-xs bg-green-500 hover:bg-green-600' onClick={() => updateStatus.mutate({ id: t.id, status: 'Resolved' })}>Selesai</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Main>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent><DialogHeader><DialogTitle>Buat Tiket Gangguan</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <Input placeholder='Username pelanggan' value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input placeholder='Kategori' value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='Low'>Low</SelectItem><SelectItem value='Normal'>Normal</SelectItem><SelectItem value='High'>High</SelectItem><SelectItem value='Urgent'>Urgent</SelectItem></SelectContent></Select>
            <Input placeholder='Deskripsi gangguan' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setOpenAdd(false)}>Batal</Button><Button onClick={() => addTicket.mutate()} disabled={addTicket.isPending}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assign} onOpenChange={() => setAssign(null)}>
        <DialogContent><DialogHeader><DialogTitle>Assign Teknisi — {assign?.username}</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <Input placeholder='Nama teknisi' value={spk.technician_name} onChange={(e) => setSpk({ ...spk, technician_name: e.target.value })} />
            <Input placeholder='Deskripsi pekerjaan' value={spk.task_description} onChange={(e) => setSpk({ ...spk, task_description: e.target.value })} />
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setAssign(null)}>Batal</Button><Button onClick={() => assignSpk.mutate()} disabled={assignSpk.isPending}>Assign SPK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
