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
import { Users, Shield, MoreHorizontal, Pencil, Trash2, PowerOff, Power, Download, Eye, FileJson, FileText } from 'lucide-react'
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
import { SecretDialog } from './secret-dialog'
import { DetailDialog } from './detail-dialog'
import { PrivacyText } from '@/components/privacy'
import { usePermission } from '@/lib/permissions'


interface PPPSecret {
  '.id': string
  name: string
  service: string
  profile: string
  password?: string
  'last-caller-id'?: string
  'last-logged-out'?: string
  disabled?: string
}

// ── CSV Export ───────────────────────────────────────────────────────────────
function exportSecretsCSV(data: PPPSecret[], filename = 'pppoe-secrets.csv') {
  const headers = ['Name', 'Profile', 'Service', 'Last Caller ID', 'Last Logout', 'Status']
  const rows = data.map(r => [
    r.name,
    r.profile || '',
    r.service || '',
    r['last-caller-id'] || '',
    r['last-logged-out'] || '',
    r.disabled === 'true' ? 'Disabled' : 'Active',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportSecretsJSON(data: PPPSecret[], filename = 'pppoe-secrets.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}



interface Props {
  data: PPPSecret[]
  isLoading: boolean
  activeNames: Set<string>
  profiles: string[]
}

export function PPPoESecretsTable({ data, isLoading, activeNames, profiles }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const permissions = usePermission()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  // Dialog states
  const [isSecretDialogOpen, setIsSecretDialogOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<PPPSecret | undefined>()

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
      if (variables.action === 'secret_remove') msg = 'Akun berhasil dihapus'
      if (variables.action === 'secret_disable') msg = 'Akun berhasil dinonaktifkan'
      if (variables.action === 'secret_enable') msg = 'Akun berhasil diaktifkan'
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['ppp-secret', activeRouter?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal melakukan aksi')
    },
    onSettled: () => { setConfirmDeleteId(null) }
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
      id: 'status',
      accessorFn: (row) => {
        if (row.disabled === 'true') return 'Disabled'
        if (activeNames.has(row.name)) return 'Online'
        return 'Offline'
      },
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row }) => {
        const secret = row.original
        const isOnline = activeNames.has(secret.name)
        if (secret.disabled === 'true') {
          return <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0">Disabled</Badge>
        }
        if (isOnline) {
          return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-0">Online</Badge>
        }
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-0">Offline</Badge>
      },
      filterFn: (row, columnId, filterValues: string[]) => {
        const val = row.getValue(columnId) as string
        return filterValues.includes(val)
      },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Name' icon={<Users className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => (
        <button
          onClick={() => setDetailData(row.original)}
          className="font-semibold text-left hover:text-primary hover:underline underline-offset-4 transition-colors cursor-pointer"
        >
          <PrivacyText>{row.getValue('name') as string}</PrivacyText>
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
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground"><PrivacyText>{row.getValue('last-caller-id') || '-'}</PrivacyText></span>,
    },
    {
      accessorKey: 'last-logged-out',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Last Logout' />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue('last-logged-out') || '-'}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const secret = row.original
        const isDisabled = secret.disabled === 'true'

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
              {permissions.canManagePPPoE && (
                <DropdownMenuItem 
                  onClick={() => {
                    setEditingSecret(secret)
                    setIsSecretDialogOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Account
                </DropdownMenuItem>
              )}
              {permissions.canManagePPPoE && (isDisabled ? (
                <DropdownMenuItem
                  onClick={() => actionMutation.mutate({ action: 'secret_enable', id: secret['.id'] })}
                  className="text-green-600 focus:text-green-600 cursor-pointer"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Enable Account
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => actionMutation.mutate({ action: 'secret_disable', id: secret['.id'] })}
                  className="text-orange-600 focus:text-orange-600 cursor-pointer"
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Disable Account
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDetailData(secret)}
                className="cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {permissions.canDeletePPPoE && <DropdownMenuSeparator />}
              {permissions.canDeletePPPoE && (
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
                  Delete Account
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
      <div className="flex items-center justify-between gap-2">
        <DataTableToolbar
          table={table}
          searchPlaceholder='Search secrets...'
          filters={[
            {
              columnId: 'status',
              title: 'Status',
              options: [
                { label: 'Online', value: 'Online' },
                { label: 'Offline', value: 'Offline' },
                { label: 'Disabled', value: 'Disabled' },
              ],
            },
            {
              columnId: 'profile',
              title: 'Profile',
              options: profiles.map(p => ({ label: p, value: p })),
            },
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

          
          {/* Enhanced Export Dropdown */}
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
              <DropdownMenuItem onClick={() => exportSecretsCSV(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileText className="w-4 h-4 mr-2" />
                CSV Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSecretsJSON(table.getFilteredRowModel().rows.map(r => r.original))}>
                <FileJson className="w-4 h-4 mr-2" />
                JSON Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add New */}
          {permissions.canManagePPPoE && (
            <Button onClick={() => {
              setEditingSecret(undefined)
              setIsSecretDialogOpen(true)
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
              table.getRowModel().rows.map((row) => {
                const isDisabled = row.original.disabled === 'true'
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(
                        'group/row hover:bg-muted/50 transition-colors',
                        isDisabled ? 'opacity-50 bg-muted/30' : ''
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'bg-transparent group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
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
                )
              })
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

      <SecretDialog 
        isOpen={isSecretDialogOpen} 
        onClose={() => setIsSecretDialogOpen(false)} 
        secret={editingSecret}
        profiles={profiles}
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
        isLoading={actionMutation.isPending}
        handleConfirm={() => {
          if (confirmDeleteId) actionMutation.mutate({ action: 'secret_remove', id: confirmDeleteId })
        }}
      />

      <DetailDialog 
        open={!!detailData}
        onOpenChange={(v) => !v && setDetailData(null)}
        title="Detail PPPoE Account"
        data={detailData}
      />
    </div>
  )
}
