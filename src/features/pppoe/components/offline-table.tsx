import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar, DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Users, Shield, Eye, MoreHorizontal, Trash2, Power, PowerOff, Download, FileText, FileJson } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailDialog } from './detail-dialog'

interface PPPSecret {
  '.id': string
  name: string
  service: string
  profile: string
  'last-caller-id'?: string
  'last-logged-out'?: string
  disabled?: string
}

const routerOsMonths: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function parseLastLoggedOut(value?: string): number {
  if (!value) return 0

  const direct = new Date(value).getTime()
  if (!Number.isNaN(direct)) return direct

  const match = value.trim().toLowerCase().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/)
  if (!match) return 0

  const [, month, day, year, hour = '0', minute = '0', second = '0'] = match
  return new Date(
    Number(year),
    routerOsMonths[month],
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime()
}

// ── Export Functions ─────────────────────────────────────────────────────────
function exportOfflineCSV(data: PPPSecret[], filename = 'pppoe-offline.csv') {
  const headers = ['Name', 'Profile', 'Service', 'Last Caller ID', 'Last Logout', 'Status']
  const rows = data.map(r => [
    r.name,
    r.profile || '',
    r.service || '',
    r['last-caller-id'] || '',
    r['last-logged-out'] || '',
    r.disabled === 'true' ? 'Disabled' : 'Offline',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportOfflineJSON(data: PPPSecret[], filename = 'pppoe-offline.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}


interface Props {
  data: PPPSecret[]
  isLoading: boolean
  profiles?: string[]
}

export function PPPoEOfflineTable({ data, isLoading, profiles = [] }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last-logged-out', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [detailData, setDetailData] = useState<any>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteName, setConfirmDeleteName] = useState('')

  const toggleMutation = useMutation({
    mutationFn: async ({ action, id }: { action: string; id: string }) => {
      const res = await api.post('/mikrotik_action.php', {
        router_id: activeRouter?.id,
        action,
        params: { id }
      })
      return res.data
    },
    onSuccess: (_data, variables) => {
      const msg = variables.action === 'secret_enable' ? 'Akun berhasil diaktifkan' : 'Akun berhasil dinonaktifkan'
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['ppp-secret', activeRouter?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal melakukan aksi')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post('/mikrotik_action.php', {
        router_id: activeRouter?.id,
        action: 'secret_remove',
        params: { id }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Akun berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['ppp-secret', activeRouter?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus akun')
    },
    onSettled: () => {
      setConfirmDeleteId(null)
    }
  })

  const columns: ColumnDef<PPPSecret>[] = [
    {
      id: 'no',
      header: () => <div className="text-center text-muted-foreground text-xs font-semibold">#</div>,
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex
        const pageSize = table.getState().pagination.pageSize
        const visualIndex = table.getRowModel().rows.findIndex(r => r.id === row.id)
        return (
          <div className="text-center text-muted-foreground text-sm tabular-nums">
            {pageIndex * pageSize + visualIndex + 1}
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-10' },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Name' icon={<Users className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => (
        <button
          onClick={() => setDetailData(row.original)}
          className="font-semibold text-left hover:text-primary hover:underline underline-offset-4 transition-colors cursor-pointer"
        >
          {row.getValue('name')}
        </button>
      ),
    },
    {
      accessorKey: 'profile',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Profile' icon={<Shield className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => <Badge variant="outline" className="font-normal">{row.getValue('profile')}</Badge>,
    },
    {
      accessorKey: 'service',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Service' />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('service')}</span>,
    },
    {
      accessorKey: 'last-caller-id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Last Caller ID' />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue('last-caller-id') || '-'}</span>,
    },
    {
      accessorKey: 'last-logged-out',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Last Logout' />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('last-logged-out') || '-'}</span>,
      sortingFn: (rowA, rowB, columnId) => {
        const a = parseLastLoggedOut(rowA.getValue(columnId))
        const b = parseLastLoggedOut(rowB.getValue(columnId))
        return a - b
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const secret = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setDetailData(secret)}
                className="cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {secret.disabled === 'true' ? (
                <DropdownMenuItem
                  onClick={() => toggleMutation.mutate({ action: 'secret_enable', id: secret['.id'] })}
                  className="text-green-600 focus:text-green-600 cursor-pointer"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Enable Account
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => toggleMutation.mutate({ action: 'secret_disable', id: secret['.id'] })}
                  className="text-orange-600 focus:text-orange-600 cursor-pointer"
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Disable Account
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const id = secret['.id']
                  const name = secret.name
                  setTimeout(() => {
                    setConfirmDeleteName(name)
                    setConfirmDeleteId(id)
                  }, 0)
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Secret
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className="flex items-center justify-between gap-2">
        <DataTableToolbar
          table={table}
          searchPlaceholder='Search offline users...'
          filters={[
            {
              columnId: 'service',
              title: 'Service',
              options: [
                { label: 'pppoe', value: 'pppoe' },
                { label: 'any', value: 'any' },
                { label: 'l2tp', value: 'l2tp' },
                { label: 'pptp', value: 'pptp' },
                { label: 'sstp', value: 'sstp' },
              ],
            },
            {
              columnId: 'profile',
              title: 'Profile',
              options: profiles.map(p => ({ label: p, value: p })),
            },
          ]}
        />
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportOfflineCSV(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileText className="w-4 h-4 mr-2" />
                CSV Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportOfflineJSON(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileJson className="w-4 h-4 mr-2" />
                JSON Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className='overflow-hidden rounded-md border bg-card'>
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">Loading data...</TableCell></TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row hover:bg-muted/50 transition-colors'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DetailDialog 
        open={!!detailData}
        onOpenChange={(v) => !v && setDetailData(null)}
        title="Detail Offline User"
        data={detailData}
      />
      <ConfirmDialog
        key='delete-dialog'
        open={!!confirmDeleteId}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
        title="Hapus Akun"
        desc={`Apakah Anda yakin ingin menghapus akun PPPoE "${confirmDeleteName}"? Aksi ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelBtnText="Batal"
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId)
        }}
      />
    </div>
  )
}
