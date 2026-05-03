import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar, DataTableColumnHeader } from '@/components/data-table'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, RefreshCw, Power, Monitor, Wifi, User, Zap, Activity, Globe, RadioTower } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
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
import { toast } from 'sonner'
import { DeviceDetailDialog } from './device-detail-dialog'
import { Info } from 'lucide-react'

export interface GenieACSDevice {
  _id: string
  '_lastInform'?: string
  [key: string]: any // Memungkinkan akses dinamis ke parameter TR-069
}

interface Props {
  data: GenieACSDevice[]
  isLoading: boolean
}

export function GenieACSDeviceTable({ data, isLoading }: Props) {
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const safeText = (value: any): string => {
    if (value === null || value === undefined || value === '') return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value?._value !== undefined) return safeText(value._value)
    if (value?.value !== undefined) return safeText(value.value)
    if (value?._object !== undefined) return ''
    return ''
  }

  // Fungsi pembantu untuk mengambil nilai dari object bersarang (nested)
  const getParam = (row: any, path: string) => {
    if (!row) return ''
    if (row[path] !== undefined) return safeText(row[path])

    const parts = path.split('.')
    let current = row
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) current = current[part]
      else return ''
    }
    return safeText(current)
  }

  const isDeviceOnline = (device: GenieACSDevice) => {
    if (!device._lastInform) return false
    return new Date(device._lastInform).getTime() > Date.now() - 5 * 60 * 1000
  }

  const actionMutation = useMutation({
    mutationFn: async ({ deviceId, action, connectionRequest = false }: { deviceId: string; action: string; connectionRequest?: boolean }) => {
      const suffix = connectionRequest ? '&connection_request' : ''
      const res = await api.post(`/genieacs_proxy.php?path=/devices/${encodeURIComponent(deviceId)}/tasks${suffix}`, {
        name: action
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Command queued successfully')
      queryClient.invalidateQueries({ queryKey: ['genieacs-devices'] })
      queryClient.invalidateQueries({ queryKey: ['acs-center-devices'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send command')
    }
  })

  const columns: ColumnDef<GenieACSDevice>[] = [
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
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
        id: 'no',
        header: ({ column }) => <DataTableColumnHeader column={column} title='No' />,
        cell: ({ row }) => <span className="text-[11px] font-mono text-muted-foreground">{row.index + 1}</span>,
        enableSorting: false,
    },
    {
      accessorKey: '_id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Device ID' />,
      cell: ({ row }) => <span className="font-mono text-[10px] text-muted-foreground">{row.getValue('_id')}</span>,
    },
    {
      id: 'client_id',
      accessorFn: (row) => getParam(row, 'VirtualParameters.pppoeUsername') || 'No ID',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Client ID' icon={<User className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => <span className="font-bold text-teal-600 dark:text-teal-400">{getParam(row.original, 'VirtualParameters.pppoeUsername') || '-'}</span>,
    },
    {
      id: 'model',
      accessorFn: (row) => 
        getParam(row, 'Device.DeviceInfo.ProductClass') || 
        getParam(row, 'InternetGatewayDevice.DeviceInfo.ModelName') || 
        'Unknown',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Model' icon={<Monitor className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => {
        const model = getParam(row.original, 'Device.DeviceInfo.ProductClass') || 
                      getParam(row.original, 'InternetGatewayDevice.DeviceInfo.ModelName') || 
                      'Unknown'
        const mfr = getParam(row.original, 'Device.DeviceInfo.Manufacturer') || 
                    getParam(row.original, 'InternetGatewayDevice.DeviceInfo.Manufacturer') || 
                    ''
        return (
            <div className="flex flex-col">
              <span className="font-bold text-xs">{model}</span>
              <span className="text-[10px] text-muted-foreground">{mfr}</span>
            </div>
        )
      },
    },
    {
        id: 'rx_power',
        accessorFn: (row) => parseFloat(getParam(row, 'VirtualParameters.RXPower')) || 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title='RX Power' icon={<Zap className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const rx = getParam(row.original, 'VirtualParameters.RXPower')
            if (!rx || rx === 'N/A') return <span className="text-muted-foreground text-xs">-</span>
            const val = parseFloat(rx)
            let status = { label: 'Bagus', color: 'bg-emerald-500/10 text-emerald-500' }
            if (val < -27) status = { label: 'Buruk', color: 'bg-destructive/10 text-destructive' }
            else if (val < -24) status = { label: 'Lumayan', color: 'bg-orange-500/10 text-orange-500' }
            
            return (
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-bold">{val} dBm</span>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1 border-0", status.color)}>
                        {status.label}
                    </Badge>
                </div>
            )
        },
    },
    {
        id: 'temp',
        accessorFn: (row) => parseFloat(getParam(row, 'VirtualParameters.gettemp')) || 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Temp' icon={<Activity className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const temp = getParam(row.original, 'VirtualParameters.gettemp')
            if (!temp || temp === 'N/A') return <span className="text-muted-foreground text-xs">-</span>
            const val = parseFloat(temp)
            let status = { label: 'Normal', color: 'text-emerald-500' }
            if (val > 65) status = { label: 'Panas', color: 'text-destructive' }
            else if (val > 50) status = { label: 'Anget', color: 'text-orange-500' }
            
            return (
                <div className="flex flex-col">
                    <span className="text-xs font-bold">{val} °C</span>
                    <span className={cn("text-[9px] font-black uppercase", status.color)}>{status.label}</span>
                </div>
            )
        },
    },
    {
        id: 'wifi',
        accessorFn: (row) => getParam(row, 'VirtualParameters.activedevices') || '0',
        header: ({ column }) => <DataTableColumnHeader column={column} title='WiFi' icon={<Wifi className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const active = getParam(row.original, 'VirtualParameters.activedevices') || '0'
            return (
                <div className="flex items-center gap-1">
                    <Badge className="bg-blue-500/10 text-blue-500 border-0 text-xs font-black">
                        {active}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">clients</span>
                </div>
            )
        },
    },
    {
        id: 'ip',
        accessorFn: (row) => {
            const url = getParam(row, 'Device.ManagementServer.ConnectionRequestURL') || 
                        getParam(row, 'InternetGatewayDevice.ManagementServer.ConnectionRequestURL') || 
                        ''
            const match = url.match(/https?:\/\/([^:/]+)/)
            return match ? match[1] : 'N/A'
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='IP Address' icon={<Globe className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const url = getParam(row.original, 'Device.ManagementServer.ConnectionRequestURL') || 
                        getParam(row.original, 'InternetGatewayDevice.ManagementServer.ConnectionRequestURL') || 
                        ''
            const match = url.match(/https?:\/\/([^:/]+)/)
            const ip = match ? match[1] : 'N/A'
            return <span className="font-mono text-[10px] text-muted-foreground">{ip}</span>
        },
    },
    {
      accessorKey: '_lastInform',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Last Inform' />,
      cell: ({ row }) => {
          const date = row.getValue('_lastInform') ? new Date(row.getValue('_lastInform') as string) : null
          return (
              <div className="flex flex-col min-w-[100px]">
                  <span className="text-[10px] font-bold">{date ? date.toLocaleString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'}</span>
                  <span className="text-[9px] text-muted-foreground">
                      {date ? `${Math.floor((new Date().getTime() - date.getTime()) / 1000 / 60)} mins ago` : ''}
                  </span>
              </div>
          )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const device = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Device Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                    setSelectedDeviceId(device._id)
                    setDetailDialogOpen(true)
                }}
                className="cursor-pointer"
              >
                <Info className="w-4 h-4 mr-2" />
                View Full Insights
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => actionMutation.mutate({ deviceId: device._id, action: 'reboot' })}
                className="cursor-pointer text-orange-600 focus:text-orange-600"
              >
                <Power className="w-4 h-4 mr-2" />
                Reboot Device
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => actionMutation.mutate({ deviceId: device._id, action: 'refreshObject', connectionRequest: true })}
                className="cursor-pointer"
              >
                <RadioTower className="w-4 h-4 mr-2" />
                Summon / Connection Request
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => actionMutation.mutate({ deviceId: device._id, action: 'refreshObject' })}
                className="cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Queue Refresh Data
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
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
            <DataTableToolbar
                table={table}
                searchPlaceholder='Search devices...'
            />
            {Object.keys(rowSelection).length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <Separator orientation="vertical" className="h-6" />
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        className="h-8 text-[10px] uppercase font-black"
                        onClick={() => {
                            const selectedIds = table.getFilteredSelectedRowModel().rows.map(r => r.original._id)
                            toast.promise(Promise.all(selectedIds.map(id => actionMutation.mutateAsync({ deviceId: id, action: 'reboot' }))), {
                                loading: 'Queuing mass reboot...',
                                success: 'All reboot commands queued!',
                                error: 'Failed to queue some commands'
                            })
                            setRowSelection({})
                        }}
                    >
                        <Power className="w-3 h-3 mr-1" />
                        Mass Reboot ({Object.keys(rowSelection).length})
                    </Button>
                </div>
            )}
        </div>
        <div className='flex items-center gap-2'>
          <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const offlineIds = data.filter((d) => !isDeviceOnline(d)).map((d) => d._id)
                if (!offlineIds.length) return toast.success('Tidak ada CPE offline')
                if (!confirm(`Summon ${offlineIds.length} CPE offline via Connection Request?`)) return
                toast.promise(Promise.allSettled(offlineIds.map(id => actionMutation.mutateAsync({ deviceId: id, action: 'refreshObject', connectionRequest: true }))), {
                  loading: `Mengirim summon ke ${offlineIds.length} CPE offline...`,
                  success: 'Summon offline selesai dikirim',
                  error: 'Sebagian summon gagal dikirim'
                })
              }}
              disabled={isLoading || actionMutation.isPending}
          >
              <RadioTower className={cn("w-3 h-3 mr-2", actionMutation.isPending && "animate-pulse")} />
              Summon Offline
          </Button>
          <Button 
              variant="outline" 
              size="sm" 
              className="h-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['genieacs-devices'] })}
              disabled={isLoading}
          >
              <RefreshCw className={cn("w-3 h-3 mr-2", isLoading && "animate-spin")} />
              Sync Now
          </Button>
        </div>
      </div>
      <div className='overflow-hidden rounded-xl border bg-card/50 backdrop-blur-md shadow-lg'>
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">Fetching from ACS Server...</TableCell></TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  className='hover:bg-muted/30 transition-colors cursor-pointer group'
                  onClick={(e) => {
                      // Jangan buka dialog jika mengklik checkbox atau menu aksi
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-state]') || target.closest('button') || target.closest('input')) return;
                      
                      setSelectedDeviceId(row.original._id)
                      setDetailDialogOpen(true)
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-32 text-center text-muted-foreground font-bold'>
                  No CPE devices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />

      <DeviceDetailDialog 
        deviceId={selectedDeviceId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
