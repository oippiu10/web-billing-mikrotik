import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { 
  Bot, ShieldOff, ShieldCheck, MessageCircle, DatabaseBackup, BellRing, Play, 
  AlertTriangle, CheckCircle2, XCircle, QrCode, LogOut, RefreshCw, Loader2, Smartphone, Settings 
} from 'lucide-react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/_authenticated/automation/')({ component: AutomationCenter })

const jobs = [
  { title: 'Auto Isolir', icon: ShieldOff, color: 'text-red-500', desc: 'Disable PPP secret pelanggan yang menunggak sesuai periode dan grace period.', status: 'Prototype' },
  { title: 'Auto Open Isolir', icon: ShieldCheck, color: 'text-green-500', desc: 'Enable kembali PPP secret pelanggan setelah pembayaran tercatat lunas.', status: 'Planned' },
  { title: 'WhatsApp Reminder', icon: MessageCircle, color: 'text-emerald-500', desc: 'Reminder tagihan H-3, hari H, dan H+3 via WhatsApp gateway/manual.', status: 'Planned' },
  { title: 'Backup Scheduler', icon: DatabaseBackup, color: 'text-blue-500', desc: 'Backup database, export konfigurasi MikroTik, dan retention file otomatis.', status: 'Planned' },
  { title: 'Alert Rules', icon: BellRing, color: 'text-orange-500', desc: 'Alert router down, OLT alarm, pelanggan flapping, dan ODP penuh.', status: 'Planned' },
]

