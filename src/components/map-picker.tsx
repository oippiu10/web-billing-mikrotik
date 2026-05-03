import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation } from 'lucide-react'
import { toast } from 'sonner'

declare const L: any

interface MapPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (lat: number, lng: number) => void
  initialLat?: number | null
  initialLng?: number | null
}

export function MapPicker({ isOpen, onClose, onSelect, initialLat, initialLng }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [selectedPos, setSelectedPos] = useState<{lat: number, lng: number} | null>(null)

  useEffect(() => {
    // Delay sedikit agar Dialog benar-benar terbuka dan ukurannya stabil
    const timer = setTimeout(() => {
        if (isOpen && mapRef.current && !mapInstance) {
            if (typeof L === 'undefined') {
                toast.error('Library Peta (Leaflet) belum siap.')
                return
            }

            const lat = Number(initialLat) || -6.9
            const lng = Number(initialLng) || 110.4
            
            const map = L.map(mapRef.current, {
                zoomControl: true,
                fadeAnimation: true,
            }).setView([lat, lng], 15)
            
            L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['0', '1', '2', '3'],
                attribution: '&copy; Google Maps'
            }).addTo(map)

            const initialMarker = L.marker([lat, lng], { draggable: true }).addTo(map)
            setMapInstance(map)
            setSelectedPos({ lat, lng })

            // Force invalidate berkali-kali untuk memastikan tile muncul
            map.invalidateSize()
            setTimeout(() => map.invalidateSize(), 500)
            setTimeout(() => map.invalidateSize(), 1000)

            map.on('click', (e: any) => {
                const { lat, lng } = e.latlng
                initialMarker.setLatLng(e.latlng)
                setSelectedPos({ lat, lng })
            })

            initialMarker.on('dragend', (e: any) => {
                const { lat, lng } = e.target.getLatLng()
                setSelectedPos({ lat, lng })
            })
        }
    }, 300)

    return () => {
        clearTimeout(timer)
        if (!isOpen && mapInstance) {
            mapInstance.remove()
            setMapInstance(null)
        }
    }
  }, [isOpen])

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokasi tidak didukung oleh browser Anda')
      return
    }

    toast.loading('Mencari lokasi Anda...', { id: 'geo' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (mapInstance) {
          // Hanya pindahkan tampilan peta, jangan ubah marker pilihan
          mapInstance.flyTo([latitude, longitude], 18, {
            duration: 1.5
          })
          mapInstance.invalidateSize()
        }
        toast.success('Peta diarahkan ke lokasi Anda', { id: 'geo' })
      },
      (err) => {
        toast.error('Gagal mengambil lokasi: ' + err.message, { id: 'geo' })
      }
    )
  }

  const handleConfirm = () => {
    if (selectedPos) {
      onSelect(selectedPos.lat, selectedPos.lng)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='!max-w-none !w-[98vw] !h-[96vh] p-0 overflow-hidden border-none shadow-2xl rounded-xl z-[9999] flex flex-col translate-x-[-50%] translate-y-[-50%] left-[50%] top-[50%]'>
        <DialogHeader className='p-4 border-b bg-background shrink-0'>
          <div className='flex items-center justify-between pr-10'>
            <div className='flex items-center gap-3'>
                <div className='p-1.5 bg-secondary rounded-lg'>
                    <MapPin className='h-5 w-5 text-muted-foreground' />
                </div>
                <div className='flex flex-col'>
                    <DialogTitle className='text-lg font-bold tracking-tight'>Pilih Titik Lokasi</DialogTitle>
                    <span className='text-[10px] text-muted-foreground'>Klik pada peta untuk menentukan posisi perangkat</span>
                </div>
            </div>
            <div className='hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary/50 rounded-full border border-border/50'>
                <div className='w-1.5 h-1.5 rounded-full bg-green-500' />
                <span className='text-[10px] font-medium text-muted-foreground uppercase tracking-tighter'>Google Hybrid Active</span>
            </div>
          </div>
        </DialogHeader>

        <div className='relative flex-1 w-full bg-slate-50 dark:bg-slate-950'>
          <div ref={mapRef} className='h-full w-full' />
          
          {/* Floating Actions */}
          <div className='absolute top-6 right-6 z-[1000] flex flex-col gap-2'>
            <Button 
                size='sm' 
                variant='secondary'
                className='shadow-lg font-bold gap-2 h-10 px-4 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-border/50 hover:bg-white dark:hover:bg-slate-900 transition-all'
                onClick={handleGetCurrentLocation}
            >
                <Navigation className='h-4 w-4' /> Fokus ke Saya
            </Button>
          </div>

          {/* Minimalist Bottom Bar */}
          <div className='absolute bottom-6 left-0 right-0 z-[1000] flex justify-center px-4'>
            <div className='bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-border/40 flex items-center gap-6 px-6'>
                <div className='flex items-center gap-6 text-xs'>
                    <div className='flex flex-col'>
                        <span className='text-[9px] font-bold text-muted-foreground uppercase'>Latitude</span>
                        <span className='font-mono font-medium'>{selectedPos?.lat?.toFixed(7) || '0.0000000'}</span>
                    </div>
                    <div className='flex flex-col'>
                        <span className='text-[9px] font-bold text-muted-foreground uppercase'>Longitude</span>
                        <span className='font-mono font-medium'>{selectedPos?.lng?.toFixed(7) || '0.0000000'}</span>
                    </div>
                </div>
                <div className='h-6 w-[1px] bg-border/50' />
                <Button size='sm' className='h-9 px-6 font-bold rounded-xl' onClick={handleConfirm}>
                    Simpan Lokasi
                </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
