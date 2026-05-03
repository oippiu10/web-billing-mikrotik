import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ODP } from '../data/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Share2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  isOpen: boolean
  onClose: () => void
  odp: ODP | null
  onEdit?: (odp: ODP) => void
  onDelete?: (odp: ODP) => void
}

export function ODPDetailDialog({ isOpen, onClose, odp, onEdit, onDelete }: Props) {
  if (!odp) return null

  // Calculate remaining capacity
  let totalCapacity = 0
  if (odp.type === 'splitter') {
    const parts = odp.splitter_type?.split(':')
    totalCapacity = parts && parts.length > 1 ? parseInt(parts[1]) : 0
  } else {
    totalCapacity = odp.ratio_total || 0
  }
  const remaining = Math.max(0, totalCapacity - (odp.total_users || 0))

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Share2 className="w-4 h-4 text-primary" />
            Detail ODP
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-4 space-y-4">
            {/* Header identity */}
            <div className="flex items-center justify-between pb-2 border-b">
                <div>
                    <p className="text-xs text-muted-foreground">Nama ODP</p>
                    <p className="text-lg font-bold leading-tight">{odp.name}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tipe</p>
                    <Badge variant="outline" className="text-[10px] h-5 capitalize">
                        {odp.type}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Specs Info */}
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Kapasitas</span>
                        <span className="font-bold">
                            {odp.type === 'splitter' ? (odp.splitter_type || '-') : `${odp.ratio_used}/${odp.ratio_total}`}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t pt-2">
                        <span className="text-muted-foreground">Sisa Port</span>
                        <span className="font-bold text-blue-600">{remaining} Port</span>
                    </div>
                </div>

                {/* Usage Info */}
                <div className="space-y-3 p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-green-600 font-bold uppercase">Terkoneksi</span>
                        <span className="text-xl font-black text-green-700 leading-none">{odp.total_users || 0} User</span>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase px-1">Daftar Pelanggan</p>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold">
                            <tr>
                                <th className="px-3 py-2 border-b w-10">No.</th>
                                <th className="px-3 py-2 border-b">Pelanggan</th>
                                <th className="px-3 py-2 border-b text-right">Redaman</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {odp.users_list && odp.users_list.length > 0 ? (
                                odp.users_list.map((user, idx) => (
                                    <tr key={user.username} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                        <td className="px-3 py-2 font-medium">{user.username}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                                user.redaman && parseFloat(user.redaman) < -25 
                                                ? 'bg-destructive/10 text-destructive' 
                                                : 'bg-green-50 text-green-700 border border-green-100'
                                            }`}>
                                                {user.redaman || '-'} dB
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground italic">
                                        Belum ada pelanggan terkoneksi
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Location Section */}
            <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground font-bold uppercase px-1">Lokasi & Alamat</p>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Keterangan Alamat :</p>
                        <p className="text-xs font-medium leading-relaxed text-foreground/90">
                            {odp.location || 'Tidak ada keterangan alamat'}
                        </p>
                    </div>
                    
                    {odp.maps_link && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full h-8 text-[10px] gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                            onClick={() => window.open(odp.maps_link!, '_blank')}
                        >
                            <MapPin className="w-3 h-3" />
                            Buka di Google Maps
                        </Button>
                    )}
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
                    if (odp && onDelete) {
                        onClose()
                        onDelete(odp)
                    }
                }}
            >
                Hapus ODP
            </Button>
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Tutup</Button>
                <Button 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => {
                        if (odp && onEdit) {
                            onClose()
                            onEdit(odp)
                        }
                    }}
                >
                    Edit ODP
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
