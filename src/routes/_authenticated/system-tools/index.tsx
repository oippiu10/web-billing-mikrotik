import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, FileText, HardDrive, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/system-tools/')({ component: SystemToolsPage })

function SystemToolsPage() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const routerId = activeRouter?.software_id || activeRouter?.id
  const [type, setType] = useState('export')
  const [prefix, setPrefix] = useState('router')

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['mikrotik-backups', routerId],
    queryFn: async () => (await api.get('/mikrotik_backup.php', { params: { action: 'list', router_id: routerId } })).data,
    enabled: !!routerId,
  })
  const { data: filesData, refetch: refetchFiles, isFetching } = useQuery({
    queryKey: ['mikrotik-backup-files', routerId],
    queryFn: async () => (await api.get('/mikrotik_backup.php', { params: { action: 'files', router_id: routerId } })).data,
    enabled: !!routerId,
  })

  const createBackup = useMutation({
    mutationFn: async () => (await api.post(`/mikrotik_backup.php?action=create&router_id=${routerId}`, { type, prefix })).data,
    onSuccess: (d) => {
      if (d.success) toast.success(d.message || 'Backup berhasil dibuat')
      else toast.error(d.message || 'Backup gagal')
      queryClient.invalidateQueries({ queryKey: ['mikrotik-backups'] })
      queryClient.invalidateQueries({ queryKey: ['mikrotik-backup-files'] })
    },
  })

  const history = historyData?.data || []
  const files = filesData?.data || []

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'><div className='rounded-lg bg-primary/10 p-2'><DatabaseBackup className='h-5 w-5 text-primary' /></div><h1 className='text-lg font-bold'>System Tools</h1></div>
        <RouterSelector /><ThemeSwitch /><ProfileDropdown />
      </Header>
      <Main className='space-y-4' fluid>
        <div><h2 className='text-2xl font-bold tracking-tight'>Backup & Restore MikroTik</h2><p className='text-muted-foreground'>Buat export .rsc atau binary backup langsung di storage MikroTik.</p></div>

        <div className='grid gap-3 md:grid-cols-3'>
          <Card><CardContent className='flex items-center gap-3 py-4'><DatabaseBackup className='h-8 w-8 text-blue-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>History Backup</p><p className='text-2xl font-black'>{history.length}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><HardDrive className='h-8 w-8 text-green-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>File di Router</p><p className='text-2xl font-black'>{files.length}</p></div></CardContent></Card>
          <Card><CardContent className='flex items-center gap-3 py-4'><FileText className='h-8 w-8 text-orange-500' /><div><p className='text-xs font-bold uppercase text-muted-foreground'>Mode</p><p className='text-2xl font-black uppercase'>{type}</p></div></CardContent></Card>
        </div>

        <Card>
          <CardContent className='grid gap-3 py-4 md:grid-cols-[1fr_180px_180px]'>
            <Input placeholder='Prefix nama file' value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='export'>Export .rsc</SelectItem><SelectItem value='backup'>Binary .backup</SelectItem></SelectContent></Select>
            <Button onClick={() => createBackup.mutate()} disabled={createBackup.isPending || !routerId}>{createBackup.isPending ? 'Memproses...' : 'Buat Backup'}</Button>
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='overflow-hidden'>
            <div className='flex items-center justify-between border-b p-4'><div><p className='font-bold'>History Backup</p><p className='text-sm text-muted-foreground'>Catatan backup yang dibuat dari aplikasi.</p></div></div>
            <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Tipe</TableHead><TableHead>Status</TableHead><TableHead>Waktu</TableHead></TableRow></TableHeader><TableBody>
              {isLoading ? <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Memuat...</TableCell></TableRow> : history.length === 0 ? <TableRow><TableCell colSpan={4} className='py-10 text-center text-muted-foreground'>Belum ada history</TableCell></TableRow> : history.map((b: any) => <TableRow key={b.id}><TableCell className='font-mono text-xs'>{b.filename}</TableCell><TableCell><Badge variant='secondary'>{b.backup_type}</Badge></TableCell><TableCell><Badge>{b.status}</Badge></TableCell><TableCell className='text-xs text-muted-foreground'>{b.created_at}</TableCell></TableRow>)}
            </TableBody></Table>
          </Card>

          <Card className='overflow-hidden'>
            <div className='flex items-center justify-between border-b p-4'><div><p className='font-bold'>File Backup di MikroTik</p><p className='text-sm text-muted-foreground'>Download file melalui Winbox &gt; Files, FTP, atau terminal MikroTik.</p></div><Button size='sm' variant='outline' onClick={() => refetchFiles()} disabled={isFetching}><RefreshCw className='mr-2 h-4 w-4' /> Refresh</Button></div>
            <Table><TableHeader><TableRow><TableHead>Nama File</TableHead><TableHead>Size</TableHead><TableHead>Created</TableHead></TableRow></TableHeader><TableBody>
              {files.length === 0 ? <TableRow><TableCell colSpan={3} className='py-10 text-center text-muted-foreground'>Belum ada file .backup/.rsc</TableCell></TableRow> : files.map((f: any) => <TableRow key={f.id || f.name}><TableCell className='font-mono text-xs'>{f.name}</TableCell><TableCell>{f.size || '-'}</TableCell><TableCell className='text-xs text-muted-foreground'>{f.creation_time || '-'}</TableCell></TableRow>)}
            </TableBody></Table>
          </Card>
        </div>
      </Main>
    </>
  )
}