function AutomationCenter() {
  const { activeRouter } = useRouterStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [graceDays, setGraceDays] = useState(7)
  const [dryRun, setDryRun] = useState(true)
  const [lastResult, setLastResult] = useState<any>(null)
  
  // WhatsApp Automation States
  const [sendWa, setSendWa] = useState(true)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [gatewayType, setGatewayType] = useState('fonnte')
  const [apiToken, setApiToken] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const openSettings = async () => {
    setIsSettingsOpen(true)
    try {
      const res = await api.get('/wa_operations.php?action=get_settings')
      if (res.data?.success && res.data?.settings) {
        setGatewayType(res.data.settings.gateway_type || 'fonnte')
        setApiToken(res.data.settings.api_token_masked || '')
        setCustomUrl(res.data.settings.custom_url || '')
      }
    } catch (err) {
      toast.error('Gagal memuat pengaturan gateway')
    }
  }

  const saveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const res = await api.post('/wa_operations.php?action=save_settings', {
        gateway_type: gatewayType,
        api_token: apiToken,
        custom_url: customUrl
      })
      if (res.data?.success) {
        toast.success(res.data.message || 'Pengaturan berhasil disimpan!')
        setIsSettingsOpen(false)
        refetchWaStatus()
      } else {
        toast.error(res.data?.message || 'Gagal menyimpan pengaturan')
      }
    } catch (err) {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const routerId = activeRouter?.software_id || activeRouter?.id

  // Fonnte WhatsApp Device Status Query
  const { data: waStatus, refetch: refetchWaStatus } = useQuery({
    queryKey: ['wa-device-status', routerId],
    queryFn: async () => {
      const res = await api.get('/wa_operations.php?action=get_device_status')
      return res.data
    },
    enabled: !!routerId,
    refetchInterval: 8000, // Update status perangkat setiap 8 detik secara live!
  })

  // Polling check for QR Scan success
  useEffect(() => {
    let intervalId: any
    if (isQrOpen) {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get('/wa_operations.php?action=get_device_status')
          if (res.data?.success && res.data?.connected) {
            toast.success('WhatsApp Gateway Berhasil Tersambung!')
            setIsQrOpen(false)
            refetchWaStatus()
          }
        } catch (e) {
          // ignore
        }
      }, 3000)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isQrOpen, refetchWaStatus])

  const openQrScanner = async () => {
    setIsLoadingQr(true)
    setQrCode('')
    setIsQrOpen(true)
    try {
      const res = await api.get('/wa_operations.php?action=get_qr')
      if (res.data?.success && res.data?.qr) {
        setQrCode(res.data.qr) // base64 string
      } else {
        toast.error(res.data?.message || 'Gagal memuat QR Code. Pastikan Fonnte Token valid.')
        setIsQrOpen(false)
      }
    } catch (err) {
      toast.error('Gagal memuat QR Code')
      setIsQrOpen(false)
    } finally {
      setIsLoadingQr(false)
    }
  }

  const disconnectWa = async () => {
    if (!window.confirm('Apakah Anda yakin ingin memutuskan sambungan WhatsApp Gateway saat ini?')) return
    try {
      const res = await api.get('/wa_operations.php?action=disconnect_device')
      if (res.data?.success) {
        toast.success(res.data.message)
        refetchWaStatus()
      } else {
        toast.error(res.data?.message || 'Gagal memutuskan sambungan')
      }
    } catch (err) {
      toast.error('Gagal memutuskan sambungan')
    }
  }
  const { data: logsData } = useQuery({
    queryKey: ['automation-logs', routerId, month, year],
    queryFn: async () => (await api.get('/automation_logs.php', { params: { router_id: routerId, month, year, limit: 100 } })).data,
    enabled: !!routerId,
    refetchInterval: 60000,
  })

  const isolateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/automation_isolate.php', {
        router_id: routerId,
        month,
        year,
        grace_days: graceDays,
        dry_run: dryRun,
        send_wa: sendWa,
      })
      return res.data
    },
    onSuccess: (data) => {
      setLastResult(data)
      if (data.success) {
        toast.success(dryRun ? `Simulasi selesai: ${data.total_candidates || 0} kandidat` : `Auto isolir selesai: ${data.total_processed || 0} diproses`)
      } else toast.error(data.message || 'Gagal menjalankan auto isolir')
    },
    onError: () => toast.error('Gagal menghubungi server'),
  })

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='rounded-lg bg-primary/10 p-2'><Bot className='h-5 w-5 text-primary' /></div>
          <h1 className='text-lg font-bold'>Automation Center</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Automation Center</h2>
            <p className='text-muted-foreground'>Pusat otomatisasi billing, reminder, dan manajemen notifikasi WhatsApp.</p>
          </div>
        </div>

        {/* WhatsApp Gateway Connection Center */}
        <Card className='border-none shadow-lg overflow-hidden relative bg-linear-to-br from-slate-900 to-slate-800 text-white dark:from-zinc-950 dark:to-zinc-900'>
          <div className='absolute -right-10 -bottom-10 opacity-5 pointer-events-none'>
            <MessageCircle className='h-64 w-64 text-emerald-400' />
          </div>
          
          <CardHeader className='pb-3 flex flex-row items-center justify-between border-b border-white/5'>
            <div className='flex items-center gap-3'>
              <div className={`p-2 rounded-lg ${waStatus?.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                <Smartphone className='h-5 w-5' />
              </div>
              <div>
                <CardTitle className='text-base font-black uppercase tracking-widest text-slate-100'>WhatsApp Gateway Connection</CardTitle>
                <CardDescription className='text-slate-400 text-xs mt-0.5'>
                  {waStatus?.connected ? 'WhatsApp Anda aktif & tersambung sebagai gateway billing.' : 'Hubungkan nomor WhatsApp untuk mengaktifkan otomasi tagihan.'}
                </CardDescription>
              </div>
            </div>
            
            <Badge className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${waStatus?.connected ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-500' : 'bg-rose-500 text-white hover:bg-rose-500'}`}>
              {waStatus?.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </CardHeader>
          
          <CardContent className='pt-5'>
            {waStatus?.connected ? (
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 py-2'>
                <div className='flex flex-wrap gap-x-8 gap-y-4 items-center'>
                  <div className='space-y-1 min-w-[140px]'>
                    <p className='text-[10px] font-black uppercase text-slate-400 tracking-wider'>Nomor WhatsApp</p>
                    <p className='text-base font-black text-slate-100'>{waStatus.device_info?.number || '-'}</p>
                  </div>
                  
                  <div className='space-y-1 min-w-[160px]'>
                    <p className='text-[10px] font-black uppercase text-slate-400 tracking-wider'>Nama Perangkat</p>
                    <p className='text-base font-bold text-slate-200'>{waStatus.device_info?.name || '-'}</p>
                  </div>
                  
                  <div className='space-y-1 min-w-[140px]'>
                    <p className='text-[10px] font-black uppercase text-slate-400 tracking-wider'>Sisa Kuota Bulanan</p>
                    <p className='text-base font-black text-emerald-400'>{waStatus.device_info?.quota || 0} Pesan</p>
                  </div>
                </div>
                
                <div className='flex flex-wrap items-center gap-2 shrink-0 justify-start lg:justify-end'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-9 text-xs font-black uppercase tracking-wider border-white/10 hover:bg-white/10 hover:text-white transition-all text-white gap-1.5'
                    onClick={openSettings}
                  >
                    <Settings className='h-3.5 w-3.5' /> Settings
                  </Button>
                  <Button 
                    variant='outline' 
                    size='sm' 
                    className='h-9 text-xs font-black uppercase tracking-wider border-white/10 hover:bg-white/10 hover:text-white transition-all text-white gap-1.5'
                    onClick={() => refetchWaStatus()}
                  >
                    <RefreshCw className='h-3.5 w-3.5' /> Refresh
                  </Button>
                  <Button 
                    variant='destructive' 
                    size='sm' 
                    className='h-9 text-xs font-black uppercase tracking-wider gap-1.5'
                    onClick={disconnectWa}
                  >
                    <LogOut className='h-3.5 w-3.5' /> Putuskan WA
                  </Button>
                </div>
              </div>
            ) : (
              <div className='flex flex-col md:flex-row items-center justify-between gap-6 py-2'>
                <div className='space-y-1 text-center md:text-left'>
                  <h4 className='text-sm font-extrabold text-slate-200'>WhatsApp Belum Terhubung</h4>
                  <p className='text-xs text-slate-400 leading-relaxed max-w-xl'>
                    Anda perlu melakukan scan QR Code menggunakan aplikasi WhatsApp di HP Anda untuk menghubungkan gateway. 
                    Ini memungkinkan sistem mengirimkan pengingat isolir, notifikasi lunas, dan reminder H-3 secara otomatis 24/7!
                  </p>
                </div>
                
                <div className='flex gap-2 shrink-0'>
                  <Button
                    variant='outline'
                    className='border-white/10 hover:bg-white/10 hover:text-white transition-all text-white font-black text-xs uppercase tracking-wider h-10 px-4 gap-2'
                    onClick={openSettings}
                  >
                    <Settings className='h-4 w-4' /> Pengaturan
                  </Button>
                  <Button 
                    className='bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-xs uppercase tracking-wider px-5 h-10 gap-2 shadow-lg shadow-emerald-500/10'
                    onClick={openQrScanner}
                  >
                    <QrCode className='h-4 w-4' /> Hubungkan WhatsApp (Scan QR)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardHeader>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-red-700 dark:text-red-300'><ShieldOff className='h-5 w-5' /> Auto Isolir PPPoE</CardTitle>
                <CardDescription>Prototype: cari pelanggan belum bayar lalu disable PPP secret di MikroTik. Gunakan simulasi dulu sebelum eksekusi.</CardDescription>
              </div>
              <Badge variant='secondary'>Prototype</Badge>
            </div>
          </CardHeader>
          <CardContent className='flex flex-wrap items-end gap-4'>
            <div className='w-full sm:w-32'>
              <label className='text-xs font-black uppercase tracking-wider text-muted-foreground'>Bulan</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className='mt-1.5 h-9'><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className='w-full sm:w-28'>
              <label className='text-xs font-black uppercase tracking-wider text-muted-foreground'>Tahun</label>
              <Input className='mt-1.5 h-9' type='number' value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div className='w-full sm:w-28'>
              <label className='text-xs font-black uppercase tracking-wider text-muted-foreground'>Grace Days</label>
              <Input className='mt-1.5 h-9' type='number' value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} />
            </div>
            <div className='w-full sm:w-36'>
              <label className='text-xs font-black uppercase tracking-wider text-muted-foreground'>Mode</label>
              <Select value={dryRun ? 'dry' : 'execute'} onValueChange={(v) => setDryRun(v === 'dry')}>
                <SelectTrigger className='mt-1.5 h-9'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='dry'>Simulasi aman</SelectItem>
                  <SelectItem value='execute'>Eksekusi isolir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className='flex items-center h-9 pt-1'>
              <label className='flex items-center gap-2 cursor-pointer text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors'>
                <input 
                  type="checkbox" 
                  checked={sendWa} 
                  onChange={e => setSendWa(e.target.checked)} 
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 bg-background"
                />
                Kirim Notifikasi WA
              </label>
            </div>

            <Button className='gap-2 h-9 font-black text-xs uppercase tracking-wider px-4 sm:ml-auto w-full sm:w-auto' disabled={!activeRouter || isolateMutation.isPending} onClick={() => {
              if (!dryRun) {
                const ok = window.confirm('PERINGATAN: Mode eksekusi akan men-disable PPP secret pelanggan belum bayar. Pastikan sudah melakukan simulasi. Lanjutkan?')
                if (!ok) return
              }
              isolateMutation.mutate()
            }}>
              {isolateMutation.isPending ? (
                <span className='flex items-center gap-1.5'><Loader2 className='h-3.5 w-3.5 animate-spin' /> Memproses...</span>
              ) : (
                <span className='flex items-center gap-1.5'><Play className='h-3.5 w-3.5 fill-current' /> Jalankan Isolir</span>
              )}
            </Button>
            {!dryRun && <p className='flex items-center gap-2 text-xs font-bold text-red-600 w-full pt-1'><AlertTriangle className='h-4 w-4' /> Mode eksekusi akan men-disable PPP secret pelanggan kandidat.</p>}
          </CardContent>
        </Card>

        {lastResult && (
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    {lastResult.success ? <CheckCircle2 className='h-5 w-5 text-green-500' /> : <XCircle className='h-5 w-5 text-red-500' />}
                    Hasil Auto Isolir
                  </CardTitle>
                  <CardDescription>
                    Mode: {lastResult.dry_run ? 'Simulasi' : 'Eksekusi'} • Kandidat: {lastResult.total_candidates || 0} • Diproses: {lastResult.total_processed || 0}
                  </CardDescription>
                </div>
                <Badge variant={lastResult.success ? 'default' : 'destructive'}>{lastResult.success ? 'Selesai' : 'Gagal'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!lastResult.success ? (
                <p className='text-sm text-red-600'>{lastResult.message || 'Terjadi kesalahan'}</p>
              ) : (lastResult.data || []).length === 0 ? (
                <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>Tidak ada kandidat untuk periode ini.</p>
              ) : (
                <div className='max-h-[420px] overflow-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Secret ID</TableHead>
                        <TableHead className='text-right'>Tagihan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(lastResult.data || []).map((row: any, idx: number) => (
                        <TableRow key={`${row.username}-${idx}`}>
                          <TableCell className='font-medium'>{row.username || '-'}</TableCell>
                          <TableCell><Badge variant='outline'>{row.status || '-'}</Badge></TableCell>
                          <TableCell className='text-muted-foreground'>{row.secret_id || '-'}</TableCell>
                          <TableCell className='text-right'>{Number(row.harga || 0).toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>History Automation</CardTitle>
            <CardDescription>Log detail auto isolir/open isolir periode dan router aktif.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='max-h-[360px] overflow-auto rounded-md border'>
              <Table>
                <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Status</TableHead><TableHead>Mode</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(logsData?.data || []).length === 0 ? <TableRow><TableCell colSpan={5} className='py-10 text-center text-muted-foreground'>Belum ada log automation</TableCell></TableRow> : (logsData?.data || []).map((log: any) => (
                    <TableRow key={log.id}><TableCell className='text-xs text-muted-foreground'>{log.created_at}</TableCell><TableCell><Badge variant='secondary'>{log.action}</Badge></TableCell><TableCell className='font-medium'>{log.username || '-'}</TableCell><TableCell><Badge variant='outline'>{log.status || '-'}</Badge></TableCell><TableCell>{Number(log.dry_run) === 1 ? 'Simulasi' : 'Eksekusi'}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {jobs.map((job) => {
            const Icon = job.icon
            return (
              <Card key={job.title}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='flex items-center gap-2 text-base'><Icon className={`h-5 w-5 ${job.color}`} /> {job.title}</CardTitle>
                    <Badge variant='outline'>{job.status}</Badge>
                  </div>
                  <CardDescription>{job.desc}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </Main>

      {/* Dialog QR Code Scan WhatsApp */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className='sm:max-w-md bg-slate-900 border-white/5 text-white dark:bg-zinc-950'>
          <DialogHeader className='pb-2 border-b border-white/5'>
            <DialogTitle className='text-base font-black uppercase tracking-widest text-slate-100 flex items-center gap-2'>
              <QrCode className='h-5 w-5 text-emerald-400' /> Tautkan WhatsApp Gateway
            </DialogTitle>
            <DialogDescription className='text-slate-400 text-xs mt-1'>
              Pindai QR code di bawah menggunakan WhatsApp Anda untuk menghubungkan gateway.
            </DialogDescription>
          </DialogHeader>
          
          <div className='flex flex-col items-center justify-center py-6 space-y-4'>
            {isLoadingQr ? (
              <div className='h-56 w-56 flex flex-col items-center justify-center bg-white/5 rounded-lg border border-white/5'>
                <Loader2 className='h-8 w-8 text-emerald-400 animate-spin mb-3' />
                <p className='text-xs font-bold text-slate-400 animate-pulse'>Membuat QR Code...</p>
              </div>
            ) : qrCode ? (
              <div className='p-3 bg-white rounded-xl shadow-2xl shadow-emerald-500/5'>
                <img src={qrCode} alt="WhatsApp QR Code Fonnte" className='h-52 w-52' />
              </div>
            ) : (
              <div className='h-56 w-56 flex flex-col items-center justify-center bg-white/5 rounded-lg border border-white/5 text-center px-4'>
                <AlertTriangle className='h-8 w-8 text-rose-500 mb-2' />
                <p className='text-xs font-bold text-slate-300'>Gagal Memuat QR Code</p>
                <p className='text-[10px] text-slate-500 mt-1'>Periksa kembali Fonnte API Token Anda di pengaturan gateway.</p>
              </div>
            )}
            
            <div className='w-full bg-white/5 rounded-lg p-4 border border-white/5 space-y-2.5 text-xs text-slate-300 leading-relaxed'>
              <p className='font-extrabold text-slate-200 uppercase tracking-wider text-[10px]'>Petunjuk Penghubungan:</p>
              <ol className='list-decimal list-inside space-y-1.5 text-slate-400 font-medium'>
                <li>Buka aplikasi <span className='text-slate-200 font-bold'>WhatsApp</span> di handphone Anda.</li>
                <li>Ketuk ikon <span className='text-slate-200 font-bold'>Menu</span> (titik tiga) atau buka <span className='text-slate-200 font-bold'>Pengaturan / Setelan</span>.</li>
                <li>Pilih <span className='text-slate-200 font-bold'>Perangkat Tertaut</span> dan ketuk <span className='text-slate-200 font-bold'>Tautkan Perangkat</span>.</li>
                <li>Arahkan kamera HP Anda ke layar ini untuk memindai QR Code di atas.</li>
              </ol>
            </div>
            
            <div className='flex items-center gap-2 text-[10px] font-bold text-emerald-400/80 animate-pulse'>
              <Loader2 className='h-3 w-3 animate-spin' />
              <span>Sistem menunggu hasil scan Anda...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Pengaturan WhatsApp Gateway */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className='sm:max-w-md bg-slate-900 border-white/5 text-white dark:bg-zinc-950 rounded-3xl overflow-hidden'>
          <DialogHeader className='pb-3 border-b border-white/5'>
            <DialogTitle className='text-base font-black uppercase tracking-widest text-slate-100 flex items-center gap-2'>
              <Settings className='h-5 w-5 text-indigo-400' /> Pengaturan WA Gateway
            </DialogTitle>
            <DialogDescription className='text-slate-400 text-xs mt-1'>
              Tentukan jenis gateway pengirim pesan notifikasi billing dan reminder Anda.
            </DialogDescription>
          </DialogHeader>

          <div className='py-4 space-y-4 text-slate-200'>
            {/* Tipe Gateway */}
            <div className='space-y-1.5'>
              <label className='text-[10px] font-black uppercase text-slate-400 tracking-wider'>Mesin / Tipe Gateway</label>
              <Select value={gatewayType} onValueChange={setGatewayType}>
                <SelectTrigger className='h-10 bg-white/5 border-white/10 rounded-xl text-xs text-white focus:ring-0 focus:ring-offset-0 focus:border-indigo-500/50 w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='bg-slate-900 border-white/5 text-slate-200 rounded-xl'>
                  <SelectItem value='fonnte' className='text-xs font-bold focus:bg-white/10 focus:text-white'>Fonnte API (Cloud)</SelectItem>
                  <SelectItem value='custom' className='text-xs font-bold focus:bg-white/10 focus:text-white'>Custom HTTP Gateway (Self-Hosted)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input Fonnte API Token */}
            {gatewayType === 'fonnte' ? (
              <div className='space-y-1.5'>
                <label className='text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between items-center'>
                  <span>Fonnte API Token</span>
                  <a href="https://fonnte.com" target="_blank" rel="noreferrer" className='text-indigo-400 hover:text-indigo-300 font-bold scale-90 transition-colors'>Ambil Token &rarr;</a>
                </label>
                <Input
                  type='password'
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className='h-10 bg-white/5 border-white/10 rounded-xl text-xs font-mono tracking-widest text-white focus:ring-0 focus:ring-offset-0 focus:border-indigo-500/50'
                  placeholder='Masukkan token Fonnte Anda...'
                />
                <p className='text-[9px] text-slate-500 font-medium leading-relaxed'>
                  Token akan disimpan dengan aman di database. Sistem menggunakan token ini untuk query QR Code dan mengirim broadcast tagihan.
                </p>
              </div>
            ) : (
              <div className='space-y-1.5'>
                <label className='text-[10px] font-black uppercase text-slate-400 tracking-wider'>Custom HTTP API URL</label>
                <Input
                  type='text'
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className='h-10 bg-white/5 border-white/10 rounded-xl text-xs font-mono text-white focus:ring-0 focus:ring-offset-0 focus:border-indigo-500/50'
                  placeholder='http://ip-gateway:port/send-message'
                />
                <p className='text-[9px] text-slate-500 font-medium leading-relaxed'>
                  Masukkan URL endpoint server Node.js Baileys Anda. Payload POST yang dikirim berupa JSON: <code className='font-mono text-indigo-400'>{`{"phone": "...", "message": "..."}`}</code>.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className='pt-3 border-t border-white/5 flex gap-2'>
            <Button
              variant='outline'
              onClick={() => setIsSettingsOpen(false)}
              className='h-10 text-xs font-bold uppercase tracking-wider rounded-xl border-white/10 hover:bg-white/5 hover:text-white text-white'
            >
              Batal
            </Button>
            <Button
              disabled={isSavingSettings}
              onClick={saveSettings}
              className='h-10 text-xs font-black uppercase tracking-wider rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10'
            >
              {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
