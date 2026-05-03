import { useState, useEffect } from 'react'
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
import { Network, Clock, UserCheck, MoreHorizontal, LogOut, Eye, Pencil, Download, FileText, FileJson } from 'lucide-react'
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
import { SecretDialog } from './secret-dialog'

interface PPPActiveConnection {
  '.id': string
  name: string
  service: string
  'caller-id': string
  address: string
  uptime: string
  'bytes-in': string | number
  'bytes-out': string | number
}

// ── Export Functions ─────────────────────────────────────────────────────────
function exportActiveCSV(data: PPPActiveConnection[], filename = 'pppoe-active.csv') {
  const headers = ['User', 'Service', 'Caller ID (MAC)', 'Address', 'Uptime']
  const rows = data.map(r => [
    r.name,
    r.service || '',
    r['caller-id'] || '',
    r.address || '',
    r.uptime || '',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportActiveJSON(data: PPPActiveConnection[], filename = 'pppoe-active.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}


const uptimeSortFn = (rowA: any, rowB: any, columnId: string) => {
  const parseUptime = (uptime: string) => {
    let seconds = 0
    const regex = /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/
    const matches = uptime.match(regex)
    if (matches) {
      const w = parseInt(matches[1] || '0')
      const d = parseInt(matches[2] || '0')
      const h = parseInt(matches[3] || '0')
      const m = parseInt(matches[4] || '0')
      const s = parseInt(matches[5] || '0')
      seconds = w * 7 * 24 * 3600 + d * 24 * 3600 + h * 3600 + m * 60 + s
    }
    return seconds
  }
  const valA = parseUptime(rowA.getValue(columnId) as string)
  const valB = parseUptime(rowB.getValue(columnId) as string)
  if (valA === valB) return 0
  return valA > valB ? 1 : -1
}

function parseUptimeToSeconds(uptime: string): number {
  let total = 0
  const wMatch = uptime.match(/(\d+)w/)
  const dMatch = uptime.match(/(\d+)d/)
  const hMatch = uptime.match(/(\d+)h/)
  const mMatch = uptime.match(/(\d+)m/)
  const sMatch = uptime.match(/(\d+)s/)
  if (wMatch) total += parseInt(wMatch[1]) * 7 * 24 * 3600
  if (dMatch) total += parseInt(dMatch[1]) * 24 * 3600
  if (hMatch) total += parseInt(hMatch[1]) * 3600
  if (mMatch) total += parseInt(mMatch[1]) * 60
  if (sMatch) total += parseInt(sMatch[1])
  return total
}

function formatSecondsToUptime(totalSec: number): string {
  const w = Math.floor(totalSec / (7 * 24 * 3600))
  totalSec %= 7 * 24 * 3600
  const d = Math.floor(totalSec / (24 * 3600))
  totalSec %= 24 * 3600
  const h = Math.floor(totalSec / 3600)
  totalSec %= 3600
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  let result = ''
  if (w > 0) result += `${w}w`
  if (d > 0) result += `${d}d`
  if (h > 0) result += `${h}h`
  if (m > 0) result += `${m}m`
  result += `${s}s`
  return result || '0s'
}

function LiveUptimeCell({ initialUptime }: { initialUptime: string }) {
  const [seconds, setSeconds] = useState(() => parseUptimeToSeconds(initialUptime))
  useEffect(() => {
    const timer = setInterval(() => setSeconds(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className="text-sm font-mono tabular-nums">{formatSecondsToUptime(seconds)}</span>
}

interface Props {
  data: PPPActiveConnection[]
  isLoading: boolean
  profiles?: string[]
}

export function PPPoEActiveTable({ data, isLoading, profiles = [] }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'uptime', desc: false }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  const [disconnectId, setDisconnectId] = useState<string | null>(null)
  const [disconnectName, setDisconnectName] = useState<string>('')
  const [detailData, setDetailData] = useState<any>(null)

  // Edit secret state (edit secret user yang sedang aktif)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<any>(null)

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post('/mikrotik_action.php', {
        router_id: activeRouter?.id,
        action: 'active_remove',
        params: { id }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('User berhasil di-disconnect dari sesi aktif')
      queryClient.invalidateQueries({ queryKey: ['ppp-active', activeRouter?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal disconnect user')
    },
    onSettled: () => { setDisconnectId(null) }
  })

  const columns: ColumnDef<PPPActiveConnection>[] = [
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
      header: ({ column }) => <DataTableColumnHeader column={column} title='User' icon={<UserCheck className="w-4 h-4 mr-1"/>} />,
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
      accessorKey: 'service',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Service' />,
      cell: ({ row }) => <Badge variant="outline" className="bg-background">{row.getValue('service')}</Badge>,
    },
    {
      accessorKey: 'caller-id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Caller ID (MAC)' />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.getValue('caller-id')}</span>,
    },
    {
      accessorKey: 'address',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Address' icon={<Network className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => row.getValue('address'),
    },
    {
      accessorKey: 'uptime',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Uptime' icon={<Clock className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => <LiveUptimeCell initialUptime={row.getValue('uptime') || '0s'} />,
      sortingFn: uptimeSortFn,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const connection = row.original
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
                onClick={() => setDetailData(connection)}
                className="cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Buat objek secret minimal dari data active agar bisa di-edit
                  setEditingSecret({
                    '.id': connection['.id'],
                    name: connection.name,
                    service: connection.service,
                    profile: '',
                    password: '',
                  })
                  setTimeout(() => setIsEditDialogOpen(true), 0)
                }}
                className="cursor-pointer"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Secret
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const id = connection['.id']
                  const name = connection.name
                  setTimeout(() => {
                    setDisconnectName(name)
                    setDisconnectId(id)
                  }, 0)
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
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
    state: { sorting, columnVisibility, globalFilter },
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
          searchPlaceholder='Search active sessions...'
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
              <DropdownMenuItem onClick={() => exportActiveCSV(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileText className="w-4 h-4 mr-2" />
                CSV Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportActiveJSON(table.getFilteredRowModel().rows.map(r => r.original))}>
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
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      header.column.columnDef.meta?.className
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />

      <ConfirmDialog
        key='disconnect-dialog'
        open={!!disconnectId}
        onOpenChange={(v) => !v && setDisconnectId(null)}
        title="Disconnect User"
        desc={`Apakah Anda yakin ingin men-disconnect sesi aktif milik "${disconnectName}"? User akan terputus dari internet sementara hingga terhubung kembali.`}
        confirmText="Disconnect"
        cancelBtnText="Batal"
        destructive
        isLoading={disconnectMutation.isPending}
        handleConfirm={() => {
          if (disconnectId) disconnectMutation.mutate(disconnectId)
        }}
      />

      <DetailDialog
        open={!!detailData}
        onOpenChange={(v) => !v && setDetailData(null)}
        title="Detail Sesi Aktif"
        data={detailData}
      />

      <SecretDialog
        isOpen={isEditDialogOpen}
        onClose={() => { setIsEditDialogOpen(false); setEditingSecret(null) }}
        secret={editingSecret}
        profiles={profiles}
      />
    </div>
  )
}
