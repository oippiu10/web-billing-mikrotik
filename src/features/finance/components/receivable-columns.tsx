import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PrivacyText } from '@/components/privacy'
import { cn } from '@/lib/utils'
import {
  CheckCheck,
  MessageCircle,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
} from 'lucide-react'

export interface ReceivableColumnsContext {
  permissions: any
  selectedRows: Set<number>
  toggleSelectRow: (id: number) => void
  toggleSelectAll: (checked: boolean) => void
  setPaymentCardUser: (user: any) => void
  setPaidDialog: (row: any) => void
  handleWA: (row: any) => void
  handleOpenIsolate: (row: any) => void
  openIsolatePending: boolean
  dataLength: number
  fmt: (n: number) => string
  overdueColor: (n: number) => string
}

export const getReceivableColumns = (ctx: ReceivableColumnsContext): ColumnDef<any>[] => {
  const cols: ColumnDef<any>[] = []

  if (ctx.permissions?.canManageFinance) {
    cols.push({
      id: 'select',
      header: () => (
        <div className="pl-4 text-center">
          <Checkbox
            checked={ctx.dataLength > 0 && ctx.selectedRows.size === ctx.dataLength}
            onCheckedChange={(checked) => ctx.toggleSelectAll(!!checked)}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="pl-4 text-center">
          <Checkbox
            checked={ctx.selectedRows.has(row.original.id)}
            onCheckedChange={() => ctx.toggleSelectRow(row.original.id)}
          />
        </div>
      ),
      enableSorting: false,
    })
  }

  cols.push(
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
      accessorKey: 'username',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className={cn("-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group", !ctx.permissions?.canManageFinance && 'pl-4')}
          >
            Username
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
        <div className={cn("font-bold text-sm", !ctx.permissions?.canManageFinance && 'pl-4')}>
          <PrivacyText>{row.original.username}</PrivacyText>
        </div>
      ),
    },
    {
      accessorKey: 'alamat',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group hidden md:flex"
          >
            Alamat
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
        <div className="text-xs text-muted-foreground hidden md:block max-w-[140px] truncate">
          <PrivacyText>{row.original.alamat || '-'}</PrivacyText>
        </div>
      ),
    },
    {
      accessorKey: 'profile',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-3 h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group"
          >
            Paket
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
        <Badge variant="secondary" className="text-[10px] font-bold">
          {row.original.profile}
        </Badge>
      ),
    },
    {
      accessorKey: 'harga',
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
              Tagihan
            </Button>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm font-bold text-red-600">
          <PrivacyText>{ctx.fmt(parseFloat(row.original.harga || 0))}</PrivacyText>
        </div>
      ),
    },
    {
      accessorKey: 'tanggal_tagihan',
      header: ({ column }) => {
        return (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-8 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 group"
            >
              Tgl Tagihan
              {column.getIsSorted() === 'desc' ? (
                <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />
              ) : column.getIsSorted() === 'asc' ? (
                <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
              )}
            </Button>
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="text-center text-xs text-muted-foreground">
          {row.original.tanggal_tagihan || '-'}
        </div>
      ),
    },
  )

  if (ctx.permissions?.canManageFinance) {
    cols.push({
      id: 'actions',
      header: () => <div className="text-right pr-4 text-xs font-black uppercase text-muted-foreground">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5 pr-4">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-amber-100 text-amber-600 bg-amber-50/30 transition-all duration-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/30 dark:text-amber-400 dark:bg-amber-950/10 dark:hover:bg-amber-950/50 rounded-lg shadow-sm"
            onClick={() => ctx.handleWA(row.original)}
            title="Kirim Pesan Penagihan WA"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-indigo-100 text-indigo-600 bg-indigo-50/30 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-900/30 dark:text-indigo-400 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/50 rounded-lg shadow-sm"
            onClick={() => ctx.handleOpenIsolate(row.original)}
            disabled={ctx.openIsolatePending}
            title="Buka Isolir (Open)"
          >
            <ShieldCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-blue-100 text-blue-600 bg-blue-50/30 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/30 dark:text-blue-400 dark:bg-blue-950/10 dark:hover:bg-blue-950/50 rounded-lg shadow-sm"
            onClick={() => ctx.setPaymentCardUser(row.original)}
            title="Lihat Kartu Pembayaran (1 Tahun)"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 bg-emerald-500 text-white shadow-sm shadow-emerald-500/10 transition-all duration-200 hover:bg-emerald-600 hover:shadow-emerald-500/25 rounded-lg"
            onClick={() => ctx.setPaidDialog(row.original)}
            title="Tandai Lunas"
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
    })
  }

  return cols
}
