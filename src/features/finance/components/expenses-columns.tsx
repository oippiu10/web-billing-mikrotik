import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PrivacyText } from '@/components/privacy'
import { cn } from '@/lib/utils'
import {
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

export interface ExpensesColumnsContext {
  setEditDialog: (row: any) => void
  handleDelete: (row: any) => void
  fmt: (n: number) => string
}

export const getExpensesColumns = (ctx: ExpensesColumnsContext): ColumnDef<any>[] => {
  return [
    {
      id: 'index',
      header: () => <div className="w-12 text-center text-xs font-black">#</div>,
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex
        const pageSize = table.getState().pagination.pageSize
        return (
          <div className="text-center text-xs font-bold text-muted-foreground">
            {pageIndex * pageSize + row.index + 1}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'spent_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group"
          >
            Tanggal
            {column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => <div className="text-sm font-bold">{row.original.spent_at}</div>,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group"
          >
            Kategori
            {column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <Badge variant="outline" className="font-bold bg-muted/50">
          {row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: 'note',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group"
          >
            Keterangan
            {column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-sm max-w-[250px] truncate">{row.original.note || '-'}</div>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="-mr-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group flex items-center justify-end w-full"
            >
              {column.getIsSorted() === 'desc' ? (
                <ArrowDown className="mr-2 h-3.5 w-3.5 text-primary" />
              ) : column.getIsSorted() === 'asc' ? (
                <ArrowUp className="mr-2 h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="mr-2 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
              )}
              Nominal
            </Button>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="text-right font-black text-rose-600">
          <PrivacyText>{ctx.fmt(parseFloat(row.original.amount || 0))}</PrivacyText>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-center w-20 text-xs font-black uppercase text-muted-foreground">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-indigo-100 text-indigo-500 bg-indigo-50/30 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-indigo-950/20 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/50 rounded-lg shadow-sm"
            onClick={() => ctx.setEditDialog(row.original)}
            title="Ubah Pengeluaran"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-rose-100 text-rose-500 bg-rose-50/30 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-950/20 dark:bg-rose-950/10 dark:hover:bg-rose-950/50 rounded-lg shadow-sm"
            onClick={() => ctx.handleDelete(row.original)}
            title="Hapus Pengeluaran"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ]
}
