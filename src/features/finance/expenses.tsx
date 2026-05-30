import { useState, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Wallet, Plus, Trash2, ArrowDownCircle, Search, RefreshCw, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { FinanceSubNav } from './components/finance-sub-nav'
import { PrivacyText } from '@/components/privacy'
import { useConfirm } from '@/hooks/use-confirm'
import { getExpensesColumns } from './components/expenses-columns'
import { Skeleton } from '@/components/ui/skeleton'

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
  { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' }, { value: 12, label: 'Desember' },
]

const CATEGORIES = ['Operasional', 'Peralatan/Kabel', 'Bensin/Transport', 'Gaji/Upah', 'ISP/Bandwidth', 'Lainnya']

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export function FinanceExpenses() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const [addDialog, setAddDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Operasional')
  const [spentAt, setSpentAt] = useState(now.toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  // Pagination & Sorting state (Managed by TanStack Table now, but we keep the initial pagination state to pass to useReactTable)
  const [{ pageIndex, pageSize }, setPagination] = useState({ pageIndex: 0, pageSize: 15 })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const { confirm: confirmAction, ConfirmDialog } = useConfirm()

  // Reset pagination ke halaman 1 saat filter waktu berubah
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [month, year])

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', activeRouter?.id, month, year],
    queryFn: async () => {
      const res = await api.get('/expense_operations.php', {
        params: { action: 'list', router_id: activeRouter?.software_id || activeRouter?.id, month, year }
      })
      return res.data
    },
    enabled: !!activeRouter,
  })

  const expenses = data?.data || []
  
  const totalExpense = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0)

  const addMutation = useMutation({
    mutationFn: async () => {
      const action = editId ? 'edit' : 'add'
      const payload: any = {
        category,
        amount: parseFloat(amount) || 0,
        note,
        spent_at: spentAt
      }
      if (editId) payload.id = editId
      
      const res = await api.post(`/expense_operations.php?action=${action}&router_id=` + (activeRouter?.software_id || activeRouter?.id), payload)
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success(d.message || 'Berhasil disimpan')
        setAddDialog(false)
        setAmount('')
        setNote('')
        setEditId(null)
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        queryClient.invalidateQueries({ queryKey: ['finance-annual'] })
      } else toast.error(d.message || 'Gagal')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.get('/expense_operations.php', {
        params: { action: 'delete', router_id: activeRouter?.software_id || activeRouter?.id, id }
      })
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success(d.message || 'Terhapus')
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
        queryClient.invalidateQueries({ queryKey: ['finance-kpi'] })
        queryClient.invalidateQueries({ queryKey: ['finance-annual'] })
      } else toast.error(d.message || 'Gagal')
    }
  })

  const handleAdd = () => {
    if (!amount || parseFloat(amount) <= 0) return toast.error('Nominal harus diisi')
    addMutation.mutate()
  }

  const table = useReactTable({
    data: expenses,
    columns: getExpensesColumns({
      setEditDialog: (row) => {
        setEditId(row.id)
        setCategory(row.category)
        setAmount(row.amount)
        setNote(row.note)
        setSpentAt(row.spent_at)
        setAddDialog(true)
      },
      handleDelete: async (row) => {
        const ok = await confirmAction({
          title: 'Hapus Pengeluaran',
          description: `Apakah Anda yakin ingin menghapus catatan pengeluaran "${row.note || row.category}"?\n\nNominal sebesar ${fmt(parseFloat(row.amount))} akan dihapus dari data pembukuan secara permanen.`,
          confirmText: 'Ya, Hapus',
          cancelText: 'Batal',
          variant: 'destructive',
        })
        if (ok) deleteMutation.mutate(row.id)
      },
      fmt
    }),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <ArrowDownCircle className='h-5 w-5' />
          <h1 className='text-lg font-bold'>Pengeluaran</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <FinanceSubNav active='/finance/expenses' />
          
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
              <SelectTrigger className='h-9 w-32 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className='h-9 w-24 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'><SelectValue /></SelectTrigger>
              <SelectContent>
                {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAddDialog(true)} className='h-9 bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20'>
              <Plus className='h-4 w-4 mr-2' /> Catat Pengeluaran
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <Card className='relative overflow-hidden border-none shadow-lg bg-linear-to-br from-rose-500 to-red-600 text-white'>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-[10px] font-black uppercase tracking-widest opacity-80'>Total Pengeluaran Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4'>
            <div className='text-xl xl:text-2xl font-black mb-1 truncate'><PrivacyText>{fmt(totalExpense)}</PrivacyText></div>
            <div className='flex items-center gap-1 text-[10px] font-bold opacity-80'>
              Tercatat <PrivacyText>{expenses.length}</PrivacyText> item pengeluaran
            </div>
          </CardContent>
          <Wallet className='absolute top-4 right-4 h-12 w-12 opacity-20' />
        </Card>

        {/* Filters */}
        <div className='flex flex-col gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
          {/* Left Side: Selectors & Search Input */}
          <div className='flex flex-wrap items-center gap-2 flex-1 min-w-0'>
            {/* Category Select */}
            <Select
              value={filterCategory || 'all'}
              onValueChange={(v) => setFilterCategory(v === 'all' ? '' : v)}
            >
              <SelectTrigger className='h-9 w-40 text-xs font-semibold bg-background border-border rounded-lg shadow-sm focus:ring-0 focus:ring-offset-0 shrink-0'>
                <SelectValue placeholder='Semua Kategori' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Semua Kategori</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className='relative min-w-[160px] flex-1 max-w-[240px]'>
              <Search className='absolute top-2.5 left-3 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Cari keterangan...'
                className='h-9 pl-9 text-xs rounded-lg border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Right Side: Action Buttons (Reset) */}
          <div className='flex items-center justify-end gap-2 border-t pt-3 sm:border-none sm:pt-0 shrink-0 ml-auto sm:ml-0'>
            <Button
              size='sm'
              variant='ghost'
              className='h-9 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 rounded-lg'
              onClick={() => {
                setSearch('')
                setFilterCategory('')
                table.setPageIndex(0)
              }}
            >
              <RefreshCw className='h-3.5 w-3.5' />
              Reset
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className='overflow-hidden border border-border/80 shadow-lg rounded-xl bg-card'>
          <Table>
            <TableHeader className='bg-slate-50/75 dark:bg-slate-900/60 border-b border-border/60'>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className={header.column.id === 'actions' ? 'w-20' : ''}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {table.getAllColumns().filter(c => c.getIsVisible()).map((col, j) => (
                        <TableCell key={j} className="py-4">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className='border-b border-border/30 hover:bg-muted/30'
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} className='text-center py-16 text-muted-foreground'>
                    Belum ada pengeluaran yang sesuai.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {table.getPageCount() > 1 && (
          <div className='flex items-center justify-between px-1'>
            <span className='text-xs text-muted-foreground font-semibold'>
              Menampilkan {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} dari {table.getFilteredRowModel().rows.length} item
            </span>
            <div className='flex items-center gap-1.5'>
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8 rounded-lg border-border/80 text-muted-foreground shadow-sm hover:bg-accent'
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              {Array.from({ length: table.getPageCount() }, (_, i) => i + 1).map(p => (
                <Button
                  key={p}
                  variant={p - 1 === table.getState().pagination.pageIndex ? 'default' : 'outline'}
                  size='icon'
                  className='h-8 w-8 rounded-lg text-xs font-bold shadow-sm'
                  onClick={() => table.setPageIndex(p - 1)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8 rounded-lg border-border/80 text-muted-foreground shadow-sm hover:bg-accent'
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={addDialog} onOpenChange={(v) => {
          if (!v) {
            setEditId(null)
            setAmount('')
            setNote('')
          }
          setAddDialog(v)
        }}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <Wallet className='h-5 w-5 text-rose-500' /> {editId ? 'Ubah' : 'Catat'} Pengeluaran
              </DialogTitle>
            </DialogHeader>
            <div className='space-y-4 py-2'>
              <div>
                <label className='text-xs font-bold uppercase text-muted-foreground'>Kategori</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className='mt-1'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className='text-xs font-bold uppercase text-muted-foreground'>Nominal (Rp)</label>
                <Input type='number' value={amount} onChange={e => setAmount(e.target.value)} className='mt-1 font-bold' placeholder='Contoh: 150000' />
              </div>
              <div>
                <label className='text-xs font-bold uppercase text-muted-foreground'>Tanggal</label>
                <Input type='date' value={spentAt} onChange={e => setSpentAt(e.target.value)} className='mt-1' />
              </div>
              <div>
                <label className='text-xs font-bold uppercase text-muted-foreground'>Keterangan (Opsional)</label>
                <Input value={note} onChange={e => setNote(e.target.value)} className='mt-1' placeholder='Beli kabel 1 roll...' />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setAddDialog(false)}>Batal</Button>
              <Button className='bg-rose-500 hover:bg-rose-600 text-white' onClick={handleAdd} disabled={addMutation.isPending}>
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog />
      </Main>
    </>
  )
}
