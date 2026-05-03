import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Terminal } from 'lucide-react'
import { type RouterData } from '..'

interface TestConnectionDialogProps {
  router?: RouterData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TestConnectionDialog({ router, open, onOpenChange }: TestConnectionDialogProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (open && router) {
      handleStartTest()
    } else {
        setLogs([])
        setStatus('idle')
    }
  }, [open, router])

  const handleStartTest = async () => {
    if (!router) return
    
    setLogs(["[" + new Date().toLocaleTimeString() + "] Memulai pengujian koneksi ke " + router.host + "..."])
    setStatus('testing')
    
    try {
      const res = await api.get('/test_connection_details.php', {
        params: { router_id: router.id }
      })
      
      setLogs(res.data.logs || [])
      if (res.data.success) {
          setStatus('success')
      } else {
          setStatus('error')
      }
    } catch (error: any) {
      setStatus('error')
      setLogs(prev => [...prev, "[!] ERROR: " + (error.response?.data?.message || error.message)])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] text-foreground'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Terminal className='h-5 w-5' />
            Test Connection: {router?.name}
          </DialogTitle>
          <DialogDescription>
            Mengetes komunikasi API antara server dan router MikroTik.
          </DialogDescription>
        </DialogHeader>

        <div className='relative'>
          <ScrollArea className='h-[300px] w-full rounded-md border bg-slate-950 p-4 font-mono text-xs text-slate-50'>
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${log.includes('✅') ? 'text-green-400' : log.includes('❌') || log.includes('!') ? 'text-red-400' : ''}`}>
                {log}
              </div>
            ))}
            {status === 'testing' && (
              <div className='flex items-center gap-2 text-slate-400 animate-pulse'>
                <Loader2 className='h-3 w-3 animate-spin' />
                Sedang memproses...
              </div>
            )}
          </ScrollArea>
        </div>

        <div className='flex justify-between items-center'>
            <div className='text-sm'>
                Status: {status === 'success' ? (
                    <span className='text-green-500 font-bold uppercase'>Online</span>
                ) : status === 'error' ? (
                    <span className='text-red-500 font-bold uppercase'>Offline</span>
                ) : (
                    <span className='text-muted-foreground'>Idle</span>
                )}
            </div>
            <div className='space-x-2'>
                <Button variant='outline' onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={handleStartTest} disabled={status === 'testing'}>
                    Retest
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
