import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
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
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CustomerMutateDialog } from './customer-mutate-drawer'
import { CustomerDetailDialog } from './customer-detail-dialog'
import { CustomerBulkEditDialog } from './customer-bulk-edit-dialog'
import { useRouterStore } from '@/stores/router-store'
import { DataTablePagination } from '@/components/data-table'
import { DataTableBulkActions } from '@/components/data-table/bulk-actions'
import { Trash2, Pencil } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { columns } from './customers-columns'
import { type Customer } from '../data/schema'
import { usePermission } from '@/lib/permissions'

interface CustomersTableProps {
  data: Customer[]
  total: number
  page: number
  perPage: number
  _onPageChange: (page: number) => void
  isLoading?: boolean
  profiles?: string[]
  odps?: { id: number, name: string }[]
  onBatchEdit?: (customers: Customer[]) => void
}

export function CustomersTable({ 
  data, 
  total, 
  page, 
  perPage, 
  _onPageChange,
  isLoading,
  profiles = [],
  odps = [],
  onBatchEdit
}: CustomersTableProps) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const permissions = usePermission()
  const [sorting, setSorting] = useState<SortingState>([])
  
  // State for mutation dialogs
  const [isMutateOpen, setIsMutateOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await api.post('/delete_user.php', {
        username,
        router_id: activeRouter?.id,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Pelanggan berhasil dihapus')
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setIsDeleteOpen(false)
      } else {
        toast.error(data.error || 'Gagal menghapus pelanggan')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Terjadi kesalahan sistem')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (usernames: string[]) => {
      const res = await api.post('/bulk_delete_users.php', {
        usernames,
        router_id: activeRouter?.id,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'Pelanggan berhasil dihapus')
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setIsBulkDeleteOpen(false)
        table.resetRowSelection()
      } else {
        toast.error(data.error || 'Gagal menghapus pelanggan')
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
      pagination: {
        pageIndex: page - 1,
        pageSize: perPage,
      },
    },
    meta: {
        onEdit: (customer: Customer) => {
            if (!permissions.canManageCustomers) return
            setEditingCustomer(customer)
            setIsMutateOpen(true)
        },
        onDelete: (customer: Customer) => {
            if (!permissions.canDeleteCustomers) return
            setCustomerToDelete(customer)
            setIsDeleteOpen(true)
        },
        onViewDetail: (customer: Customer) => {
            setSelectedCustomer(customer)
            setIsDetailOpen(true)
        },
        canEdit: permissions.canManageCustomers,
        canDelete: permissions.canDeleteCustomers
    },
    manualPagination: true,
    pageCount: Math.ceil(total / perPage),
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const nextState = updater({
          pageIndex: page - 1,
          pageSize: perPage,
        })
        _onPageChange(nextState.pageIndex + 1)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='overflow-x-auto rounded-lg border bg-card'>
        <Table>
          <TableHeader className='bg-muted/60'>
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
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => {
                        const meta = table.options.meta as any
                        meta?.onViewDetail?.(row.original)
                    }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className='py-3'>
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination 
        table={table} 
        // @ts-expect-error - manual pagination props if supported by component
        showPageSizeSelector={false}
      />

      {(permissions.canManageCustomers || permissions.canDeleteCustomers) && (
      <DataTableBulkActions table={table} entityName='Pelanggan'>
          {permissions.canManageCustomers && <Button
            variant='ghost'
            size='sm'
            className='h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2'
            onClick={() => {
                const selected = table.getFilteredSelectedRowModel().rows.map(r => r.original)
                onBatchEdit?.(selected)
            }}
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

      <CustomerMutateDialog 
        isOpen={isMutateOpen}
        onClose={() => {
            setIsMutateOpen(false)
            setEditingCustomer(null)
        }}
        customer={editingCustomer}
        profiles={profiles}
        odps={odps}
      />

      <CustomerDetailDialog 
        isOpen={isDetailOpen}
        onClose={() => {
            setIsDetailOpen(false)
            setSelectedCustomer(null)
        }}
        customer={selectedCustomer}
        onEdit={(customer) => {
            setEditingCustomer(customer)
            setIsMutateOpen(true)
        }}
        onDelete={(customer) => {
            setCustomerToDelete(customer)
            setIsDeleteOpen(true)
        }}
      />

      <ConfirmDialog 
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Pelanggan"
        desc={`Apakah Anda yakin ingin menghapus pelanggan "${customerToDelete?.username}"? Aksi ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
            if (customerToDelete) deleteMutation.mutate(customerToDelete.username)
        }}
      />

      <ConfirmDialog 
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Masal Pelanggan"
        desc={`Apakah Anda yakin ingin menghapus ${table.getFilteredSelectedRowModel().rows.length} pelanggan terpilih? Aksi ini tidak dapat dibatalkan.`}
        confirmText="Hapus Semua"
        destructive
        isLoading={bulkDeleteMutation.isPending}
        handleConfirm={() => {
            const usernames = table.getFilteredSelectedRowModel().rows.map(r => r.original.username)
            bulkDeleteMutation.mutate(usernames)
        }}
      />
    </div>
  )
}
