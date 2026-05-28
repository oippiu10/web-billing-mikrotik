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
import { Button } from '@/components/ui/button'
import { Shield, Activity, MoreHorizontal, Pencil, Trash2, Eye, Download, FileJson, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { ProfileDialog } from './profile-dialog'
import { PriceDialog } from './price-dialog'
import { DetailDialog } from './detail-dialog'
import { usePermission } from '@/lib/permissions'

interface PPPProfile {
  '.id': string
  name: string
  'local-address'?: string
  'remote-address'?: string
  'rate-limit'?: string
  default?: string
  price?: number
}

// ── Export Helpers ───────────────────────────────────────────────────────────
function exportProfilesCSV(data: PPPProfile[], filename = 'pppoe-profiles.csv') {
  const headers = ['Name', 'Local Address', 'Remote Address', 'Rate Limit']
  const rows = data.map(r => [
    r.name,
    r['local-address'] || '',
    r['remote-address'] || '',
    r['rate-limit'] || '',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportProfilesJSON(data: PPPProfile[], filename = 'pppoe-profiles.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  data: PPPProfile[]
  isLoading: boolean
}

export function PPPoEProfilesTable({ data, isLoading }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const permissions = usePermission()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  // Dialog states
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PPPProfile | undefined>()
  
  // Confirm states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleteName, setConfirmDeleteName] = useState('')
  const [detailData, setDetailData] = useState<any>(null)

  const actionMutation = useMutation({
    mutationFn: async ({ action, id }: { action: string, id: string }) => {
      const res = await api.post('/mikrotik_action.php', {
        router_id: activeRouter?.id,
        action,
        params: { id }
      })
      return res.data
    },
    onSuccess: (_data, variables) => {
      let msg = 'Berhasil'
      if (variables.action === 'profile_remove') msg = 'Profil berhasil dihapus'
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['ppp-profile', activeRouter?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal melakukan aksi')
    },
    onSettled: () => {
      setConfirmDeleteId(null)
    }
  })

  const columns: ColumnDef<PPPProfile>[] = [
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
      header: ({ column }) => <DataTableColumnHeader column={column} title='Name' icon={<Shield className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => {
        const isDefault = row.original.default === 'true'
        return (
          <div className="flex items-center gap-2 font-medium">
            <button
              onClick={() => setDetailData(row.original)}
              className="font-semibold text-left hover:text-primary hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              {row.getValue('name')}
            </button>
            {isDefault && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-200/50">Default</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: 'local-address',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Local Address' />,
      cell: ({ row }) => <span className="font-mono text-sm text-muted-foreground">{row.getValue('local-address') || '-'}</span>,
    },
    {
      accessorKey: 'remote-address',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Remote Address' />,
      cell: ({ row }) => <span className="font-mono text-sm text-muted-foreground">{row.getValue('remote-address') || '-'}</span>,
    },
    {
      accessorKey: 'rate-limit',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Rate Limit (Rx/Tx)' icon={<Activity className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => {
        const val = row.getValue('rate-limit') as string
        if (!val) return <span className="text-muted-foreground">-</span>
        return (
          <Badge variant="outline" className="font-mono text-xs bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            {val}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'price',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Harga' />,
      cell: ({ row }) => {
        const price = row.original.price
        if (!price) return <span className="text-muted-foreground text-sm">-</span>
        return <span className="font-medium text-sm text-green-600 dark:text-green-500">Rp {price.toLocaleString('id-ID')}</span>
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const profile = row.original
        const isDefault = profile.default === 'true'

        if (isDefault) return null // Default profile shouldn't be edited/deleted

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
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDetailData(profile)}
                className="cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {permissions.canManageRouter && <DropdownMenuSeparator />}
              {permissions.canManageRouter && (
                <DropdownMenuItem 
                  onClick={() => {
                    setEditingProfile(profile)
                    setIsPriceDialogOpen(true)
                  }}
                  className="cursor-pointer text-green-600 dark:text-green-500 focus:text-green-600 dark:focus:text-green-500"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Atur Harga
                </DropdownMenuItem>
              )}
              {permissions.canManageRouter && (
                <DropdownMenuItem 
                  onClick={() => {
                    setEditingProfile(profile)
                    setIsProfileDialogOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Profil
                </DropdownMenuItem>
              )}
              {permissions.canManageRouter && <DropdownMenuSeparator />}
              {permissions.canManageRouter && (
                <DropdownMenuItem 
                  onClick={() => {
                    setConfirmDeleteName(profile.name)
                    setConfirmDeleteId(profile['.id'])
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Profil
                </DropdownMenuItem>
              )}
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
      <div className="flex items-center justify-between">
        <DataTableToolbar
          table={table}
          searchPlaceholder='Search profiles...'
          filters={[
            {
              columnId: 'rate-limit',
              title: 'Rate Limit',
              options: [
                { label: 'Unlimited', value: '' },
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
              <DropdownMenuItem onClick={() => exportProfilesCSV(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileText className="w-4 h-4 mr-2" />
                CSV Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportProfilesJSON(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileJson className="w-4 h-4 mr-2" />
                JSON Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {permissions.canManageRouter && (
            <Button onClick={() => {
              setEditingProfile(undefined)
              setIsProfileDialogOpen(true)
            }}>
              Add New
            </Button>
          )}
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
      
      <ProfileDialog 
        isOpen={isProfileDialogOpen} 
        onClose={() => setIsProfileDialogOpen(false)} 
        profile={editingProfile}
      />

      <PriceDialog 
        isOpen={isPriceDialogOpen} 
        onClose={() => setIsPriceDialogOpen(false)} 
        profile={editingProfile}
      />

      <ConfirmDialog
        key='delete-dialog'
        open={!!confirmDeleteId}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
        title="Hapus Profil"
        desc={`Apakah Anda yakin ingin menghapus profil paket PPPoE "${confirmDeleteName}"? Aksi ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelBtnText="Batal"
        handleConfirm={() => {
          if (confirmDeleteId) actionMutation.mutate({ action: 'profile_remove', id: confirmDeleteId })
        }}
      />
      
      <DetailDialog 
        open={!!detailData}
        onOpenChange={(v) => !v && setDetailData(null)}
        title="Detail PPPoE Profile"
        data={detailData}
      />
    </div>
  )
}
