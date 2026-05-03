import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, ArrowDownToLine, ArrowUpFromLine, Trash2, Wallet } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/inventory/')({ component: InventoryPage })

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function InventoryPage() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [openAdd, setOpenAdd] = useState(false)
  const [movement, setMovement] = useState<any>(null)
  const [form, setForm] = useState({ name: '', category: 'ONT/CPE', stock: '0', unit: 'pcs', price: '0', description: '' })
  const [qty, setQty] = useState('1')

  const routerId = activeRouter?.software_id || activeRouter?.id
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', routerId],
    queryFn: async () => (await api.get('/inventory_operations.php', { params: { action: 'list', router_id: routerId } })).data,
    enabled: !!routerId,
  })

  const addItem = useMutation({
    mutationFn: async () => (await api.post(`/inventory_operations.php?action=add&router_id=${routerId}`, form)).data,
    onSuccess: (d) => { d.success ? toast.success('Item ditambah') : toast.error(d.message || 'Gagal'); setOpenAdd(false); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const moveItem = useMutation({
    mutationFn: async () => (await api.post(`/inventory_operations.php?action=movement&router_id=${routerId}`, { id: movement?.id, type: movement?.type, qty: Number(qty), note: 'Mutasi dari dashboard' })).data,
    onSuccess: (d) => { d.success ? toast.success('Mutasi berhasil') : toast.error(d.message || 'Gagal'); setMovement(null); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const deleteItem = useMutation({
    mutationFn: async (id: number) => (await api.post(`/inventory_operations.php?action=delete&router_id=${routerId}`, { id })).data,
    onSuccess: (d) => { d.success ? toast.success('Item dihapus') : toast.error(d.message || 'Gagal'); queryClient.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const items = data?.data || []
  const summary = data?.summary || { total_items: 0, total_value: 0, low_stock: 0 }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><Package className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>Inventory & Asset</h1></div>
        <RouterSelector /><ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main className='space-y-4' fluid>
        <div className='flex items-center justify-between gap-3'>
          <div><h2 className='text-2xl font-bold tracking-tight'>Inventory & Asset</h2><p className='text-muted-foreground'>Stok perangkat, material fiber, dan asset jaringan.</p></div>
          <Button onClick={() => setOpenAdd(true)}><Plus className='mr-2 h-4 w-4' /> Tambah Item</Button>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          <Card><CardContent className='flex items-center gap-3 py-4'><Package className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Total Item</p><p className='text-2xl font-black'>{summary.total_items}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Wallet className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Nilai Asset</p><p className='text-xl font-black'>{fmt(summary.total_value)}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><Package className='h-8 w-8 text-orange-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Stok Menipis</p><p className='text-2xl font-black'>{summary.low_stock}</p></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className='text-base'>Daftar Inventory</CardTitle></CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Kategori</TableHead><TableHead className='text-right'>Stok</TableHead><TableHead className='text-right'>Harga</TableHead><TableHead className='text-right'>Nilai</TableHead><TableHead className='text-right'>Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={6} className='py-12 text-center text-muted-foreground'>Belum ada inventory</TableCell></TableRow> : items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className='font-bold'>{item.name}<p className='text-xs font-normal text-muted-foreground'>{item.description}</p></TableCell>
                  <TableCell><Badge variant='secondary'>{item.category}</Badge></TableCell>
                  <TableCell className='text-right font-mono font-bold'>{item.stock} {item.unit}</TableCell>
                  <TableCell className='text-right font-mono'>{fmt(Number(item.price))}</TableCell>
                  <TableCell className='text-right font-mono font-bold'>{fmt(Number(item.asset_value))}</TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button size='icon' variant='outline' className='h-8 w-8' onClick={() => { setQty('1'); setMovement({ ...item, type: 'in' }) }}><ArrowDownToLine className='h-4 w-4 text-green-500' /></Button>
                      <Button size='icon' variant='outline' className='h-8 w-8' onClick={() => { setQty('1'); setMovement({ ...item, type: 'out' }) }}><ArrowUpFromLine className='h-4 w-4 text-orange-500' /></Button>
                      <Button size='icon' variant='ghost' className='h-8 w-8 text-red-500' onClick={() => confirm('Hapus item ini?') && deleteItem.mutate(Number(item.id))}><Trash2 className='h-4 w-4' /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Main>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent><DialogHeader><DialogTitle>Tambah Inventory</DialogTitle></DialogHeader>
          <div className='grid gap-3 py-2'>
            <Input placeholder='Nama barang' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder='Kategori' value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <div className='grid grid-cols-3 gap-2'><Input type='number' placeholder='Stok' value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /><Input placeholder='Unit' value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /><Input type='number' placeholder='Harga' value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <Input placeholder='Deskripsi' value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter><Button variant='outline' onClick={() => setOpenAdd(false)}>Batal</Button><Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movement} onOpenChange={() => setMovement(null)}>
        <DialogContent className='max-w-sm'><DialogHeader><DialogTitle>{movement?.type === 'in' ? 'Stok Masuk' : 'Stok Keluar'} — {movement?.name}</DialogTitle></DialogHeader>
          <Input type='number' value={qty} onChange={(e) => setQty(e.target.value)} />
          <DialogFooter><Button variant='outline' onClick={() => setMovement(null)}>Batal</Button><Button onClick={() => moveItem.mutate()} disabled={moveItem.isPending}>Simpan Mutasi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
