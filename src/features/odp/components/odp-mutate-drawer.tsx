import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { odpSchema, type ODP } from '../data/schema'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPicker } from '@/components/map-picker'
import { Link2, MapPin } from 'lucide-react'
import { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  odp?: ODP | null
}

export function ODPMutateDialog({ isOpen, onClose, odp }: Props) {
  const isEditing = !!odp
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  const form = useForm<ODP>({
    resolver: zodResolver(odpSchema),
    defaultValues: {
      name: '',
      location: '',
      maps_link: '',
      lat: null,
      lng: null,
      type: 'splitter',
      splitter_type: '1:8',
      ratio_used: 0,
      ratio_total: 0,
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (odp) {
        form.reset(odp)
      } else {
        form.reset({
          name: '',
          location: '',
          maps_link: '',
          lat: null,
          lng: null,
          type: 'splitter',
          splitter_type: '1:8',
          ratio_used: 0,
          ratio_total: 0,
        })
      }
    }
  }, [isOpen, odp, form])

  const mutation = useMutation({
    mutationFn: async (values: ODP) => {
      if (isEditing) {
        const res = await api.put('/odp.php', values)
        return res.data
      } else {
        const res = await api.post('/odp.php', {
          ...values,
          router_id: activeRouter?.id,
        })
        return res.data
      }
    },
    onSuccess: (data) => {
      if (data.success) {
          toast.success(isEditing ? 'Berhasil memperbarui ODP' : 'Berhasil menambah ODP')
          queryClient.invalidateQueries({ queryKey: ['odps'] })
          onClose()
      } else {
          toast.error(data.message || 'Gagal menyimpan data')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan sistem')
    }
  })


  const onSubmit = (values: ODP) => {
    mutation.mutate(values)
  }

  const parseCoordsFromMaps = (text?: string | null) => {
    if (!text) return null
    const decoded = decodeURIComponent(text)
    const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
      /^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/,
    ]
    for (const pattern of patterns) {
      const match = decoded.match(pattern)
      if (match) {
        const lat = Number(match[1])
        const lng = Number(match[2])
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
      }
    }
    return null
  }

  const fillMapsFromCoords = () => {
    const lat = form.getValues('lat')
    const lng = form.getValues('lng')
    if (lat == null || lng == null) {
      toast.error('Isi latitude dan longitude dulu')
      return
    }
    form.setValue('maps_link', `https://www.google.com/maps?q=${lat},${lng}`, { shouldDirty: true })
    toast.success('Link Google Maps dibuat dari koordinat')
  }

  const convertCurrentMapsLink = async () => {
    const link = form.getValues('maps_link')
    if (!link) {
      toast.error('Link Google Maps masih kosong')
      return
    }
    const direct = parseCoordsFromMaps(link)
    if (direct) {
      form.setValue('lat', direct.lat, { shouldDirty: true })
      form.setValue('lng', direct.lng, { shouldDirty: true })
      form.setValue('maps_link', `https://www.google.com/maps?q=${direct.lat},${direct.lng}`, { shouldDirty: true })
      toast.success('Koordinat ODP berhasil diambil dari link')
      return
    }
    try {
      const res = await api.post('/maps_resolve.php', { url: link })
      if (res.data?.success) {
        const lat = Number(res.data.lat)
        const lng = Number(res.data.lng)
        form.setValue('lat', lat, { shouldDirty: true })
        form.setValue('lng', lng, { shouldDirty: true })
        form.setValue('maps_link', `https://www.google.com/maps?q=${lat},${lng}`, { shouldDirty: true })
        toast.success('Link ODP berhasil dikonversi ke lat/lng')
      } else {
        toast.error(res.data?.message || 'Gagal membaca koordinat dari link')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal resolve link Google Maps')
    }
  }

  const type = form.watch('type')

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-base font-semibold">
            {isEditing ? 'Edit ODP' : 'Tambah ODP Baru'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="p-4">
            <Form {...form}>
            <form id='odp-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-3'>
                <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Nama ODP</FormLabel>
                    <FormControl>
                        <Input placeholder='ODP-XYZ-01' {...field} className="h-8 text-xs" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />
                
                <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Tipe ODP</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder='Pilih tipe' />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value='splitter' className="text-xs">Splitter</SelectItem>
                            <SelectItem value='ratio' className="text-xs">Ratio</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />

                {type === 'splitter' ? (
                    <FormField
                    control={form.control}
                    name='splitter_type'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Kapasitas Splitter</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || '1:8'}>
                            <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder='Pilih kapasitas' />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value='1:2' className="text-xs">1:2</SelectItem>
                                <SelectItem value='1:4' className="text-xs">1:4</SelectItem>
                                <SelectItem value='1:8' className="text-xs">1:8</SelectItem>
                                <SelectItem value='1:16' className="text-xs">1:16</SelectItem>
                                <SelectItem value='1:32' className="text-xs">1:32</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                ) : (
                    <div className='grid grid-cols-2 gap-3'>
                        <FormField
                        control={form.control}
                        name='ratio_used'
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Digunakan</FormLabel>
                            <FormControl>
                                <Input 
                                    type='number' 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} 
                                    className="h-8 text-xs"
                                />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name='ratio_total'
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Total</FormLabel>
                            <FormControl>
                                <Input 
                                    type='number' 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} 
                                    className="h-8 text-xs"
                                />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                    </div>
                )}

                <FormField
                control={form.control}
                name='location'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Lokasi / Alamat</FormLabel>
                    <FormControl>
                        <Input placeholder='Samping tiang listrik...' {...field} className="h-8 text-xs" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />
                
                <FormField
                control={form.control}
                name='maps_link'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Link Google Maps</FormLabel>
                    <FormControl>
                        <div className='flex gap-2'>
                            <Input placeholder='https://goo.gl/maps/... atau lat,lng' {...field} value={field.value || ''} className="h-8 text-xs" />
                            <Button type='button' variant='secondary' size='sm' className='h-8 px-3 text-[10px] font-black' onClick={convertCurrentMapsLink}>
                                Convert
                            </Button>
                        </div>
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />

                <div className='flex items-center justify-between border-t pt-2'>
                    <div className='flex flex-col'>
                        <span className='text-[10px] font-black uppercase text-muted-foreground'>Koordinat ODP</span>
                        <span className='text-[8px] text-muted-foreground italic'>Geser marker di peta</span>
                    </div>
                    <div className='flex gap-1'>
                        <Button type='button' variant='outline' size='sm' className='h-8 text-[10px] font-black gap-2 rounded-full' onClick={fillMapsFromCoords}>
                            <Link2 className='h-3 w-3' /> Buat Link
                        </Button>
                        <Button 
                            type='button' variant='default' size='sm' 
                            className='h-8 text-[10px] font-black gap-2 bg-[#1e293b] text-white hover:bg-[#0f172a] px-4 rounded-full shadow-md border-none transition-all'
                            onClick={() => setIsMapPickerOpen(true)}
                        >
                            <MapPin className='h-3 w-3' /> Buka Peta
                        </Button>
                    </div>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                    <FormField
                    control={form.control}
                    name='lat'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Latitude</FormLabel>
                        <FormControl>
                            <Input 
                                type='number' 
                                step='any'
                                placeholder='-6.123'
                                {...field} 
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
                                className="h-8 text-xs"
                            />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name='lng'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Longitude</FormLabel>
                        <FormControl>
                            <Input 
                                type='number' 
                                step='any'
                                placeholder='110.123'
                                {...field} 
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
                                className="h-8 text-xs"
                            />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                </div>

                <MapPicker 
                    isOpen={isMapPickerOpen}
                    onClose={() => setIsMapPickerOpen(false)}
                    initialLat={form.getValues('lat')}
                    initialLng={form.getValues('lng')}
                    onSelect={(lat, lng) => {
                        form.setValue('lat', lat)
                        form.setValue('lng', lng)
                        form.setValue('maps_link', `https://www.google.com/maps?q=${lat},${lng}`)
                    }}
                />
            </form>
            </Form>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 p-3 border-t bg-muted/20">
          <Button type='button' variant='ghost' size="sm" onClick={onClose} disabled={mutation.isPending} className="h-8 text-xs">
            Batal
          </Button>
          <Button type='submit' form='odp-form' size="sm" disabled={mutation.isPending} className="h-8 text-xs">
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
