import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit, KeyRound, Loader2, Plus, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContentSection } from '../components/content-section'

interface AdminUser {
  id: number
  username: string
  email?: string
  full_name: string
  role: string
  is_active: number
  last_login?: string
}

type AdminForm = {
  id?: number
  username: string
  full_name: string
  email: string
  role: string
  password: string
}

const roleOptions = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Akses penuh semua fitur' },
  { value: 'admin', label: 'Admin', desc: 'Kelola pelanggan, PPPoE, router, dan settings' },
  { value: 'finance', label: 'Finance', desc: 'Kelola pembayaran dan laporan keuangan' },
  { value: 'operator', label: 'Operator', desc: 'Operasional pelanggan dan monitoring' },
  { value: 'viewer', label: 'Viewer', desc: 'Hanya melihat dashboard/monitoring' },
]

const emptyForm: AdminForm = {
  username: '',
  full_name: '',
  email: '',
  role: 'operator',
  password: '',
}

export function SettingsAdmins() {
  const queryClient = useQueryClient()
  const role = useAuthStore((state) => state.auth.user?.role?.toLowerCase() || '')
  const isAdmin = ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'].includes(role)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit'>('add')
  const [form, setForm] = useState<AdminForm>(emptyForm)

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await api.get('/admin_manager.php')
      return res.data.data || []
    },
  })

  const closeDialog = () => {
    setOpen(false)
    setMode('add')
    setForm(emptyForm)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const action = mode === 'add' ? 'add' : 'update'
      const res = await api.post(`/admin_manager.php?action=${action}`, form)
      return res.data
    },
    onSuccess: (data) => {
      if (!data.success) throw new Error(data.message || 'Gagal menyimpan admin')
      toast.success(data.message || 'Admin disimpan')
      closeDialog()
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan admin'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.patch('/admin_manager.php?action=toggle', { id })
      return res.data
    },
    onSuccess: (data) => {
      if (!data.success) throw new Error(data.message || 'Gagal mengubah status')
      toast.success(data.message || 'Status diubah')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah status'),
  })

  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await api.post('/admin_manager.php?action=reset_password', {
        id,
        password,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (!data.success) throw new Error(data.message || 'Gagal reset password')
      toast.success(data.message || 'Password direset')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Gagal reset password'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post('/admin_manager.php?action=delete', { id })
      return res.data
    },
    onSuccess: (data) => {
      if (!data.success) throw new Error(data.message || 'Gagal hapus admin')
      toast.success(data.message || 'Admin dihapus')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Gagal hapus admin'),
  })

  const openAdd = () => {
    setMode('add')
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (admin: AdminUser) => {
    setMode('edit')
    setForm({
      id: admin.id,
      username: admin.username,
      full_name: admin.full_name,
      email: admin.email || '',
      role: admin.role || 'operator',
      password: '',
    })
    setOpen(true)
  }

  const resetPassword = (admin: AdminUser) => {
    const password = window.prompt(`Password baru untuk ${admin.username} (min. 6 karakter):`)
    if (!password) return
    resetMutation.mutate({ id: admin.id, password })
  }

  const deleteAdmin = (admin: AdminUser) => {
    if (!window.confirm(`Hapus admin ${admin.username}?`)) return
    deleteMutation.mutate(admin.id)
  }

  if (!isAdmin) {
    return (
      <ContentSection
        title='Admin Users'
        desc='Kelola akun operator dan administrator panel billing MikroTik.'
      >
        <Card className='p-6 text-sm text-muted-foreground'>
          Akses ditolak. Hanya admin yang boleh mengelola akun admin.
        </Card>
      </ContentSection>
    )
  }

  return (
    <ContentSection
      title='Admin Users'
      desc='Kelola akun operator dan administrator panel billing MikroTik.'
    >
      <div className='mb-4 flex justify-end'>
        <Button onClick={openAdd}>
          <Plus className='mr-2 h-4 w-4' /> Tambah Admin
        </Button>
      </div>

      <Card className='overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className='text-right'>Aktif</TableHead>
              <TableHead className='text-right'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center'>
                  <Loader2 className='mx-auto h-5 w-5 animate-spin' />
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                  Belum ada admin.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className='font-medium'>{admin.full_name}</TableCell>
                  <TableCell>{admin.username}</TableCell>
                  <TableCell>
                    <span className='inline-flex items-center gap-1'>
                      <Shield className='h-3 w-3' />
                      {admin.role}
                    </span>
                  </TableCell>
                  <TableCell className='text-xs text-muted-foreground'>
                    {admin.last_login || '-'}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Switch
                      checked={!!Number(admin.is_active)}
                      onCheckedChange={() => toggleMutation.mutate(admin.id)}
                    />
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button variant='ghost' size='icon' onClick={() => openEdit(admin)} title='Edit'>
                        <Edit className='h-4 w-4' />
                      </Button>
                      <Button variant='ghost' size='icon' onClick={() => resetPassword(admin)} title='Reset password'>
                        <KeyRound className='h-4 w-4' />
                      </Button>
                      <Button variant='ghost' size='icon' onClick={() => deleteAdmin(admin)} title='Hapus'>
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'add' ? 'Tambah Admin' : 'Edit Admin'}</DialogTitle>
          </DialogHeader>
          <div className='grid gap-3 py-2'>
            <div className='grid gap-1.5'>
              <Label>Nama Lengkap</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className='flex flex-col'>
                        <span>{role.label}</span>
                        <span className='text-[10px] text-muted-foreground'>{role.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === 'add' && (
              <div className='grid gap-1.5'>
                <Label>Password</Label>
                <Input type='password' value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>Batal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentSection>
  )
}
