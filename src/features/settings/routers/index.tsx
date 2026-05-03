import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Plus, Settings2, Trash2, Activity, Router, Wifi, ChevronLeft, ChevronRight } from 'lucide-react'
import { RouterDialog } from './components/router-dialog'
import { TestConnectionDialog } from './components/test-connection-dialog'
import { useRouterStore } from '@/stores/router-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePermission } from '@/lib/permissions'

export interface RouterData {
  id: number
  name: string
  host: string
  port: number
  username: string
  is_active: number
  software_id?: string
  total_customers?: number
}

export default function RoutersPage() {
  const queryClient = useQueryClient()
  const { setActiveRouter } = useRouterStore()
  const permissions = usePermission()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRouter, setSelectedRouter] = useState<RouterData | undefined>()
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [testRouter, setTestRouter] = useState<RouterData | undefined>()
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Data Fetching
  const { data: routers = [], isLoading } = useQuery<RouterData[]>({
    queryKey: ['routers'],
    queryFn: async () => {
      const res = await api.get('/routers.php')
      return res.data.data
    },
  })

  // Pagination Logic
  const totalItems = routers.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentRouters = routers.slice(startIndex, endIndex)

  // Mutations
  const setActiveMutation = useMutation({
    mutationFn: async (router: RouterData) => {
      await api.patch('/routers.php', { id: router.id })
      return router
    },
    onSuccess: (router) => {
      setActiveRouter(router)
      queryClient.resetQueries()
      toast.success(`Monitoring berhasil berpindah ke router ${router.name}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete('/routers.php', { params: { id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] })
      toast.success('Router berhasil dihapus')
    },
  })

  return (
    <div className='p-1 space-y-6 animate-in fade-in duration-500'>
      <div className='flex items-end justify-between'>
        <div className='space-y-1'>
          <h2 className='text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent'>
            Manajemen Router
          </h2>
          <p className='text-sm text-muted-foreground flex items-center gap-2'>
            <Router className='h-4 w-4' />
            Pilih router aktif untuk monitoring. Total {totalItems} router.
          </p>
        </div>
        {permissions.canManageRouter && (
          <Button 
            onClick={() => { setSelectedRouter(undefined); setIsDialogOpen(true); }}
            className='bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
          >
            <Plus className='mr-2 h-4 w-4' /> Tambah Router
          </Button>
        )}
      </div>

      <Card className='overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-xl ring-1 ring-border/50'>
        <ScrollArea className='h-[calc(100vh-340px)] w-full'>
          <Table>
            <TableHeader className='bg-muted/30 sticky top-0 z-10 backdrop-blur-md'>
              <TableRow className='hover:bg-transparent border-b border-border/50'>
                <TableHead className='pl-6 w-[120px] text-xs uppercase tracking-widest font-bold text-muted-foreground'>Pilih Aktif</TableHead>
                <TableHead className='text-xs uppercase tracking-widest font-bold text-muted-foreground py-4'>Identitas Perangkat</TableHead>
                <TableHead className='w-[150px] text-center text-xs uppercase tracking-widest font-bold text-muted-foreground'>Koneksi</TableHead>
                <TableHead className='w-[100px] text-center text-xs uppercase tracking-widest font-bold text-muted-foreground'>User</TableHead>
                <TableHead className='pr-6 text-right text-xs uppercase tracking-widest font-bold text-muted-foreground'>Kontrol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className='text-center py-20 text-muted-foreground italic animate-pulse'>Memuat data...</TableCell></TableRow>
              ) : currentRouters.length === 0 ? (
                <TableRow><TableCell colSpan={5} className='text-center py-20 text-muted-foreground'>Belum ada router.</TableCell></TableRow>
              ) : (
                currentRouters.map((router) => (
                  <TableRow 
                    key={router.id} 
                    className={cn(
                      'group transition-colors border-b border-border/30 last:border-0',
                      router.is_active ? 'bg-primary/[0.03]' : 'hover:bg-primary/[0.01]'
                    )}
                  >
                    <TableCell className='pl-6'>
                      <div className='flex flex-col items-center gap-1'>
                        <Switch 
                          checked={!!router.is_active}
                          onCheckedChange={(checked) => {
                            if (checked && permissions.canManageRouter) setActiveMutation.mutate(router)
                          }}
                          disabled={!permissions.canManageRouter}
                          className='data-[state=checked]:bg-green-500 cursor-pointer'
                        />
                        <span className={cn(
                          'text-[8px] font-black uppercase tracking-tighter',
                          router.is_active ? 'text-green-600' : 'text-muted-foreground/50'
                        )}>
                          {router.is_active ? 'MONITORING' : 'OFF'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='py-4'>
                        <div className='flex items-center gap-3'>
                            <div className={cn(
                              'h-10 w-10 rounded-xl flex items-center justify-center ring-1 transition-all shadow-sm',
                              router.is_active 
                                ? 'bg-gradient-to-br from-green-500/20 to-green-500/10 ring-green-500/40' 
                                : 'bg-gradient-to-br from-primary/10 to-primary/5 ring-primary/20 group-hover:ring-primary/40'
                            )}>
                                <Wifi className={cn('h-5 w-5', router.is_active ? 'text-green-600' : 'text-primary')} />
                            </div>
                            <div className='flex flex-col space-y-0.5'>
                                <span className={cn('text-sm font-bold tracking-tight transition-colors', router.is_active && 'text-green-700')}>
                                  {router.name.replace('Router-', '') || 'MikroTik Router'}
                                </span>
                                <div className='flex items-center gap-2'>
                                  <span className='text-[11px] text-muted-foreground font-mono'>
                                    {router.software_id || '---'}
                                  </span>
                                  {router.software_id && (
                                    <div className='h-1 w-1 rounded-full bg-muted-foreground/30' />
                                  )}
                                  <span className='text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter'>
                                    {router.is_active ? 'Active Node' : 'Standby'}
                                  </span>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className='text-center'>
                      <div className='inline-flex items-center justify-center px-2 py-1 rounded-lg bg-muted/30 text-[11px] font-mono font-medium text-muted-foreground ring-1 ring-border/50'>
                        {router.host && !router.host.includes('-') ? `${router.host}:${router.port}` : '???.???.???.???' }
                      </div>
                    </TableCell>
                    <TableCell className='text-center'>
                      <div className='flex flex-col items-center justify-center'>
                        <span className={cn('text-md font-black', router.is_active ? 'text-green-700' : 'text-foreground')}>
                          {router.total_customers ?? 0}
                        </span>
                        <span className='text-[9px] uppercase font-bold text-muted-foreground tracking-tighter'>Users</span>
                      </div>
                    </TableCell>
                    <TableCell className='pr-6 text-right space-x-1'>
                        <Button 
                          variant='ghost' 
                          size='icon' 
                          className='h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all'
                          onClick={() => { setTestRouter(router); setIsTestOpen(true); }}
                        >
                            <Activity className='h-4 w-4' />
                        </Button>
                        {permissions.canManageRouter && (
                          <Button 
                            variant='ghost' 
                            size='icon' 
                            className='h-8 w-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 transition-all'
                            onClick={() => { setSelectedRouter(router); setIsDialogOpen(true); }}
                          >
                              <Settings2 className='h-4 w-4' />
                          </Button>
                        )}
                        {permissions.canManageRouter && (
                          <Button 
                            variant='ghost' 
                            size='icon' 
                            className='h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all'
                            onClick={() => { 
                              if (confirm('Hapus router ini?')) deleteMutation.mutate(router.id) 
                            }}
                          >
                              <Trash2 className='h-4 w-4' />
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        
        {/* Pagination Bar */}
        <div className='px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between'>
          <p className='text-xs text-muted-foreground'>
            Menampilkan <span className='font-bold text-foreground'>{totalItems > 0 ? startIndex + 1 : 0}</span> sampai <span className='font-bold text-foreground'>{Math.min(endIndex, totalItems)}</span> dari <span className='font-bold text-foreground'>{totalItems}</span> router
          </p>
          
          {totalPages > 1 && (
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='h-8 w-8 p-0'
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              
              <div className='flex items-center gap-1'>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'ghost'}
                    size='sm'
                    className={cn(
                      'h-8 w-8 p-0 text-xs font-bold',
                      currentPage === page ? 'shadow-lg shadow-primary/20' : ''
                    )}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant='outline'
                size='sm'
                className='h-8 w-8 p-0'
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          )}
        </div>
      </Card>

      <RouterDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} router={selectedRouter} />
      <TestConnectionDialog open={isTestOpen} onOpenChange={setIsTestOpen} router={testRouter} />
    </div>
  )
}
