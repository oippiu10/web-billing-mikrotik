import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Play, SkipForward, CheckCircle2, User, Phone, Check, Settings, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface BlastWaDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedCustomers: any[]
  month: number
  year: number
  fmt: (n: number) => string
}

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export function BlastWaDialog({
  isOpen,
  onClose,
  selectedCustomers,
  month,
  year,
  fmt,
}: BlastWaDialogProps) {
  const [queue, setQueue] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [template, setTemplate] = useState(
    'Halo Saudara/i *{Nama}*,\nKami informasikan bahwa tagihan internet Anda periode *{Bulan} {Tahun}* sebesar *{Nominal}* telah terbit.\n\nMohon untuk segera melakukan pembayaran agar layanan internet tetap berjalan lancar.\n\nTerima kasih,\n*Admin Internet*'
  )
  const [isAutoSending, setIsAutoSending] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [gatewayType, setGatewayType] = useState<'fonnte' | 'custom'>('fonnte')
  const [apiToken, setApiToken] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Load WA settings teraktif saat dialog dibuka
  useEffect(() => {
    if (isOpen) {
      api.get('/wa_operations.php?action=get_settings')
        .then((res) => {
          if (res.data.success && res.data.settings) {
            setGatewayType(res.data.settings.gateway_type || 'fonnte')
            setApiToken(res.data.settings.api_token_masked || '')
            setCustomUrl(res.data.settings.custom_url || '')
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      const res = await api.post('/wa_operations.php?action=save_settings', {
        gateway_type: gatewayType,
        api_token: apiToken,
        custom_url: customUrl
      })
      if (res.data.success) {
        toast.success(res.data.message)
        setShowSettings(false)
      } else {
        toast.error(res.data.message)
      }
    } catch {
      toast.error('Gagal menyimpan pengaturan gateway.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  useEffect(() => {
    if (isOpen && selectedCustomers.length > 0) {
      const initialQueue = selectedCustomers.map((cust) => {
        const phone = cust.wa?.replace(/^0/, '62') || ''
        const nominal = fmt(parseFloat(cust.harga || cust.paid_amount || 0))
        const bulan = MONTHS_ID[month - 1]
        
        // Generate personalized message
        const message = template
          .replace(/{Nama}/g, cust.username || 'Pelanggan')
          .replace(/{Bulan}/g, bulan)
          .replace(/{Tahun}/g, String(year))
          .replace(/{Nominal}/g, nominal)

        return {
          ...cust,
          phone,
          nominal,
          message,
          status: 'pending' // 'pending' | 'sending' | 'sent' | 'skipped'
        }
      })
      setQueue(initialQueue)
      setCurrentIndex(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedCustomers])

  // Update messages if template changes
  const handleTemplateChange = (newVal: string) => {
    setTemplate(newVal)
    setQueue((prev) =>
      prev.map((cust) => {
        const bulan = MONTHS_ID[month - 1]
        const message = newVal
          .replace(/{Nama}/g, cust.username || 'Pelanggan')
          .replace(/{Bulan}/g, bulan)
          .replace(/{Tahun}/g, String(year))
          .replace(/{Nominal}/g, cust.nominal)
        return { ...cust, message }
      })
    )
  }

  const handleSendActive = () => {
    if (currentIndex >= queue.length) return

    const activeItem = queue[currentIndex]
    if (!activeItem.phone) {
      toast.error(`Nomor WA tidak tersedia untuk ${activeItem.username}`)
      handleSkip()
      return
    }

    // Mark as sent
    setQueue((prev) =>
      prev.map((item, idx) => (idx === currentIndex ? { ...item, status: 'sent' } : item))
    )

    // Open WhatsApp Web
    const link = `https://wa.me/${activeItem.phone}?text=${encodeURIComponent(activeItem.message)}`
    window.open(link, '_blank')

    // Advance to next index
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1)
      toast.success(`WhatsApp untuk ${activeItem.username} dibuka! Mengalihkan antrean ke berikutnya.`)
    } else {
      setCurrentIndex(queue.length)
      toast.success('Semua antrean WA Blast telah selesai diproses!')
    }
  }

  const handleSkip = () => {
    if (currentIndex >= queue.length) return
    
    setQueue((prev) =>
      prev.map((item, idx) => (idx === currentIndex ? { ...item, status: 'skipped' } : item))
    )

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCurrentIndex(queue.length)
    }
  }

  const handleAutoSend = async () => {
    if (queue.length === 0) return
    setIsAutoSending(true)
    
    try {
      // 1. Dapatkan router_id dari item pertama
      const routerId = selectedCustomers[0]?.router_id || 'default'
      
      // 2. Enqueue semua pelanggan ke database queue
      toast.loading('Menyiapkan antrean pengiriman di server...', { id: 'wa-blast' })
      const enqueueRes = await api.post('/wa_operations.php?action=enqueue_blast', {
        router_id: routerId,
        customers: queue.map(q => ({ phone: q.phone, message: q.message }))
      })
      
      if (!enqueueRes.data.success) {
        throw new Error(enqueueRes.data.message || 'Gagal memasukkan antrean.')
      }
      
      toast.success('Antrean siap! Mulai mengirim pesan otomatis secara berurutan...', { id: 'wa-blast' })
      
      // 3. Proses antrean satu per satu secara asinkron
      for (let i = currentIndex; i < queue.length; i++) {
        setCurrentIndex(i)
        
        // Update status visual menjadi 'sending'
        setQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'sending' } : item))
        )
        
        // Panggil worker backend untuk mengirim 1 antrean pending teratas
        const processRes = await api.get('/wa_operations.php?action=process_queue')
        
        const isSuccess = processRes.data.success
        
        // Update status visual hasil kirim
        setQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: isSuccess ? 'sent' : 'failed' } : item))
        )
        
        if (isSuccess) {
          toast.success(`Terkirim ke ${queue[i].username}`)
        } else {
          toast.error(`Gagal mengirim ke ${queue[i].username}: ${processRes.data.message || 'Error API'}`)
        }
        
        // Jeda aman anti-banned 2.5 detik
        if (i + 1 < queue.length) {
          await new Promise((resolve) => setTimeout(resolve, 2500))
        }
      }
      
      setCurrentIndex(queue.length)
      toast.success('Semua antrean WA Blast otomatis telah berhasil diproses!', { id: 'wa-blast' })
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem pengiriman.', { id: 'wa-blast' })
    } finally {
      setIsAutoSending(false)
    }
  }

  const progressValue = queue.length > 0 ? (queue.filter((q) => q.status === 'sent' || q.status === 'skipped').length / queue.length) * 100 : 0
  const isFinished = currentIndex >= queue.length && queue.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-2xl rounded-3xl border shadow-2xl gap-0 p-0 overflow-hidden'>
        <DialogHeader className='p-6 border-b bg-slate-50 dark:bg-slate-900/60 flex flex-row items-center justify-between'>
          <DialogTitle className='flex items-center gap-2.5 text-lg font-black tracking-tight'>
            <MessageSquare className='h-5 w-5 text-indigo-500' />
            WhatsApp Blast ({selectedCustomers.length} Pelanggan)
          </DialogTitle>
          <Button
            variant='ghost'
            size='icon'
            className='h-9 w-9 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800'
            onClick={() => setShowSettings(!showSettings)}
            title='Pengaturan WhatsApp Gateway'
          >
            <Settings className='h-5 w-5 text-muted-foreground hover:text-foreground' />
          </Button>
        </DialogHeader>

        <div className='grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x h-[60vh]'>
          {/* Left panel: Queue & Status */}
          <div className='col-span-2 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/10'>
            <div className='p-4 border-b space-y-2'>
              <div className='flex justify-between items-center text-xs font-black text-muted-foreground uppercase tracking-wider'>
                <span>Progress Pengiriman</span>
                <span className='font-mono'>{currentIndex} / {queue.length}</span>
              </div>
              <Progress value={progressValue} className='h-2 rounded-full' />
            </div>

            <ScrollArea className='flex-1'>
              <div className='p-3 space-y-2'>
                {queue.map((item, idx) => {
                  const isActive = idx === currentIndex
                  return (
                    <div
                      key={item.user_id || item.id}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-semibold',
                        isActive
                          ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/40 text-indigo-950 dark:text-indigo-200 shadow-xs'
                          : item.status === 'sent'
                          ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-950/20 text-muted-foreground'
                          : item.status === 'failed'
                          ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/10 dark:border-rose-950/20 text-rose-700 dark:text-rose-400'
                          : item.status === 'sending'
                          ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/10 dark:border-blue-950/20 text-blue-700 dark:text-blue-400 animate-pulse'
                          : item.status === 'skipped'
                          ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/10 dark:border-amber-950/20 text-muted-foreground'
                          : 'bg-background border-border/60 text-foreground'
                      )}
                    >
                      <div className='space-y-0.5 max-w-[65%]'>
                        <div className='flex items-center gap-1.5 font-bold truncate'>
                          <User className='h-3.5 w-3.5 opacity-60' />
                          <span>{item.username}</span>
                        </div>
                        <div className='flex items-center gap-1 font-mono text-[10px] text-muted-foreground'>
                          <Phone className='h-3 w-3 opacity-50' />
                          <span>{item.wa || '-'}</span>
                        </div>
                      </div>
                      
                      <div>
                        {item.status === 'sent' ? (
                          <Badge className='bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border-none scale-90 rounded-md px-1.5'>
                            <Check className='h-3 w-3 mr-0.5' /> Terkirim
                          </Badge>
                        ) : item.status === 'sending' ? (
                          <Badge className='bg-blue-500/10 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold border-none scale-90 rounded-md px-1.5 animate-pulse'>
                            Mengirim...
                          </Badge>
                        ) : item.status === 'failed' ? (
                          <Badge className='bg-rose-500/10 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold border-none scale-90 rounded-md px-1.5'>
                            Gagal
                          </Badge>
                        ) : item.status === 'skipped' ? (
                          <Badge className='bg-amber-500/10 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold border-none scale-90 rounded-md px-1.5'>
                            Dilewati
                          </Badge>
                        ) : isActive ? (
                          <Badge className='bg-indigo-500 text-white font-extrabold border-none scale-95 rounded-md px-1.5 animate-pulse'>
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-muted-foreground font-bold scale-90 rounded-md px-1.5'>
                            Antrean
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel: Template & Preview ATAU Form Settings */}
          <div className='col-span-3 flex flex-col h-full p-4 space-y-4 overflow-hidden bg-background'>
            {showSettings ? (
              <div className='flex flex-col h-full space-y-4'>
                <div className='border-b pb-2 select-none'>
                  <h3 className='text-sm font-black uppercase tracking-wider text-foreground'>⚙️ Pengaturan WA Gateway</h3>
                  <p className='text-[10px] text-muted-foreground font-bold mt-0.5'>Pilih tipe engine WhatsApp Gateway aktif Anda.</p>
                </div>
                
                <div className='space-y-4 flex-1 overflow-auto pr-1'>
                  {/* Pilihan Gateway */}
                  <div className='space-y-1.5'>
                    <label className='text-[10px] font-black uppercase text-muted-foreground tracking-wider'>Tipe Gateway</label>
                    <div className='grid grid-cols-2 gap-2'>
                      <Button
                        type='button'
                        variant={gatewayType === 'fonnte' ? 'default' : 'outline'}
                        className={cn('rounded-xl font-bold h-9 text-xs', gatewayType === 'fonnte' && 'bg-indigo-600 hover:bg-indigo-700')}
                        onClick={() => setGatewayType('fonnte')}
                      >
                        Fonnte API
                      </Button>
                      <Button
                        type='button'
                        variant={gatewayType === 'custom' ? 'default' : 'outline'}
                        className={cn('rounded-xl font-bold h-9 text-xs', gatewayType === 'custom' && 'bg-indigo-600 hover:bg-indigo-700')}
                        onClick={() => setGatewayType('custom')}
                      >
                        Custom URL Gateway
                      </Button>
                    </div>
                  </div>

                  {/* Input berdasarkan Tipe */}
                  {gatewayType === 'fonnte' ? (
                    <div className='space-y-2 animate-in fade-in-50 duration-200'>
                      <div className='space-y-1'>
                        <label className='text-[10px] font-black uppercase text-muted-foreground tracking-wider'>Fonnte API Token</label>
                        <Input
                          type='password'
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                          placeholder='Masukkan API Token dari Fonnte...'
                          className='rounded-xl h-9 text-xs font-semibold'
                        />
                      </div>
                      <div className='bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border text-[10px] text-muted-foreground font-bold leading-normal'>
                        💡 <strong>Fonnte</strong> adalah layanan WhatsApp API Gateway premium Indonesia. Anda hanya perlu mendaftar di fonnte.com, memindai QR, dan menempelkan Token di sini untuk mengirim pesan otomatis.
                      </div>
                    </div>
                  ) : (
                    <div className='space-y-2 animate-in fade-in-50 duration-200'>
                      <div className='space-y-1'>
                        <label className='text-[10px] font-black uppercase text-muted-foreground tracking-wider'>HTTP API URL</label>
                        <Input
                          type='url'
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          placeholder='Contoh: http://localhost:8000/send-message...'
                          className='rounded-xl h-9 text-xs font-semibold'
                        />
                      </div>
                      <div className='bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border text-[10px] text-muted-foreground font-bold leading-normal'>
                        🔧 Gunakan opsi ini jika Anda menjalankan **Self-Hosted WA Gateway gratisan** (seperti Node.js Baileys / whatsapp-web.js). Sistem akan mengirim data JSON POST <code>{`{ phone, message }`}</code> ke URL tujuan.
                      </div>
                    </div>
                  )}
                </div>

                <div className='flex gap-2 border-t pt-3'>
                  <Button
                    variant='outline'
                    onClick={() => setShowSettings(false)}
                    className='rounded-xl font-bold h-9 text-xs flex-1 border-2'
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className='bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black h-9 text-xs flex-1 shadow-md shadow-indigo-500/10'
                  >
                    {isSavingSettings ? (
                      <>
                        <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                        Menyimpan...
                      </>
                    ) : (
                      'Simpan Setelan'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className='flex flex-col h-full space-y-4'>
                <div className='flex-1 flex flex-col space-y-3 min-h-0'>
                  <div className='space-y-1 select-none'>
                    <label className='text-[10px] font-black tracking-wider text-muted-foreground uppercase'>
                      Edit Template Pesan WA
                    </label>
                    <Textarea
                      value={template}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className='h-32 text-xs font-semibold leading-relaxed rounded-2xl resize-none shadow-3xs'
                      placeholder='Tulis template...'
                    />
                    <p className='text-[9px] text-muted-foreground font-bold'>
                      Placeholder: <code className='text-indigo-600 font-mono'>{`{Nama}`}</code>, <code className='text-indigo-600 font-mono'>{`{Bulan}`}</code>, <code className='text-indigo-600 font-mono'>{`{Tahun}`}</code>, <code className='text-indigo-600 font-mono'>{`{Nominal}`}</code>
                    </p>
                  </div>

                  <div className='flex-1 flex flex-col min-h-0 space-y-1.5'>
                    <label className='text-[10px] font-black tracking-wider text-muted-foreground uppercase select-none'>
                      Preview Pesan Terpilih ({queue[currentIndex]?.username || 'Selesai'})
                    </label>
                    <div className='flex-1 bg-emerald-50/40 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-950/20 rounded-2xl p-4 overflow-auto text-xs font-semibold leading-relaxed whitespace-pre-wrap font-sans text-emerald-900 dark:text-emerald-300 shadow-3xs'>
                      {queue[currentIndex]?.message || 'Semua antrean pesan WA Blast telah terkirim!'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className='p-4 border-t bg-slate-50 dark:bg-slate-900/60 flex sm:justify-between items-center w-full gap-4 select-none'>
          <Button variant='outline' onClick={onClose} className='rounded-xl font-bold border-2 shrink-0'>
            Tutup Dialog
          </Button>

          <div className='flex gap-2 w-full justify-end'>
            {isAutoSending && (
              <Button
                disabled
                className='bg-indigo-600/90 text-white rounded-xl font-black px-6 shadow-md animate-pulse'
              >
                <div className='h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent' />
                Mengirim Otomatis...
              </Button>
            )}

            {!isFinished && !isAutoSending && queue.length > 0 && (
              <>
                <Button
                  variant='secondary'
                  onClick={handleSkip}
                  className='rounded-xl font-bold px-4'
                >
                  <SkipForward className='mr-1.5 h-4 w-4' /> Lewati
                </Button>
                <Button
                  onClick={handleSendActive}
                  className='bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold px-4 shadow-sm'
                >
                  <Play className='mr-1.5 h-3.5 w-3.5 fill-white' /> Semi-Manual
                </Button>
                <Button
                  onClick={handleAutoSend}
                  className='bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black px-5 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all'
                >
                  🚀 Kirim Otomatis (Latar Belakang)
                </Button>
              </>
            )}

            {isFinished && !isAutoSending && (
              <Button
                onClick={onClose}
                className='bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold px-6 shadow-md shadow-emerald-500/10'
              >
                <CheckCircle2 className='mr-1.5 h-4 w-4' /> Blast Selesai!
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
