import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { MapPicker } from '@/components/map-picker'
import { customerSchema, type Customer } from '../data/schema'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Info, MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  isOpen: boolean
  onClose: () => void
  customer?: Customer | null
  profiles: string[]
  odps: { id: number, name: string }[]
}

const parseMapsCoordinates = (value?: string | null) => {
  if (!value) return null
  const text = decodeURIComponent(String(value))
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat: String(lat), lng: String(lng) }
    }
  }
  return null
}

const buildMapsLink = (lat?: string | number | null, lng?: string | number | null) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return ''
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function CustomerMutateDialog({ isOpen, onClose, customer, profiles, odps }: Props) {
  const isEditing = !!customer
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  const form = useForm<Customer>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      username: '',
      password: '',
      profile: 'default',
      wa: '',
      alamat: '',
      'remote-address': '',
      'rate-limit': '',
      disabled: 'no',
      status: 'offline',
      tanggal_tagihan: '',
      tipe_langganan: 'pascabayar',
      redaman: '',
      odp_id: '',
      maps: '',
      lat: '',
      lng: '',
      tanggal_dibuat: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (customer) {
        form.reset({
            ...customer,
            password: '', // Jangan tampilkan password lama untuk keamanan/kenyamanan
        })
      } else {
        form.reset({
          username: '',
          password: '',
          profile: profiles[0] || 'default',
          wa: '',
          alamat: '',
          'remote-address': '',
          'rate-limit': '',
          disabled: 'no',
          status: 'offline',
          tanggal_tagihan: '',
          tipe_langganan: 'pascabayar',
          redaman: '',
          odp_id: '',
          maps: '',
          lat: '',
          lng: '',
          tanggal_dibuat: new Date().toISOString().split('T')[0],
        })
      }
    }
  }, [isOpen, customer, form, profiles])

  const resolveMapsMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await api.post('/maps_resolve.php', { url })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success && data.lat && data.lng) {
        form.setValue('lat', data.lat, { shouldDirty: true })
        form.setValue('lng', data.lng, { shouldDirty: true })
        form.setValue('maps', buildMapsLink(data.lat, data.lng), { shouldDirty: true })
        toast.success('Link Maps berhasil dikonversi ke lat/lng')
      } else {
        toast.error(data.message || 'Koordinat tidak ditemukan dari link tersebut')
      }
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Gagal resolve link Google Maps')
  })

  const mutation = useMutation({
    mutationFn: async (values: Customer) => {
      const payload = isEditing
        ? {
            action: 'edit_extra',
            router_id: activeRouter?.id,
            username: values.username,
            wa: values.wa,
            alamat: values.alamat,
            maps: values.maps,
            lat: values.lat,
            lng: values.lng,
            redaman: values.redaman,
            odp_id: values.odp_id,
            tanggal_tagihan: values.tanggal_tagihan,
            tanggal_dibuat: values.tanggal_dibuat,
            tipe_langganan: values.tipe_langganan || 'pascabayar',
          }
        : {
            ...values,
            action: 'add',
            router_id: activeRouter?.id,
          }

      const res = await api.post('/save_user.php', payload)
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
          toast.success(isEditing ? 'Berhasil memperbarui pelanggan' : 'Berhasil menambah pelanggan')
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          onClose()
      } else {
          toast.error(data.message || 'Gagal menyimpan data')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan sistem')
    }
  })

  const onSubmit = (values: Customer) => {
    mutation.mutate(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-base font-semibold">
            {isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="p-4">
            <Form {...form}>
            <form id='customer-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-3'>
                {isEditing ? (
                  <div className='rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800'>
                    <div className='flex items-start gap-2'>
                      <Info className='mt-0.5 h-4 w-4 shrink-0' />
                      <div>
                        <p className='font-bold'>Mode edit data tambahan</p>
                        <p className='mt-1 text-[11px] leading-relaxed'>Username, password, paket/profile, status PPPoE, remote-address, dan konfigurasi MikroTik tidak akan diubah dari halaman ini.</p>
                        <p className='mt-2 font-mono text-[11px]'>Username: {customer?.username}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='grid grid-cols-2 gap-3'>
                        <FormField
                        control={form.control}
                        name='username'
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Username PPPoE</FormLabel>
                            <FormControl>
                                <Input placeholder='johndoe' {...field} className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name='password'
                        render={({ field }) => (
                            <FormItem className="space-y-1">
                            <FormLabel className="text-xs">Password</FormLabel>
                            <FormControl>
                                <Input type='text' placeholder='secret' {...field} className="h-8 text-xs" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                            </FormItem>
                        )}
                        />
                    </div>
                    <FormField
                    control={form.control}
                    name='profile'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Paket (Profile)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder='Pilih paket' />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {profiles.map(p => (
                                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                  </>
                )}
                <FormField
                control={form.control}
                name='wa'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">WhatsApp</FormLabel>
                    <FormControl>
                        <Input placeholder='08123456789' {...field} className="h-8 text-xs" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name='alamat'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Alamat Lengkap</FormLabel>
                    <FormControl>
                        <Input placeholder='Jl. Raya No. 123...' {...field} className="h-8 text-xs" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />
                <div className='grid grid-cols-2 gap-3'>
                    <FormField
                    control={form.control}
                    name='redaman'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Redaman (dB)</FormLabel>
                        <FormControl>
                            <Input placeholder='-21.5' {...field} value={field.value || ''} className="h-8 text-xs" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name='odp_id'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">ODP</FormLabel>
                        <Select 
                            onValueChange={(val) => field.onChange(val === 'none' ? null : parseInt(val))} 
                            value={field.value?.toString() || 'none'}
                        >
                            <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder='Pilih ODP' />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value='none' className="text-xs">Tanpa ODP</SelectItem>
                                {odps.map(o => (
                                    <SelectItem key={o.id} value={o.id.toString()} className="text-xs">{o.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                control={form.control}
                name='maps'
                render={({ field }) => (
                <FormItem className="space-y-1">
                <FormLabel className="text-xs">Link Google Maps</FormLabel>
                <div className='flex gap-2'>
                  <FormControl>
                      <Input
                        placeholder='https://maps.app.goo.gl/... atau link @lat,lng'
                        {...field}
                        value={field.value || ''}
                        className="h-8 text-xs"
                        onChange={(e) => {
                          field.onChange(e)
                          const coords = parseMapsCoordinates(e.target.value)
                          if (coords) {
                            form.setValue('lat', coords.lat, { shouldDirty: true })
                            form.setValue('lng', coords.lng, { shouldDirty: true })
                          }
                        }}
                      />
                  </FormControl>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-8 shrink-0 text-[10px]'
                    disabled={!field.value || resolveMapsMutation.isPending}
                    onClick={() => resolveMapsMutation.mutate(String(field.value || ''))}
                  >
                    {resolveMapsMutation.isPending ? 'Convert...' : 'Convert'}
                  </Button>
                </div>
                <p className='text-[10px] text-muted-foreground'>Link panjang otomatis terbaca. Untuk link pendek maps.app.goo.gl, klik Convert atau pilih manual lewat peta.</p>
                <FormMessage className="text-[10px]" />
                </FormItem>
                )}
                />
                <div className='flex items-center justify-between rounded-lg border bg-muted/30 p-3'>
                    <div className='flex flex-col'>
                        <span className='text-[10px] font-black uppercase text-muted-foreground'>Titik Rumah Pelanggan</span>
                        <span className='text-[8px] text-muted-foreground italic'>Klik/geser marker seperti penambahan ODP</span>
                    </div>
                    <Button
                        type='button'
                        variant='default'
                        size='sm'
                        className='h-8 gap-2 rounded-full bg-[#1e293b] px-4 text-[10px] font-black text-white shadow-md hover:bg-[#0f172a]'
                        onClick={() => setIsMapPickerOpen(true)}
                    >
                        <MapPin className='h-3 w-3' /> Buka Peta
                    </Button>
                </div>
                <div className='grid grid-cols-[1fr_1fr_auto] gap-3'>
                    <FormField
                    control={form.control}
                    name='lat'
                    render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Latitude</FormLabel>
                    <FormControl>
                        <Input placeholder='-6.208763' {...field} value={field.value || ''} className="h-8 text-xs" />
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
                        <Input placeholder='106.845599' {...field} value={field.value || ''} className="h-8 text-xs" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                    )}
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='mt-6 h-8 text-[10px]'
                      onClick={() => {
                        const link = buildMapsLink(form.getValues('lat'), form.getValues('lng'))
                        if (!link) return toast.error('Isi latitude dan longitude dulu')
                        form.setValue('maps', link, { shouldDirty: true })
                        toast.success('Link Google Maps dibuat dari koordinat')
                      }}
                    >
                      Buat Link
                    </Button>
                </div>
                <MapPicker
                  isOpen={isMapPickerOpen}
                  onClose={() => setIsMapPickerOpen(false)}
                  initialLat={form.getValues('lat') ? Number(form.getValues('lat')) : null}
                  initialLng={form.getValues('lng') ? Number(form.getValues('lng')) : null}
                  onSelect={(lat, lng) => {
                    const fixedLat = Number(lat.toFixed(7))
                    const fixedLng = Number(lng.toFixed(7))
                    form.setValue('lat', fixedLat, { shouldDirty: true })
                    form.setValue('lng', fixedLng, { shouldDirty: true })
                    form.setValue('maps', buildMapsLink(fixedLat, fixedLng), { shouldDirty: true })
                    toast.success('Koordinat pelanggan tersimpan di form')
                  }}
                />
                <div className='grid grid-cols-2 gap-3'>
                    <FormField
                    control={form.control}
                    name='tipe_langganan'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Tipe Langganan</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'pascabayar'}>
                            <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder='Pilih tipe' />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value='prabayar' className="text-xs">Prabayar</SelectItem>
                                <SelectItem value='pascabayar' className="text-xs">Pascabayar</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name='tanggal_tagihan'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Tgl Tagihan</FormLabel>
                        <FormControl>
                            <Input type='number' min='1' max='31' placeholder='15' {...field} value={field.value || ''} className="h-8 text-xs" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                control={form.control}
                name='tanggal_dibuat'
                render={({ field }) => (
                <FormItem className="space-y-1">
                <FormLabel className="text-xs">Tanggal Pasang</FormLabel>
                <FormControl>
                    <Input type='date' {...field} value={field.value?.split(' ')[0] || ''} className="h-8 text-xs" />
                </FormControl>
                <FormMessage className="text-[10px]" />
                </FormItem>
                )}
                />
                {!isEditing && (
                <FormField
                control={form.control}
                name='disabled'
                render={({ field }) => (
                    <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Status Aktif</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder='Pilih status' />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value='no' className="text-xs">Enabled</SelectItem>
                            <SelectItem value='yes' className="text-xs">Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                    </FormItem>
                )}
                />
                )}
            </form>
            </Form>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 p-3 border-t bg-muted/20">
          <Button type='button' variant='ghost' size="sm" onClick={onClose} disabled={mutation.isPending} className="h-8 text-xs">
            Batal
          </Button>
          <Button type='submit' form='customer-form' size="sm" disabled={mutation.isPending} className="h-8 text-xs">
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
