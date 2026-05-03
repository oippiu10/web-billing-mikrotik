import { useMemo, useState } from 'react'
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [pageSize, setPageSize] = useState(20)

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

  const preparedData = useMemo(() => data.map((device) => ({
    ...device,
    __online: isDeviceOnline(device),
    __pppoe: getParam(device, 'VirtualParameters.pppoeUsername') || 'No ID',
    __model: getParam(device, 'Device.DeviceInfo.ProductClass') || getParam(device, 'InternetGatewayDevice.DeviceInfo.ModelName') || 'Unknown',
    __manufacturer: getParam(device, 'Device.DeviceInfo.Manufacturer') || getParam(device, 'InternetGatewayDevice.DeviceInfo.Manufacturer') || '',
    __rx: getParam(device, 'VirtualParameters.RXPower'),
    __temp: getParam(device, 'VirtualParameters.gettemp'),
    __wifiClients: getParam(device, 'VirtualParameters.activedevices') || '0',
    __connectionUrl: getParam(device, 'Device.ManagementServer.ConnectionRequestURL') || getParam(device, 'InternetGatewayDevice.ManagementServer.ConnectionRequestURL') || '',
  })), [data])

  const buildTaskPayload = (action: string) => {
    if (action === 'summon') {
      return {
        name: 'getParameterValues',
        parameterNames: [
          'Device.DeviceInfo.SerialNumber',
          'InternetGatewayDevice.DeviceInfo.SerialNumber',
          'Device.ManagementServer.ConnectionRequestURL',
          'InternetGatewayDevice.ManagementServer.ConnectionRequestURL',
        ],
      }
    }
    if (action === 'refreshObject') return { name: 'refreshObject', objectName: '' }
    return { name: action }
  }

  const actionMutation = useMutation({
    mutationFn: async ({ deviceId, action, connectionRequest = false }: { deviceId: string; action: string; connectionRequest?: boolean }) => {
      const suffix = connectionRequest ? '&connection_request=true' : ''
      const res = await api.post(`/genieacs_proxy.php?path=/devices/${encodeURIComponent(deviceId)}/tasks${suffix}`, buildTaskPayload(action))
      return res.data
    },
    onSuccess: () => {
      toast.success('Command queued successfully')
      queryClient.invalidateQueries({ queryKey: ['genieacs-devices'] })
      queryClient.invalidateQueries({ queryKey: ['acs-center-devices'] })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.error || error.response?.data?.message || error.response?.data || error.message
      toast.error(typeof detail === 'string' ? detail : 'Failed to send command')
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
      accessorFn: (row) => row.__pppoe || 'No ID',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Client ID' icon={<User className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => <span className="font-bold text-teal-600 dark:text-teal-400">{row.original.__pppoe === 'No ID' ? '-' : row.original.__pppoe}</span>,
    },
    {
      id: 'model',
      accessorFn: (row) => row.__model || 'Unknown',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Model' icon={<Monitor className="w-4 h-4 mr-1"/>} />,
      cell: ({ row }) => {
        const model = row.original.__model || 'Unknown'
        const mfr = row.original.__manufacturer || ''
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
        accessorFn: (row) => parseFloat(row.__rx) || 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title='RX Power' icon={<Zap className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const rx = row.original.__rx
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
        accessorFn: (row) => parseFloat(row.__temp) || 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Temp' icon={<Activity className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const temp = row.original.__temp
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
        accessorFn: (row) => row.__wifiClients || '0',
        header: ({ column }) => <DataTableColumnHeader column={column} title='WiFi' icon={<Wifi className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const active = row.original.__wifiClients || '0'
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
            const url = row.__connectionUrl || ''
            const match = url.match(/https?:\/\/([^:/]+)/)
            return match ? match[1] : 'N/A'
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='IP Address' icon={<Globe className="w-4 h-4 mr-1"/>} />,
        cell: ({ row }) => {
            const url = row.original.__connectionUrl || ''
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
                onClick={() => actionMutation.mutate({ deviceId: device._id, action: 'summon', connectionRequest: true })}
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

  const filteredData = useMemo(() => preparedData.filter((device) => {
    if (statusFilter === 'online') return device.__online
    if (statusFilter === 'offline') return !device.__online
    return true
  }), [preparedData, statusFilter])

  const offlineCount = useMemo(() => preparedData.filter((device) => !device.__online).length, [preparedData])
  const onlineCount = preparedData.length - offlineCount

  const table = useReactTable({
    data: filteredData,
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
    initialState: {
      pagination: { pageSize },
    },
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
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[10px] uppercase font-black"
                        onClick={() => {
                            const selectedIds = table.getFilteredSelectedRowModel().rows.map(r => r.original._id)
                            toast.promise(Promise.allSettled(selectedIds.map(id => actionMutation.mutateAsync({ deviceId: id, action: 'summon', connectionRequest: true }))), {
                                loading: `Summon ${selectedIds.length} selected CPE...`,
                                success: 'Summon selected selesai dikirim',
                                error: 'Sebagian summon gagal dikirim'
                            })
                            setRowSelection({})
                        }}
                    >
                        <RadioTower className="w-3 h-3 mr-1" />
                        Summon Selected ({Object.keys(rowSelection).length})
                    </Button>
                </div>
            )}
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <select
            className='h-8 rounded-md border bg-background px-2 text-xs'
            value={pageSize}
            onChange={(e) => {
              const size = Number(e.target.value)
              setPageSize(size)
              table.setPageSize(size)
            }}
          >
            <option value={10}>10/baris</option>
            <option value={20}>20/baris</option>
            <option value={50}>50/baris</option>
            <option value={100}>100/baris</option>
          </select>
          <div className='flex items-center rounded-md border bg-background p-1'>
            <Button size='sm' variant={statusFilter === 'all' ? 'secondary' : 'ghost'} className='h-7 px-2 text-xs' onClick={() => setStatusFilter('all')}>All {data.length}</Button>
            <Button size='sm' variant={statusFilter === 'online' ? 'secondary' : 'ghost'} className='h-7 px-2 text-xs text-emerald-600' onClick={() => setStatusFilter('online')}>Online {onlineCount}</Button>
            <Button size='sm' variant={statusFilter === 'offline' ? 'secondary' : 'ghost'} className='h-7 px-2 text-xs text-red-600' onClick={() => setStatusFilter('offline')}>Offline {offlineCount}</Button>
          </div>
          <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const offlineIds = filteredData.filter((d) => !isDeviceOnline(d)).map((d) => d._id)
                if (!offlineIds.length) return toast.success('Tidak ada CPE offline')
                if (!confirm(`Summon ${offlineIds.length} CPE offline via Connection Request?`)) return
                toast.promise(Promise.allSettled(offlineIds.map(id => actionMutation.mutateAsync({ deviceId: id, action: 'summon', connectionRequest: true }))), {
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
      <div className='overflow-x-auto rounded-md border'>
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
                  className='hover:bg-muted/30 cursor-pointer'
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
