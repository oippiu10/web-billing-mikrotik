import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { type Customer } from '../data/schema'
import { PrivacyText } from '@/components/privacy'
import { Activity, Shield, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const mapsUrl = (customer: Customer) => {
  if (customer.lat && customer.lng) return `https://www.google.com/maps?q=${customer.lat},${customer.lng}`
  return customer.maps || ''
}

export const columns: ColumnDef<Customer>[] = [
  {
    id: 'rowNumber',
    header: 'No.',
    cell: ({ row }) => <span className='text-xs text-muted-foreground'>{row.index + 1}</span>,
  },
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-0.5'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label='Select row'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Username' />
    ),
    cell: ({ row }) => {
        const username = row.getValue('username') as string
        return (
            <div className="flex items-center gap-2">
                <LongText className='max-w-36 font-semibold'><PrivacyText>{username}</PrivacyText></LongText>
            </div>
        )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'profile',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Paket' />
    ),
    cell: ({ row }) => <Badge variant='secondary'>{row.getValue('profile')}</Badge>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const isOnline = status === 'online'
      return (
        <div className='flex items-center gap-1'>
          <Activity className={cn('h-3 w-3', isOnline ? 'text-green-500' : 'text-destructive')} />
          <Badge 
            variant='outline' 
            className={cn(
              'capitalize',
              isOnline 
                ? 'border-green-500 text-green-600 bg-green-50' 
                : 'border-destructive text-destructive bg-destructive/10'
            )}
          >
            {status}
          </Badge>
        </div>
      )
    },
    enableSorting: true,
  },
  {
      accessorKey: 'disabled',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Active' />
      ),
      cell: ({ row }) => {
        const disabled = row.getValue('disabled') === 'yes'
        return (
          <div className="flex items-center gap-1.5">
             <Shield className={cn("h-4 w-4", disabled ? "text-destructive" : "text-green-600")} />
             <span className={cn("text-xs font-medium", disabled ? "text-destructive" : "text-green-600")}>
                {disabled ? 'Disabled' : 'Enabled'}
             </span>
          </div>
        )
      }
  },
  {
    accessorKey: 'remote-address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='IP Address' />
    ),
    cell: ({ row }) => <div className='font-mono text-xs'><PrivacyText>{row.getValue('remote-address') as string}</PrivacyText></div>,
  },
  {
    accessorKey: 'wa',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='WhatsApp' />
    ),
    cell: ({ row }) => {
        const wa = row.getValue('wa') as string
        if (!wa || wa === '0' || wa === '-') return <span className="text-muted-foreground">-</span>
        return <div className="text-xs"><PrivacyText>{wa}</PrivacyText></div>
    },
  },
  {
    accessorKey: 'redaman',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Redaman' />
    ),
    cell: ({ row }) => {
        const val = row.getValue('redaman') as string
        if (!val) return '-'
        return (
            <Badge variant='outline' className='font-mono text-[10px] border-blue-200 text-blue-700 bg-blue-50'>
                {val} dB
            </Badge>
        )
    },
  },
  {
    accessorKey: 'odp_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='ODP' />
    ),
    cell: ({ row }) => <div className="text-xs font-bold text-blue-600">{row.getValue('odp_name') || '-'}</div>,
  },
  {
    accessorKey: 'alamat',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Alamat' />
    ),
    cell: ({ row }) => (
        <LongText className='max-w-48 text-xs'><PrivacyText>{row.getValue('alamat') || '-'}</PrivacyText></LongText>
    ),
  },
  {
    accessorKey: 'maps',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lokasi' />
    ),
    cell: ({ row }) => {
        const url = mapsUrl(row.original)
        if (!url) return <span className='text-[10px] text-muted-foreground'>Belum ada</span>
        return (
            <div className='flex flex-col gap-1'>
              <Button 
                  variant='ghost' 
                  size='sm' 
                  className='h-7 px-2 text-[10px] text-blue-600' 
                  onClick={(e) => e.stopPropagation()}
                  asChild
              >
                  <a href={url} target='_blank' rel='noreferrer'>Buka Maps</a>
              </Button>
              {(!row.original.lat || !row.original.lng) && <span className='text-[9px] text-amber-600'>link saja</span>}
            </div>
        )
    }
  },
  {
    accessorKey: 'tanggal_tagihan',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tagihan' />
    ),
    cell: ({ row }) => <div className="text-xs">{row.getValue('tanggal_tagihan')}</div>,
  },
  {
    accessorKey: 'tanggal_dibuat',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tgl Pasang' />
    ),
    cell: ({ row }) => {
        const val = row.getValue('tanggal_dibuat')
        if (!val) return <span className='text-[10px] text-muted-foreground'>-</span>
        return (
            <div className='text-[10px] text-muted-foreground whitespace-nowrap'>
                {val.toString().split(' ')[0]}
            </div>
        )
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => {
      const customer = row.original
      const { onEdit, onDelete, canEdit, canDelete } = table.options.meta as any
      if (!canEdit && !canDelete) return null
      
      return (
        <div className="flex justify-end">
            <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Buka menu</span>
                <MoreHorizontal className='h-4 w-4' />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit?.(customer)}>
                      <Pencil className='mr-2 h-4 w-4' /> Edit Pelanggan
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                      onClick={() => onDelete?.(customer)}
                      className='text-destructive focus:text-destructive'
                  >
                      <Trash2 className='mr-2 h-4 w-4' /> Hapus Pelanggan
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
