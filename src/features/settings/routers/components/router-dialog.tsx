import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MapPicker } from '@/components/map-picker'
import { MapPin } from 'lucide-react'
import { useState } from 'react'

interface RouterData {
  id: number
  name: string
  host: string
  port: number
  username: string
  is_active: number
  software_id?: string
  lat?: number
  lng?: number
}

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().optional(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

interface RouterDialogProps {
  router?: RouterData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RouterDialog({ router, open, onOpenChange }: RouterDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!router
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      host: '',
      port: 8728,
      username: 'admin',
      password: '',
      lat: null,
      lng: null,
    },
  })

  useEffect(() => {
    if (router) {
      form.reset({
        name: router.name,
        host: router.host,
        port: router.port,
        username: router.username,
        password: '', // Password masked/hidden on edit
        lat: router.lat ?? null,
        lng: router.lng ?? null,
      })
    } else {
      form.reset({
        name: '',
        host: '',
        port: 8728,
        username: 'admin',
        password: '',
        lat: null,
        lng: null,
      })
    }
  }, [router, form, open])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEdit && router) {
        const res = await api.put('/routers.php', { id: router.id, ...values })
        return res.data
      } else {
        const res = await api.post('/routers.php', values)
        return res.data
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['routers'] })
      queryClient.invalidateQueries({ queryKey: ['active-router'] })

      if (data?.software_id) {
        const customerInfo = data.existing_customers > 0
          ? ` — ${data.existing_customers} pelanggan lama ditemukan!`
          : ' — Belum ada data pelanggan sebelumnya.'
        toast.success(
          `Router ${isEdit ? 'diperbarui' : 'ditambahkan'}! Software ID: ${data.software_id}${customerInfo}`
        )
      } else {
        toast.warning(
          `Router ${isEdit ? 'diperbarui' : 'ditambahkan'}, namun Software ID tidak dapat diambil. Pastikan router dapat diakses.`
        )
      }
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Gagal menyimpan router')
    }
  })

  const testMutation = useMutation({
    onMutate: () => {
      toast.loading('Mencoba menghubungkan ke MikroTik...', { id: 'test-conn' })
    },
    mutationFn: async () => {
      const values = form.getValues()
      const res = await api.post('/test-connection.php', values)
      return res.data
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(
          <div className='flex flex-col gap-1'>
            <span className='font-bold'>{data.message}</span>
            <span className='text-[10px] opacity-80'>Board: {data.data.board} | Ver: {data.data.version}</span>
            <span className='text-[10px] font-mono'>SID: {data.data.software_id}</span>
          </div>,
          { id: 'test-conn', duration: 5000 }
        )
      } else {
        toast.error(data.message, { id: 'test-conn' })
      }
    },
    onError: () => {
      toast.error('Gagal menghubungi server API', { id: 'test-conn' })
    }
  })


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px] text-foreground' onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Router' : 'Add New Router'}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? 'Update configuration for your MikroTik router.' 
              : 'Add a new MikroTik router to monitor its stats and users.'
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
            <FormField
              control={form.control as any}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Router Name</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g. Core Router' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control as any}
                name='host'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host / IP</FormLabel>
                    <FormControl>
                      <Input placeholder='192.168.88.1' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name='port'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Port</FormLabel>
                    <FormControl>
                      <Input type='number' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control as any}
              name='username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type='password' placeholder={isEdit ? 'Leave empty to keep current' : ''} {...field} />
                  </FormControl>
                  <FormDescription>
                      {isEdit ? 'Hanya isi jika ingin mengganti password.' : 'Password login API MikroTik.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className='flex items-center justify-between border-t pt-4 mt-2'>
              <div className='flex flex-col'>
                <span className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>Koordinat Server</span>
                <span className='text-[8px] text-muted-foreground italic'>Gunakan peta untuk akurasi presisi</span>
              </div>
              <div className='flex gap-2'>
                <Button 
                  type='button' 
                  variant='default' 
                  size='sm' 
                  className='h-8 text-[11px] font-black gap-2 bg-[#1e293b] text-white hover:bg-[#0f172a] shadow-md transition-all px-4 rounded-full border-none'
                  onClick={() => setIsMapPickerOpen(true)}
                >
                  <MapPin className='h-3.5 w-3.5' /> Pilih di Peta
                </Button>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control as any}
                name='lat'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[10px] uppercase font-black text-muted-foreground'>Latitude</FormLabel>
                    <FormControl>
                      <Input type='number' step='any' placeholder='-6.123' {...field} value={field.value ?? ''} className='h-8 text-xs font-mono' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name='lng'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-[10px] uppercase font-black text-muted-foreground'>Longitude</FormLabel>
                    <FormControl>
                      <Input type='number' step='any' placeholder='110.123' {...field} value={field.value ?? ''} className='h-8 text-xs font-mono' />
                    </FormControl>
                    <FormMessage />
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
                }}
            />
            <DialogFooter className='gap-2 sm:gap-0'>
              <Button 
                type='button' 
                variant='outline' 
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || mutation.isPending}
              >
                {testMutation.isPending ? 'Mengecek...' : 'Cek Koneksi'}
              </Button>
              <Button type='submit' disabled={mutation.isPending || testMutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
