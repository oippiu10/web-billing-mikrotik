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
  Globe,
  Copy, ExternalLink
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { PrivacyText } from '@/components/privacy'

interface Props {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onEdit?: (customer: Customer) => void
  onDelete?: (customer: Customer) => void
}

export function CustomerDetailDialog({ isOpen, onClose, customer, onEdit, onDelete }: Props) {
  if (!customer) return null



  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="w-4 h-4 text-primary" />
            Detail Pelanggan
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
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
                        <span className="text-muted-foreground">Redaman</span>
                        <span className="font-bold text-blue-600">{customer.redaman || '-'} dB</span>
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
                                onClick={() => window.open(`https://wa.me/${customer.wa}`, '_blank')}
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
                        {customer.maps && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full h-8 text-[10px] gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                onClick={() => window.open(customer.maps!, '_blank')}
                            >
                                <MapPin className="w-3 h-3" />
                                Lihat Lokasi di Google Maps
                            </Button>
                        )}
                    </div>
                </div>
            </div>
          </div>
        </ScrollArea>
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
