import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'

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
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const profileSchema = z.object({
  name: z.string().min(1, { message: 'Nama profil wajib diisi' }),
  'local-address': z.string().optional(),
  'remote-address': z.string().optional(),
  'rate-limit': z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  profile?: any // Data profile jika sedang edit
}

export function ProfileDialog({ isOpen, onClose, profile }: Props) {
  const isEditing = !!profile
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      'local-address': '',
      'remote-address': '',
      'rate-limit': '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (profile) {
        form.reset({
          name: profile.name,
          'local-address': profile['local-address'] || '',
          'remote-address': profile['remote-address'] || '',
          'rate-limit': profile['rate-limit'] || '',
        })
      } else {
        form.reset({
          name: '',
          'local-address': '',
          'remote-address': '',
          'rate-limit': '',
        })
      }
    }
  }, [isOpen, profile, form])

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const payload: any = {
        router_id: activeRouter?.id,
        action: isEditing ? 'profile_edit' : 'profile_add',
        params: { ...values }
      }
      if (isEditing) {
        payload.params.id = profile['.id']
      }
      const res = await api.post('/mikrotik_action.php', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Berhasil mengedit profil' : 'Berhasil menambah profil')
      queryClient.invalidateQueries({ queryKey: ['ppp-profile', activeRouter?.id] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan')
    }
  })

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit PPPoE Profile' : 'Tambah PPPoE Profile'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Ubah pengaturan profil/paket PPPoE.' : 'Buat profil paket PPPoE baru.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Profil</FormLabel>
                  <FormControl>
                    <Input placeholder="Misal: Paket 20Mbps" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="local-address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local Address (Opsional)</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="IP Address atau IP Pool" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remote-address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remote Address (Opsional)</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="IP Address atau IP Pool" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rate-limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Limit rx/tx (Opsional)</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Misal: 5M/20M" {...field} />
                  </FormControl>
                  <FormDescription>
                    Format: Upload/Download (contoh: 5M/20M)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
