import { useState, useRef, useEffect } from 'react'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Play, CheckCircle2, AlertCircle, Search, Clock, ChevronRight, GitCommit, GitBranch, History } from 'lucide-react'
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
  version?: string
  changelog?: string[]
}

export function SystemUpdatePage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  
  const [hasUpdate, setHasUpdate] = useState<boolean | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [pastCommits, setPastCommits] = useState<Commit[]>([])
  const [history, setHistory] = useState<UpdateHistory[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHistory()
    checkForUpdates()
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
      const res = await api.get('/system_update.php?action=changelog_full')
      if (res.data?.success) {
        setHasUpdate(res.data.has_update)
        setCommits(res.data.upcoming || [])
        setPastCommits(res.data.past || [])
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

        <Tabs defaultValue="updater" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="updater" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Status Update
            </TabsTrigger>
            <TabsTrigger value="changelog" className="flex items-center gap-2">
              <History className="h-4 w-4" /> Catatan Rilis (Timeline)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="updater" className="mt-0">
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
                        <><Search className='mr-2 h-4 w-4' /> Cek Ulang Pembaruan</>
                      )}
                    </Button>

                    {hasUpdate === false && (
                      <Alert className='border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'>
                        <CheckCircle2 className='h-4 w-4 stroke-green-600 dark:stroke-green-400' />
                        <AlertTitle>Sistem Terkini</AlertTitle>
                        <AlertDescription className='text-xs'>
                          Sistem Anda sudah menggunakan versi terbaru dari GitHub.
                        </AlertDescription>
                      </Alert>
                    )}

                    {hasUpdate === true && (
                      <div className='space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500'>
                        <Alert className='border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'>
                          <AlertCircle className='h-4 w-4 stroke-amber-600 dark:stroke-amber-400' />
                          <AlertTitle>Update Tersedia!</AlertTitle>
                          <AlertDescription className='text-xs mb-2'>
                            Ada {commits.length} perubahan baru di GitHub yang belum diterapkan. Silakan cek tab Catatan Rilis untuk detail.
                          </AlertDescription>
                        </Alert>

                        <Button 
                          onClick={startUpdate} 
                          disabled={isUpdating} 
                          className='w-full bg-primary hover:bg-primary/90'
                          size='lg'
                        >
                          {isUpdating ? (
                            <><RefreshCw className='mr-2 h-4 w-4 animate-spin' /> Sedang Memperbarui...</>
                          ) : (
                            <><Play className='mr-2 h-4 w-4' /> Terapkan Pembaruan</>
                          )}
                        </Button>
                      </div>
                    )}

                    {updateStatus === 'success' && (
                      <Alert className='border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'>
                        <CheckCircle2 className='h-4 w-4 stroke-green-600 dark:stroke-green-400' />
                        <AlertTitle>Berhasil Diperbarui!</AlertTitle>
                        <AlertDescription className='text-xs'>
                          Sistem telah berhasil diperbarui. Silakan refresh (F5).
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
                              <div className='flex items-center gap-2'>
                                {h.version && (
                                  <span className='text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded'>
                                    v{h.version}
                                  </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                                  h.status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                }`}>
                                  {h.status}
                                </span>
                              </div>
                            </div>
                            <span className='text-xs text-muted-foreground'>{h.details}</span>
                            {h.changelog && h.changelog.length > 0 && (
                              <div className='mt-1 space-y-1'>
                                {h.changelog.map((c, idx) => (
                                  <div key={idx} className='text-[10px] text-muted-foreground/80 flex items-start gap-1'>
                                    <span>-</span>
                                    <span>{c}</span>
                                  </div>
                                ))}
                              </div>
                            )}
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
          </TabsContent>

          <TabsContent value="changelog" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" /> Riwayat Perjalanan Sistem (Timeline)
                </CardTitle>
                <CardDescription>
                  Daftar komprehensif seluruh pembaruan fitur, perbaikan bug, dan perubahan kode dari waktu ke waktu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isChecking ? (
                  <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                    <p>Memuat riwayat sistem dari Git...</p>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-muted space-y-8 py-4">
                    
                    {/* UPCOMING COMMITS */}
                    {commits.length > 0 && (
                      <div className="relative">
                        <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-amber-500 ring-4 ring-background" />
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-amber-500">Masa Depan (Belum Diinstal)</h3>
                          <p className="text-sm text-muted-foreground">Pembaruan ini tersedia di GitHub namun belum diterapkan ke server Anda.</p>
                        </div>
                        <div className="space-y-4">
                          {commits.map((c) => (
                            <div key={c.hash} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 relative">
                              <GitCommit className="absolute right-4 top-4 h-4 w-4 text-amber-500/40" />
                              <div className="font-mono text-xs text-amber-600 dark:text-amber-400 mb-1">{c.hash.substring(0,7)}</div>
                              <div className="font-medium">{c.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CURRENT HEAD */}
                    <div className="relative">
                      <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold">Versi Saat Ini</h3>
                          <Badge variant="default" className="bg-primary text-primary-foreground">v{packageJson.version}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Ini adalah posisi kode yang sedang berjalan di server Anda saat ini.</p>
                      </div>
                    </div>

                    {/* PAST COMMITS */}
                    {pastCommits.length > 0 && (
                      <div className="relative">
                        <div className="absolute -left-[33px] top-1 h-4 w-4 rounded-full bg-muted-foreground ring-4 ring-background" />
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-muted-foreground">Masa Lalu (Sudah Diterapkan)</h3>
                          <p className="text-sm text-muted-foreground">Riwayat perubahan yang telah berhasil diinstal sebelumnya.</p>
                        </div>
                        <div className="space-y-3">
                          {pastCommits.map((c) => (
                            <div key={c.hash} className="bg-muted/30 border rounded-lg p-3 relative hover:bg-muted/50 transition-colors">
                              <GitCommit className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/30" />
                              <div className="font-mono text-xs text-muted-foreground mb-1">{c.hash.substring(0,7)}</div>
                              <div className="text-sm">{c.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
