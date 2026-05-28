import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type Customer } from '../data/schema'
import { Badge } from '@/components/ui/badge'
import { 
  MapPin, Phone, User, 
  History, Calendar, Receipt, FileText
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { PrivacyText } from '@/components/privacy'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onEdit?: (customer: Customer) => void
  onDelete?: (customer: Customer) => void
}

export function CustomerDetailDialog({ isOpen, onClose, customer, onEdit, onDelete }: Props) {
  const navigate = useNavigate()
  
  // Fetch payment history
  const { data: paymentHistory, isLoading } = useQuery({
    queryKey: ['customer-payment-history', customer?.id],
    queryFn: async () => {
      const res = await api.get('/get_user_payment_history.php', {
        params: { user_id: customer?.id }
      })
      return res.data.data || []
    },
    enabled: isOpen && !!customer?.id,
  })

  if (!customer) return null
  const locationUrl = customer.lat && customer.lng ? `https://www.google.com/maps?q=${customer.lat},${customer.lng}` : customer.maps

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const getIndonesianMonth = (monthNum: number) => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return months[monthNum - 1] || `Bulan ${monthNum}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <Tabs defaultValue="info" className="w-full flex flex-col">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="w-4 h-4 text-primary" />
              Detail Pelanggan
            </DialogTitle>
            <TabsList className="h-9">
              <TabsTrigger value="info" className="text-xs font-bold px-3 py-1">Informasi</TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-bold px-3 py-1 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Riwayat Bayar
              </TabsTrigger>
            </TabsList>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {/* TAB 1: INFORMASI */}
            <TabsContent value="info" className="m-0">
              <div className="p-4 space-y-4">
                {/* Header identity */}
                <div className="flex items-center justify-between pb-2 border-b">
                    <div>
                        <p className="text-xs text-muted-foreground">Username</p>
                        <p className="text-lg font-bold leading-tight"><PrivacyText>{customer.username}</PrivacyText></p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant={customer.status === 'online' ? 'default' : 'destructive'} className="text-[10px] h-5">
                            {customer.status?.toUpperCase()}
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Account Info */}
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Akses</span>
                            <span className={customer.disabled === 'no' ? 'text-green-600 font-bold' : 'text-destructive font-bold'}>
                                {customer.disabled === 'no' ? 'ENABLED' : 'DISABLED'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">IP Address</span>
                            <span className="font-mono"><PrivacyText>{customer['remote-address'] || '-'}</PrivacyText></span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t pt-2">
                            <span className="text-muted-foreground">Paket</span>
                            <span className="font-bold">{customer.profile}</span>
                        </div>
                    </div>

                    {/* Technical Info */}
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Redaman Live <span className="text-[9px] opacity-70">(ACS)</span></span>
                            <span className="font-bold text-blue-600">{(customer as any).redaman_live ? `${(customer as any).redaman_live} dB` : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Redaman Awal <span className="text-[9px] opacity-70">(Manual)</span></span>
                            <span className="font-bold text-slate-500">{customer.redaman ? `${customer.redaman} dB` : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Tagihan</span>
                            <span className="font-bold">Tgl {customer.tanggal_tagihan || '-'}</span>
                        </div>
                        <div className="flex flex-col text-xs border-t pt-2">
                            <span className="text-muted-foreground mb-1">ODP / Port</span>
                            <span className="font-bold text-blue-600 truncate">{customer.odp_name || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Contact & Location */}
                <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase px-1">Kontak & Lokasi</p>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-green-500/10 rounded-md">
                                    <Phone className="w-3.5 h-3.5 text-green-600" />
                                </div>
                                <span className="text-sm font-bold"><PrivacyText>{customer.wa || '-'}</PrivacyText></span>
                            </div>
                            {customer.wa && (
                                <Button 
                                    size="sm" 
                                    className="h-7 text-[10px] bg-green-600 hover:bg-green-700 gap-1.5" 
                                    onClick={() => {
                                      const phone = customer.wa?.replace(/^0/, '62') || ''
                                      if (!phone) {
                                        toast.error('Nomor WA tidak valid')
                                        return
                                      }
                                      const msg = `Halo ${customer.username}, `
                                      navigate({
                                        to: '/automation/whatsapp-center',
                                        search: { phone: phone, text: msg }
                                      })
                                    }}
                                >
                                    <Phone className="w-3 h-3" />
                                    WhatsApp
                                </Button>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">Keterangan Alamat :</p>
                                <p className="text-xs font-medium leading-relaxed text-foreground/90"><PrivacyText>{customer.alamat || 'Tidak ada alamat'}</PrivacyText></p>
                            </div>
                            {locationUrl && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full h-8 text-[10px] gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                    onClick={() => window.open(locationUrl, '_blank')}
                                >
                                    <MapPin className="w-3 h-3" />
                                    Lihat Lokasi di Google Maps
                                </Button>
                            )}
                            {customer.lat && customer.lng ? (
                                <div className='rounded-md border bg-blue-50 px-2 py-1 text-[10px] font-mono text-blue-700'>Koordinat: {customer.lat}, {customer.lng}</div>
                            ) : customer.maps ? (
                                <div className='rounded-md border bg-amber-50 px-2 py-1 text-[10px] text-amber-700'>Lokasi masih berupa link. Edit pelanggan untuk isi lat/lng agar tampil di Network Maps.</div>
                            ) : null}
                        </div>
                    </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: RIWAYAT PEMBAYARAN */}
            <TabsContent value="history" className="m-0">
              <div className="p-4 space-y-3">
                {isLoading ? (
                  // Loading skeletons
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 border rounded-lg animate-pulse bg-muted/10 space-y-2">
                        <div className="flex justify-between">
                          <div className="h-4 w-28 bg-muted rounded" />
                          <div className="h-4 w-16 bg-muted rounded" />
                        </div>
                        <div className="h-3.5 w-32 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : !paymentHistory || paymentHistory.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                    <div className="p-3 bg-muted/40 rounded-full">
                      <Receipt className="w-8 h-8 text-muted-foreground/60" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Belum Ada Riwayat Bayar</h4>
                      <p className="text-xs text-muted-foreground max-w-[280px] mt-1 leading-relaxed">
                        Transaksi pembayaran pelanggan ini belum tercatat pada database monitor.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Payment List
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase px-1">Daftar Transaksi Terakhir ({paymentHistory.length})</p>
                    <div className="space-y-2.5">
                      {paymentHistory.map((pay: any) => {
                        const methodLower = (pay.method || 'cash').toLowerCase()
                        let methodColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' // Cash
                        if (methodLower.includes('tf') || methodLower.includes('transfer') || methodLower.includes('bank')) {
                          methodColor = 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                        } else if (methodLower.includes('qris') || methodLower.includes('link') || methodLower.includes('dana') || methodLower.includes('gopay')) {
                          methodColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        }

                        return (
                          <div key={pay.id} className="p-3 bg-card rounded-lg border border-border/60 hover:shadow-md transition-all duration-300 space-y-2.5">
                            {/* Header row */}
                            <div className="flex justify-between items-center pb-1 border-b border-border/40">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-sm font-black text-foreground">
                                  {getIndonesianMonth(pay.payment_month)} {pay.payment_year}
                                </span>
                              </div>
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] font-black h-4 px-1.5">
                                LUNAS
                              </Badge>
                            </div>

                            {/* Amount & Method info */}
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <p className="text-[9px] text-muted-foreground font-bold">NOMINAL</p>
                                <p className="font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                  <PrivacyText>{formatRupiah(pay.amount)}</PrivacyText>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-muted-foreground font-bold">METODE BAYAR</p>
                                <span className={`inline-block text-[10px] font-black rounded px-1.5 py-0.5 mt-0.5 uppercase tracking-wider ${methodColor}`}>
                                  {pay.method || 'CASH'}
                                </span>
                              </div>
                            </div>

                            {/* Date of payment & Note */}
                            <div className="pt-1.5 border-t border-dashed border-border/50 text-[10px] space-y-1">
                              <div className="flex justify-between items-center text-muted-foreground">
                                <span>Tanggal Transaksi:</span>
                                <span className="font-bold text-foreground/80">{pay.payment_date}</span>
                              </div>
                              {pay.note && (
                                <div className="mt-1 bg-muted/40 rounded p-1.5 flex gap-1.5 text-foreground/90 leading-relaxed border border-border/30">
                                  <FileText className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-[8px] text-muted-foreground font-black uppercase">Catatan :</p>
                                    <p className="italic text-xs font-semibold">{pay.note}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between items-center p-3 border-t bg-muted/20">
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                    if (customer && onDelete) {
                        onClose()
                        onDelete(customer)
                    }
                }}
            >
                Hapus Pelanggan
            </Button>
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Tutup</Button>
                <Button 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => {
                        if (customer && onEdit) {
                            onClose()
                            onEdit(customer)
                        }
                    }}
                >
                    Edit Pelanggan
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
