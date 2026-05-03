import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
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

  const mutation = useMutation({
    mutationFn: async (values: Customer) => {
      const res = await api.post('/save_user.php', {
        ...values,
        action: isEditing ? 'edit' : 'add',
        router_id: activeRouter?.id,
      })
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
                <div className='grid grid-cols-2 gap-3'>
                    <FormField
                    control={form.control}
                    name='username'
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Username PPPoE</FormLabel>
                        <FormControl>
                            <Input placeholder='johndoe' {...field} disabled={isEditing} className="h-8 text-xs" />
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
                <FormControl>
                    <Input
                      placeholder='https://www.google.com/maps?q=-6.2,106.8 atau link @lat,lng'
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
                <p className='text-[10px] text-muted-foreground'>Paste link Google Maps yang berisi koordinat, lat/lng akan terisi otomatis. Link pendek maps.app.goo.gl mungkin perlu isi manual.</p>
                <FormMessage className="text-[10px]" />
                </FormItem>
                )}
                />
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
                <div className='grid grid-cols-2 gap-3'>
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
