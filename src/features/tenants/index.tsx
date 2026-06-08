import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Plus, Trash2, Globe, Users, Wifi, Edit, CheckCircle2, XCircle, Key } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ── Types ──────────────────────────────────────────────────────────────────
type Tenant = {
  id: number
  name: string
  domain: string
  contact_name: string
  contact_email: string
  contact_phone: string
  plan: 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'suspended' | 'trial'
  max_routers: number
  max_users: number
  created_at: string
}

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
const PLAN_COLORS: Record<string, string> = { starter: 'secondary', pro: 'default', enterprise: 'destructive' }
const STATUS_COLORS: Record<string, string> = { active: 'default', suspended: 'destructive', trial: 'secondary' }

const EMPTY_FORM = {
  name: '', domain: '', contact_name: '', contact_email: '', contact_phone: '',
  plan: 'starter' as Tenant['plan'], status: 'trial' as Tenant['status'],
  max_routers: '3', max_users: '1',
}

// ── Component ──────────────────────────────────────────────────────────────
export function TenantsPage() {
  const queryClient = useQueryClient()
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ success: boolean; data: Tenant[]; summary: any }>({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get('/tenants.php')).data,
    retry: false,
  })

  const tenants = data?.data || []
  const summary = data?.summary || { total: 0, active: 0, trial: 0, suspended: 0 }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        max_routers: Number(form.max_routers),
        max_users: Number(form.max_users),
      }
      if (editing) {
        return (await api.put(`/tenants.php?id=${editing.id}`, payload)).data
      }
      return (await api.post('/tenants.php', payload)).data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success(editing ? 'Klien diperbarui' : 'Klien baru ditambahkan')
        queryClient.invalidateQueries({ queryKey: ['tenants'] })
        setOpenForm(false)
      } else {
        toast.error(d.message || 'Gagal menyimpan')
      }
    },
    onError: () => toast.error('Terjadi kesalahan jaringan'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/tenants.php?id=${id}`)).data,
    onSuccess: (d) => {
      d.success ? toast.success('Klien dihapus') : toast.error(d.message || 'Gagal')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await api.put(`/tenants.php?id=${id}`, { status })).data,
    onSuccess: (d) => {
      d.success ? toast.success('Status diperbarui') : toast.error(d.message || 'Gagal')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpenForm(true)
  }

  function openEdit(t: Tenant) {
    setEditing(t)
    setForm({
      name: t.name, domain: t.domain, contact_name: t.contact_name,
      contact_email: t.contact_email, contact_phone: t.contact_phone,
      plan: t.plan, status: t.status,
      max_routers: String(t.max_routers), max_users: String(t.max_users),
    })
    setOpenForm(true)
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='rounded-lg bg-primary/10 p-2'><Server className='h-5 w-5 text-primary' /></div>
          <h1 className='text-lg font-bold'>Manajemen Klien (SaaS)</h1>
        </div>
        <ThemeSwitch /><ProfileDropdown />
      </Header>

      <Main className='space-y-5' fluid>
        {/* Header */}
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Manajemen Klien</h2>
            <p className='text-muted-foreground text-sm'>Kelola klien SaaS, domain, paket langganan, dan akses router.</p>
          </div>
          <Button onClick={openAdd}><Plus className='mr-2 h-4 w-4' />Tambah Klien</Button>
        </div>

        {/* Summary Cards */}
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {[
            { label: 'Total Klien', value: summary.total, icon: Server, color: 'text-blue-500' },
            { label: 'Aktif', value: summary.active, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Trial', value: summary.trial, icon: Wifi, color: 'text-yellow-500' },
            { label: 'Suspended', value: summary.suspended, icon: XCircle, color: 'text-red-500' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className='flex items-center gap-3 py-4'>
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className='text-xs font-bold uppercase text-muted-foreground'>{s.label}</p>
                  <p className='text-2xl font-black'>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader><CardTitle className='text-base'>Daftar Klien</CardTitle></CardHeader>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Klien</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bergabung</TableHead>
                  <TableHead className='text-right'>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className='py-16 text-center text-muted-foreground'>Memuat data klien...</TableCell></TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className='py-16 text-center'>
                      <div className='flex flex-col items-center gap-3 text-muted-foreground'>
                        <Server className='h-12 w-12 opacity-30' />
                        <p className='font-medium'>Belum ada klien terdaftar</p>
                        <Button variant='outline' size='sm' onClick={openAdd}><Plus className='mr-2 h-4 w-4' />Tambah Klien Pertama</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className='font-bold'>{t.name}</p>
                      <p className='text-xs text-muted-foreground'>ID: {t.id}</p>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1 text-sm'>
                        <Globe className='h-3 w-3 text-muted-foreground' />
                        <span className='font-mono text-xs'>{t.domain || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className='text-sm font-medium'>{t.contact_name}</p>
                      <p className='text-xs text-muted-foreground'>{t.contact_phone}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(PLAN_COLORS[t.plan] || 'secondary') as any}>{PLAN_LABELS[t.plan] || t.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-col gap-0.5 text-xs text-muted-foreground'>
                        <span className='flex items-center gap-1'><Server className='h-3 w-3' />{t.max_routers} Router</span>
                        <span className='flex items-center gap-1'><Users className='h-3 w-3' />{t.max_users} Admin</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(STATUS_COLORS[t.status] || 'secondary') as any}>
                        {t.status === 'active' ? 'Aktif' : t.status === 'suspended' ? 'Suspended' : 'Trial'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        {t.status !== 'active' && (
                          <Button size='sm' variant='outline' className='h-8 text-xs text-green-600' onClick={() => statusMut.mutate({ id: t.id, status: 'active' })}>
                            <CheckCircle2 className='mr-1 h-3 w-3' />Aktifkan
                          </Button>
                        )}
                        {t.status === 'active' && (
                          <Button size='sm' variant='outline' className='h-8 text-xs text-orange-600' onClick={() => statusMut.mutate({ id: t.id, status: 'suspended' })}>
                            <XCircle className='mr-1 h-3 w-3' />Suspend
                          </Button>
                        )}
                        <Button size='icon' variant='outline' className='h-8 w-8' onClick={() => openEdit(t)}>
                          <Edit className='h-3 w-3' />
                        </Button>
                        <Button size='icon' variant='ghost' className='h-8 w-8 text-red-500'
                          onClick={() => confirm(`Hapus klien "${t.name}"?`) && deleteMut.mutate(t.id)}>
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Main>

      {/* Form Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Key className='h-4 w-4' />
              {editing ? 'Edit Klien' : 'Tambah Klien Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>Nama Klien <span className='text-red-500'>*</span></Label>
                <Input placeholder='PT. ISP Maju' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className='space-y-1.5'>
                <Label>Domain</Label>
                <Input placeholder='panel.ispmaju.id' value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>Nama Kontak</Label>
                <Input placeholder='Budi Santoso' value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className='space-y-1.5'>
                <Label>No. HP</Label>
                <Input placeholder='08123456789' value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label>Email</Label>
              <Input type='email' placeholder='admin@ispmaju.id' value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div className='grid grid-cols-3 gap-3'>
              <div className='space-y-1.5'>
                <Label>Paket</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as Tenant['plan'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='starter'>Starter</SelectItem>
                    <SelectItem value='pro'>Pro</SelectItem>
                    <SelectItem value='enterprise'>Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Max Router</Label>
                <Input type='number' min={1} value={form.max_routers} onChange={(e) => setForm({ ...form, max_routers: e.target.value })} />
              </div>
              <div className='space-y-1.5'>
                <Label>Max Admin</Label>
                <Input type='number' min={1} value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Tenant['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='trial'>Trial</SelectItem>
                  <SelectItem value='active'>Aktif</SelectItem>
                  <SelectItem value='suspended'>Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpenForm(false)}>Batal</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name}>
              {saveMut.isPending ? 'Menyimpan...' : editing ? 'Perbarui' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
