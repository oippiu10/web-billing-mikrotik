import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ODPMutateDialog } from './odp-mutate-drawer'
import { ODPDetailDialog } from './odp-detail-dialog'
import { ODPBulkEditDialog } from './odp-bulk-edit-dialog'
import { DataTableToolbar } from '@/components/data-table'
import { DataTableBulkActions } from '@/components/data-table/bulk-actions'
import { Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { columns } from './odp-columns'
import { type ODP } from '../data/schema'
import { usePermission } from '@/lib/permissions'

interface ODPTableProps {
  data: ODP[]
  isLoading?: boolean
}

export function ODPTable({ 
  data, 
  isLoading,
}: ODPTableProps) {
  const queryClient = useQueryClient()
  const permissions = usePermission()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  
  // State for mutation dialogs
  const [isMutateOpen, setIsMutateOpen] = useState(false)
  const [editingODP, setEditingODP] = useState<ODP | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [odpToDelete, setODPToDelete] = useState<ODP | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedODP, setSelectedODP] = useState<ODP | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/odp.php?id=${id}`)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('ODP berhasil dihapus')
        queryClient.invalidateQueries({ queryKey: ['odps'] })
        setIsDeleteOpen(false)
      } else {
        toast.error(data.message || 'Gagal menghapus ODP')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan sistem')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await api.post('/bulk_delete_odp.php', { ids })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'ODP berhasil dihapus')
        queryClient.invalidateQueries({ queryKey: ['odps'] })
        setIsBulkDeleteOpen(false)
        table.resetRowSelection()
      } else {
        toast.error(data.error || 'Gagal menghapus ODP')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Terjadi kesalahan sistem')
    }
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    meta: {
        onEdit: (odp: ODP) => {
            if (!permissions.canManageCustomers) return
            setEditingODP(odp)
            setIsMutateOpen(true)
        },
        onDelete: (odp: ODP) => {
            if (!permissions.canDeleteCustomers) return
            setODPToDelete(odp)
            setIsDeleteOpen(true)
        },
        onViewDetail: (odp: ODP) => {
            setSelectedODP(odp)
            setIsDetailOpen(true)
        },
        canEdit: permissions.canManageCustomers,
        canDelete: permissions.canDeleteCustomers
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar 
        table={table}
        searchPlaceholder='Cari ODP...'
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                    key={row.id} 
                    className="cursor-pointer"
                    onClick={() => {
                        const meta = table.options.meta as any
                        meta?.onViewDetail?.(row.original)
                    }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  Tidak ada data ODP.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(permissions.canManageCustomers || permissions.canDeleteCustomers) && (
      <DataTableBulkActions table={table} entityName='ODP'>
          {permissions.canManageCustomers && <Button
            variant='ghost'
            size='sm'
            className='h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2'
            onClick={() => setIsBulkEditOpen(true)}
          >
            <Pencil className='h-4 w-4' />
            Edit Terpilih
          </Button>}
          {permissions.canManageCustomers && permissions.canDeleteCustomers && <Separator orientation='vertical' className='h-4' />}
          {permissions.canDeleteCustomers && <Button
            variant='ghost'
            size='sm'
            className='h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2'
            onClick={() => setIsBulkDeleteOpen(true)}
          >
            <Trash2 className='h-4 w-4' />
            Hapus Terpilih
          </Button>}
      </DataTableBulkActions>
      )}

      <ODPBulkEditDialog 
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedIds={table.getFilteredSelectedRowModel().rows
            .map(r => r.original.id)
            .filter((id): id is number => id !== undefined)}
      />

      <ODPMutateDialog 
        isOpen={isMutateOpen}
        onClose={() => {
            setIsMutateOpen(false)
            setEditingODP(null)
        }}
        odp={editingODP}
      />

      <ODPDetailDialog 
        isOpen={isDetailOpen}
        onClose={() => {
            setIsDetailOpen(false)
            setSelectedODP(null)
        }}
        odp={selectedODP}
        onEdit={(odp) => {
            if (!permissions.canManageCustomers) return
            setEditingODP(odp)
            setIsMutateOpen(true)
        }}
        onDelete={(odp) => {
            setODPToDelete(odp)
            setIsDeleteOpen(true)
        }}
      />

      <ConfirmDialog 
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus ODP"
        desc={`Apakah Anda yakin ingin menghapus ODP "${odpToDelete?.name}"? Data ini akan dihapus permanen.`}
        confirmText="Hapus"
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
            if (odpToDelete?.id) deleteMutation.mutate(odpToDelete.id)
        }}
      />

      <ConfirmDialog 
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Masal ODP"
        desc={`Apakah Anda yakin ingin menghapus ${table.getFilteredSelectedRowModel().rows.length} ODP terpilih? Data akan dihapus permanen.`}
        confirmText="Hapus Semua"
        destructive
        isLoading={bulkDeleteMutation.isPending}
        handleConfirm={() => {
            const ids = table.getFilteredSelectedRowModel().rows
                .map(r => r.original.id)
                .filter((id): id is number => id !== undefined)
            bulkDeleteMutation.mutate(ids)
        }}
      />
    </div>
  )
}
