import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { type ODP } from '../data/schema'
import { MapPin, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const columns: ColumnDef<ODP>[] = [
  {
    id: 'rowNumber',
    header: 'No.',
    cell: ({ row }) => <span className='text-xs text-muted-foreground'>{row.index + 1}</span>,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Nama ODP' />
    ),
    cell: ({ row }) => <div className='font-bold'>{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tipe' />
    ),
    cell: ({ row }) => {
      const type = row.getValue('type') as string
      return (
        <Badge variant={type === 'splitter' ? 'default' : 'secondary'} className='capitalize'>
          {type}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'splitter_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kapasitas' />
    ),
    cell: ({ row }) => {
        const type = row.original.type
        if (type === 'splitter') return row.getValue('splitter_type') || '-'
        return `${row.original.ratio_used}/${row.original.ratio_total}`
    },
  },
  {
    accessorKey: 'total_users',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Terpakai' />
    ),
    cell: ({ row }) => {
        const count = row.getValue('total_users') as number
        return (
            <div className='flex items-center gap-1.5'>
                <Users className='h-3.5 w-3.5 text-muted-foreground' />
                <span className='font-medium'>{count} User</span>
            </div>
        )
    }
  },
  {
    accessorKey: 'location',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lokasi' />
    ),
    cell: ({ row }) => {
        const loc = row.getValue('location') as string
        const maps = row.original.maps_link
        return (
            <div className='flex items-center gap-2 max-w-48'>
                <MapPin className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                <span className='text-xs truncate'>{loc}</span>
                {maps && (
                    <a 
                        href={maps} 
                        target='_blank' 
                        rel='noreferrer' 
                        className='text-primary hover:underline ml-auto shrink-0'
                        onClick={(e) => e.stopPropagation()}
                    >
                        Maps
                    </a>
                )}
            </div>
        )
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => {
      const odp = row.original
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
                  <DropdownMenuItem onClick={() => onEdit?.(odp)}>
                      <Pencil className='mr-2 h-4 w-4' /> Edit ODP
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                      onClick={() => onDelete?.(odp)}
                      className='text-destructive focus:text-destructive'
                  >
                      <Trash2 className='mr-2 h-4 w-4' /> Hapus ODP
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
