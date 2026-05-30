import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Terminal, RefreshCw, Trash2, ShieldAlert, Copy, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { usePermission } from '@/lib/permissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function SystemLogsPage() {
  const [tab, setTab] = useState<'php' | 'daemon'>('php')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [copied, setCopied] = useState(false)
  const permissions = usePermission()
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-logs', tab],
    queryFn: async () => {
      const res = await api.get('/get_system_logs.php', {
        params: { type: tab, action: 'read' },
      })
      return res.data
    },
    refetchInterval: autoRefresh ? 3000 : false,
  })

  const handleCopy = () => {
    if (!data?.logs) return
    navigator.clipboard.writeText(data.logs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Log berhasil disalin ke clipboard')
  }

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/get_system_logs.php', {
        params: { type: tab, action: 'clear' },
      })
      return res.data
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message || 'Log berhasil dibersihkan')
        queryClient.invalidateQueries({ queryKey: ['system-logs', tab] })
      } else {
        toast.error(res.message || 'Gagal membersihkan log')
      }
    },
    onError: () => toast.error('Terjadi kesalahan saat menghubungi server'),
  })

  const logs: string[] = data?.logs || []

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data?.logs])

  if (!permissions.can(['admin'])) {
    return (
      <Main fluid className="flex h-screen items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Akses Ditolak</AlertTitle>
          <AlertDescription>
            Halaman ini hanya dapat diakses oleh Super Admin.
          </AlertDescription>
        </Alert>
      </Main>
    )
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='rounded-lg bg-red-500/10 p-2'>
            <Terminal className='h-5 w-5 text-red-500' />
          </div>
          <h1 className='text-lg font-bold'>System Diagnostics & Logs</h1>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-col gap-4' fluid>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Backend System Logs</h2>
            <p className='text-sm text-muted-foreground'>Pantau error PHP dan aktivitas background daemon secara real-time.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'php' | 'daemon')} className='flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm'>
          <div className='flex items-center justify-between border-b bg-muted/30 p-2 px-4'>
            <TabsList className='bg-background'>
              <TabsTrigger value='php'>PHP Error Logs</TabsTrigger>
              <TabsTrigger value='daemon'>Daemon PM2 Logs</TabsTrigger>
            </TabsList>
            <div className='flex gap-2'>
              <Button 
                variant='outline' 
                size='sm' 
                onClick={() => refetch()} 
                disabled={isFetching}
                className="h-8"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching && !autoRefresh ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant='outline' 
                size='sm' 
                onClick={handleCopy} 
                disabled={logs.length === 0}
                className="h-8"
              >
                {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy Log
              </Button>
              <div className="flex items-center gap-2 ml-2 mr-2 border-l pl-4">
                <label className="text-sm cursor-pointer flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={autoRefresh} 
                    onChange={(e) => setAutoRefresh(e.target.checked)} 
                    className="rounded border-gray-300"
                  />
                  Auto-Refresh (3s)
                  {autoRefresh && <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>}
                </label>
              </div>
              <Button 
                variant='destructive' 
                size='sm' 
                onClick={() => clearMutation.mutate()} 
                disabled={clearMutation.isPending || logs.length === 0}
                className="h-8"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
          
          <TabsContent value='php' className='flex-1 m-0 p-0 overflow-hidden relative'>
             <LogViewer logs={logs} isLoading={isLoading} scrollRef={scrollRef} />
          </TabsContent>
          
          <TabsContent value='daemon' className='flex-1 m-0 p-0 overflow-hidden relative'>
             <LogViewer logs={logs} isLoading={isLoading} scrollRef={scrollRef} />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

function LogViewer({ logs, isLoading, scrollRef }: { logs: string[], isLoading: boolean, scrollRef: React.RefObject<HTMLDivElement | null> }) {
    if (isLoading) {
        return <div className="h-[600px] w-full bg-zinc-950 p-4 font-mono text-sm text-zinc-400 flex items-center justify-center">Memuat log...</div>
    }

    if (logs.length === 0) {
        return <div className="h-[600px] w-full bg-zinc-950 p-4 font-mono text-sm text-zinc-500 flex items-center justify-center">Log kosong.</div>
    }

    return (
        <div 
            ref={scrollRef}
            className="h-[600px] w-full overflow-y-auto bg-zinc-950 p-4 font-mono text-sm leading-relaxed"
        >
            {logs.map((line, i) => {
                // Highlight errors and warnings
                let colorClass = 'text-zinc-300'
                if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal') || line.toLowerCase().includes('failed')) {
                    colorClass = 'text-red-400 font-bold'
                } else if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('notice')) {
                    colorClass = 'text-yellow-400'
                } else if (line.toLowerCase().includes('connected successfully') || line.toLowerCase().includes('success')) {
                    colorClass = 'text-green-400'
                }

                return (
                    <div key={i} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                        {line}
                    </div>
                )
            })}
        </div>
    )
}
