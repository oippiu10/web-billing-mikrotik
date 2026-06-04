import { useState, useRef, useEffect } from 'react'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Play, CheckCircle2, AlertCircle, Search, Clock, ChevronRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import packageJson from '../../../package.json'

type Commit = {
  hash: string
  message: string
}

type UpdateHistory = {
  date: string
  status: 'success' | 'error'
  details: string
}

export function SystemUpdatePage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  
  const [hasUpdate, setHasUpdate] = useState<boolean | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [history, setHistory] = useState<UpdateHistory[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const fetchHistory = async () => {
    try {
      const res = await api.get('/system_update.php?action=history')
      if (res.data?.success) {
        setHistory(res.data.data)
      }
    } catch (error) {
      console.error('Gagal mengambil riwayat update', error)
    }
  }

  const checkForUpdates = async () => {
    setIsChecking(true)
    setUpdateStatus('idle')
    setHasUpdate(null)
    setCommits([])
    
    try {
      const res = await api.get('/system_update.php?action=check')
      if (res.data?.success) {
        setHasUpdate(res.data.has_update)
        setCommits(res.data.commits || [])
      } else {
        alert(res.data?.message || 'Gagal mengecek pembaruan.')
      }
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan jaringan saat menghubungi server.')
    } finally {
      setIsChecking(false)
    }
  }

  const startUpdate = () => {
    if (!confirm('Apakah Anda yakin ingin menerapkan pembaruan ini sekarang? Proses ini akan meng-overwrite sistem lokal dengan versi GitHub terbaru.')) {
      return
    }

    setLogs([])
    setIsUpdating(true)
    setUpdateStatus('running')

    const eventSource = new EventSource('/api/system_update.php?action=update', { withCredentials: true })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.log) {
          setLogs((prev) => [...prev, data.log])
        }

        if (data.done) {
          eventSource.close()
          setIsUpdating(false)
          if (data.log && data.log.includes('SELESAI')) {
            setUpdateStatus('success')
            setHasUpdate(false)
            setCommits([])
            fetchHistory() // Refresh history
          } else {
            setUpdateStatus('error')
            fetchHistory()
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error)
      setLogs((prev) => [...prev, '[!] Koneksi ke server terputus atau terjadi error internal.'])
      eventSource.close()
      setIsUpdating(false)
      setUpdateStatus('error')
      fetchHistory()
    }
  }

  return (
    <>
      <Main className='flex flex-col gap-4 p-4 lg:p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold tracking-tight'>System Auto-Updater</h1>
              <Badge variant='secondary' className='bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200'>
                v{packageJson.version}
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground'>
              Periksa dan sinkronisasi sistem billing ini dengan versi terbaru dari repositori GitHub secara otomatis.
            </p>
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          <div className='md:col-span-1 space-y-4'>
            {/* Kartu Status Pembaruan */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle>Status Pembaruan</CardTitle>
                <CardDescription>
                  Cek ketersediaan fitur atau perbaikan *bug* terbaru.
                </CardDescription>
              </CardHeader>
              <CardContent className='flex flex-col gap-4'>
                <Button 
                  onClick={checkForUpdates} 
                  disabled={isChecking || isUpdating} 
                  variant={hasUpdate ? 'outline' : 'default'}
                  className='w-full'
                >
                  {isChecking ? (
                    <><RefreshCw className='mr-2 h-4 w-4 animate-spin' /> Sedang Mengecek...</>
                  ) : (
                    <><Search className='mr-2 h-4 w-4' /> Cek Pembaruan</>
                  )}
                </Button>

                {hasUpdate === false && (
                  <Alert className='border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'>
                    <CheckCircle2 className='h-4 w-4 stroke-green-600 dark:stroke-green-400' />
                    <AlertTitle>Sistem Terkini</AlertTitle>
                    <AlertDescription className='text-xs'>
                      Sistem Anda sudah menggunakan versi terbaru dari GitHub. Tidak ada *update* yang diperlukan.
                    </AlertDescription>
                  </Alert>
                )}

                {hasUpdate === true && (
                  <div className='space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500'>
                    <Alert className='border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'>
                      <AlertCircle className='h-4 w-4 stroke-amber-600 dark:stroke-amber-400' />
                      <AlertTitle>Update Tersedia!</AlertTitle>
                      <AlertDescription className='text-xs mb-2'>
                        Ada {commits.length} perubahan baru di repositori GitHub yang belum diterapkan di server ini.
                      </AlertDescription>
                    </Alert>

                    <div className='bg-muted rounded-md p-3 max-h-[150px] overflow-y-auto text-xs space-y-2 border'>
                      <div className='font-semibold text-muted-foreground mb-1'>Log Perubahan (Changelog):</div>
                      {commits.map((c) => (
                        <div key={c.hash} className='flex items-start gap-2'>
                          <ChevronRight className='h-3 w-3 mt-0.5 shrink-0 text-muted-foreground' />
                          <span className='font-mono text-muted-foreground shrink-0'>{c.hash.substring(0,7)}</span>
                          <span className='font-medium'>{c.message}</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      onClick={startUpdate} 
                      disabled={isUpdating} 
                      className='w-full bg-primary hover:bg-primary/90'
                      size='lg'
                    >
                      {isUpdating ? (
                        <><RefreshCw className='mr-2 h-4 w-4 animate-spin' /> Sedang Memperbarui...</>
                      ) : (
                        <><Play className='mr-2 h-4 w-4' /> Terapkan Pembaruan Sekarang</>
                      )}
                    </Button>
                  </div>
                )}

                {updateStatus === 'success' && (
                  <Alert className='border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'>
                    <CheckCircle2 className='h-4 w-4 stroke-green-600 dark:stroke-green-400' />
                    <AlertTitle>Berhasil Diperbarui!</AlertTitle>
                    <AlertDescription className='text-xs'>
                      Sistem telah berhasil diperbarui. Silakan refresh (F5) untuk memuat UI terbaru.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Kartu Riwayat Pembaruan */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2'>
                  <Clock className='h-4 w-4' /> Riwayat Instalasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className='text-sm text-muted-foreground italic text-center py-4'>
                    Belum ada riwayat pembaruan yang tercatat.
                  </div>
                ) : (
                  <div className='space-y-4 max-h-[250px] overflow-y-auto pr-2'>
                    {history.map((h, i) => (
                      <div key={i} className='flex flex-col gap-1 border-b last:border-0 pb-3 last:pb-0'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs font-medium'>{h.date}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            h.status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {h.status}
                          </span>
                        </div>
                        <span className='text-xs text-muted-foreground'>{h.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className='md:col-span-2'>
            <Card className='h-[600px] flex flex-col'>
              <CardHeader className='pb-2 border-b'>
                <CardTitle className='text-sm font-mono flex items-center justify-between'>
                  <span>Terminal Output</span>
                  {isUpdating && <RefreshCw className='h-3 w-3 animate-spin text-muted-foreground' />}
                </CardTitle>
              </CardHeader>
              <CardContent className='flex-1 p-0 overflow-hidden bg-black/95'>
                <div 
                  ref={scrollRef}
                  className='h-full w-full overflow-y-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300'
                >
                  {logs.length === 0 ? (
                    <div className='text-zinc-600 italic'>
                      {updateStatus === 'idle' 
                        ? 'Menunggu perintah pembaruan. Silakan klik "Cek Pembaruan" terlebih dahulu.'
                        : ''}
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div 
                        key={index} 
                        className={
                          log.includes('❌') || log.includes('ERROR') || log.includes('[!]') || log.includes('GAGAL')
                            ? 'text-red-400' 
                            : log.includes('✅') || log.includes('SUCCESS') || log.includes('SELESAI')
                            ? 'text-green-400'
                            : 'text-zinc-300'
                        }
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
