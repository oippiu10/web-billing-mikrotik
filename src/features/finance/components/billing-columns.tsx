import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PrivacyText } from '@/components/privacy'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Clock,
  History,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Printer,
  Receipt,
  XCircle,
  ArrowUpDown,
  Wallet,
  Banknote,
  Landmark,
  QrCode,
  Smartphone,
} from 'lucide-react'
import { printThermal, printInvoice } from '../utils/print-templates'

export interface BillingColumnsContext {
  permissions: any
  selectedRows: Set<number>
  toggleSelectRow: (id: number) => void
  toggleSelectAll: (checked: boolean) => void
  setHistoryUser: (user: any) => void
  setPaidDialog: (row: any) => void
  handleWA: (row: any) => void
  confirmAction: (options: any) => Promise<boolean>
  markUnpaid: any
  month: number
  year: number
  dataLength: number
  fmt: (n: number) => string
}

export const getBillingColumns = (ctx: BillingColumnsContext): ColumnDef<any>[] => {
  const columns: ColumnDef<any>[] = []

  if (ctx.permissions.canManageFinance) {
    columns.push({
      id: 'select',
      header: () => (
        <Checkbox
          checked={ctx.dataLength > 0 && ctx.selectedRows.size === ctx.dataLength}
          onCheckedChange={ctx.toggleSelectAll}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={ctx.selectedRows.has(row.original.user_id)}
          onCheckedChange={() => ctx.toggleSelectRow(row.original.user_id)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    })
  }

  columns.push({
    accessorKey: 'username',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
        >
          Username
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const original = row.original
      return (
        <div
          className="cursor-pointer text-sm font-bold text-indigo-600 transition-colors hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
          onClick={() =>
            ctx.setHistoryUser({
              id: original.user_id,
              username: original.username,
            })
          }
        >
          <div className="flex items-center gap-2">
            <PrivacyText>{original.username}</PrivacyText>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] font-black uppercase tracking-wider px-1.5 py-0 rounded border shadow-3xs scale-90 origin-left transition-all',
                original.tipe_langganan === 'prabayar'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-blue-500 text-blue-600 bg-blue-50'
              )}
            >
              {original.tipe_langganan === 'prabayar' ? 'Pra' : 'Pasca'}
            </Badge>
          </div>
        </div>
      )
    },
  })

  columns.push({
    accessorKey: 'profile',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
        >
          Paket
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className="text-[10px] font-bold bg-muted hover:bg-muted text-muted-foreground border-none rounded-md px-1.5 py-0.5"
      >
        {row.original.profile}
      </Badge>
    ),
  })

  columns.push({
    accessorKey: 'harga',
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-mr-4 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
          >
            Tagihan
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm font-semibold text-muted-foreground">
        <PrivacyText>{ctx.fmt(parseFloat(row.original.harga || 0))}</PrivacyText>
      </div>
    ),
  })

  columns.push({
    accessorKey: 'paid_amount',
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-mr-4 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
          >
            Bayar
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const original = row.original
      const isPaid = original.status === 'paid'
      return (
        <div
          className={cn(
            'text-right font-mono text-sm font-bold transition-all duration-150',
            isPaid
              ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline decoration-dashed underline-offset-4'
              : 'text-muted-foreground'
          )}
          onClick={() => {
            if (isPaid) {
              ctx.setHistoryUser({ id: original.user_id, username: original.username })
            }
          }}
          title={isPaid ? 'Klik untuk melihat rincian riwayat angsuran' : undefined}
        >
          <PrivacyText>
            {isPaid ? ctx.fmt(parseFloat(original.paid_amount || original.harga || 0)) : '-'}
          </PrivacyText>
        </div>
      )
    },
  })

  columns.push({
    accessorKey: 'status',
    header: ({ column }) => {
      return (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const original = row.original
      if (original.status === 'paid') {
        if (parseFloat(original.paid_amount || 0) < parseFloat(original.harga || 0)) {
          return (
            <div className="flex flex-col items-center gap-1">
              <Badge className="mx-auto flex w-[84px] items-center justify-center gap-1 border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400 rounded-full shadow-sm shadow-amber-500/5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                Kurang
              </Badge>
              <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 tracking-wider">
                -{ctx.fmt(parseFloat(original.harga || 0) - parseFloat(original.paid_amount || 0))}
              </span>
            </div>
          )
        }
        return (
          <div className="flex flex-col items-center gap-1">
            <Badge className="mx-auto flex w-[84px] items-center justify-center gap-1 border border-emerald-500 bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white uppercase hover:bg-emerald-600 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-full shadow-sm shadow-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
              Lunas
            </Badge>
            {original.note && original.note.includes('[Angsuran:') ? (
              <span
                onClick={() => ctx.setHistoryUser({ id: original.user_id, username: original.username })}
                className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-0.5 select-none bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer px-1.5 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-900/20 mt-0.5 scale-95 shadow-2xs transition-all duration-150"
                title="Klik untuk melihat rincian riwayat angsuran"
              >
                <History className="h-2.5 w-2.5 text-indigo-500 shrink-0" /> Angsuran
              </span>
            ) : original.method === 'titipan' ? (
              <div
                className="mt-1 mx-auto flex w-[84px] items-center justify-center gap-1 rounded border border-dashed border-pink-300 bg-pink-50/80 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-pink-700 uppercase shadow-xs dark:border-pink-500/40 dark:bg-pink-500/10 dark:text-pink-400 cursor-help"
                title="Dana Titipan (Di luar Pemasukan Sistem)"
              >
                <Wallet className="h-2.5 w-2.5 shrink-0" />
                Titipan
              </div>
            ) : original.method?.toLowerCase() === 'cash' ? (
              <div
                className="mt-1 mx-auto flex w-[84px] items-center justify-center gap-1 rounded border border-emerald-200 bg-emerald-50/50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-700 uppercase shadow-xs dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400"
              >
                <Banknote className="h-2.5 w-2.5 shrink-0" />
                Cash
              </div>
            ) : original.method?.toLowerCase() === 'transfer' ? (
              <div
                className="mt-1 mx-auto flex w-[84px] items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50/50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-blue-700 uppercase shadow-xs dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-400"
              >
                <Landmark className="h-2.5 w-2.5 shrink-0" />
                Transfer
              </div>
            ) : original.method?.toLowerCase() === 'qris' ? (
              <div
                className="mt-1 mx-auto flex w-[84px] items-center justify-center gap-1 rounded border border-purple-200 bg-purple-50/50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-purple-700 uppercase shadow-xs dark:border-purple-500/20 dark:bg-purple-500/5 dark:text-purple-400"
              >
                <QrCode className="h-2.5 w-2.5 shrink-0" />
                QRIS
              </div>
            ) : ['e-wallet', 'ewallet'].includes(original.method?.toLowerCase()) ? (
              <div
                className="mt-1 mx-auto flex w-[84px] items-center justify-center gap-1 rounded border border-orange-200 bg-orange-50/50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-orange-700 uppercase shadow-xs dark:border-orange-500/20 dark:bg-orange-500/5 dark:text-orange-400"
              >
                <Smartphone className="h-2.5 w-2.5 shrink-0" />
                E-Wallet
              </div>
            ) : original.method ? (
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{original.method}</span>
            ) : null}
          </div>
        )
      }
      return (
        <Badge className="mx-auto flex w-[84px] items-center justify-center gap-1 border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400 rounded-full shadow-sm shadow-amber-500/5">
          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          Belum
        </Badge>
      )
    },
  })

  columns.push({
    accessorKey: 'paid_at',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider"
        >
          Tgl Bayar
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const original = row.original
      return (
        <div className="text-xs font-semibold text-muted-foreground/80">
          {original.paid_at || '-'}
          {original.note && (
            <div className="text-[10px] text-muted-foreground/60 italic max-w-[120px] truncate" title={original.note}>
              {original.note}
            </div>
          )}
        </div>
      )
    },
  })

  if (ctx.permissions.canManageFinance) {
    columns.push({
      id: 'actions',
      header: () => <div className="text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pr-4">Aksi</div>,
      cell: ({ row }) => {
        const original = row.original
        return (
          <div className="flex justify-end gap-1.5 pr-4">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'h-8 w-8 transition-all duration-200 rounded-lg shadow-sm',
                original.status === 'paid'
                  ? 'border-emerald-100 text-emerald-600 bg-emerald-50/30 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400 dark:bg-emerald-950/10'
                  : 'border-amber-100 text-amber-600 bg-amber-50/30 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-400 dark:bg-amber-950/10'
              )}
              onClick={() => ctx.handleWA(original)}
              title={original.status === 'paid' ? 'Kirim Kwitansi via WA' : 'Kirim Tagihan via WA'}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            {original.status === 'paid' ? (
              <Button
                size="icon"
                className="h-8 w-8 bg-blue-500 text-white shadow-sm shadow-blue-500/10 transition-all duration-200 hover:bg-blue-600 hover:shadow-blue-500/25 rounded-lg"
                onClick={() => ctx.setPaidDialog(original)}
                title="Edit Pembayaran"
              >
                <PenLine className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8 bg-emerald-500 text-white shadow-sm shadow-emerald-500/10 transition-all duration-200 hover:bg-emerald-600 hover:shadow-emerald-500/25 rounded-lg"
                onClick={() => ctx.setPaidDialog(original)}
                title="Tandai Lunas"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg shadow-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 shadow-xl rounded-xl">
                <DropdownMenuItem
                  onClick={() => printThermal(original, ctx.month, ctx.year)}
                  className="cursor-pointer"
                >
                  <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
                  Cetak Struk Thermal
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => printInvoice(original, ctx.month, ctx.year)}
                  className="cursor-pointer"
                >
                  <Printer className="mr-2 h-4 w-4 text-muted-foreground" />
                  Cetak Invoice PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => ctx.setHistoryUser({ id: original.user_id, username: original.username })}
                  className="cursor-pointer"
                >
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  Riwayat Pembayaran
                </DropdownMenuItem>

                {original.status === 'paid' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        const ok = await ctx.confirmAction({
                          title: 'Batalkan Pembayaran',
                          description: `Apakah Anda yakin ingin membatalkan status lunas untuk pelanggan ${original.username}?`,
                          confirmText: 'Batalkan',
                          cancelText: 'Batal',
                          variant: 'destructive',
                        })
                        if (ok) ctx.markUnpaid(original.payment_id)
                      }}
                      className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/50"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Batalkan Pembayaran
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    })
  }

  return columns
}
