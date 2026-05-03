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
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePrivacyStore } from '@/stores/privacy-store'

const secretSchema = z.object({
  name: z.string().min(1, { message: 'Username wajib diisi' }),
  password: z.string().optional(),
  service: z.string().min(1),
  profile: z.string().min(1),
})

type SecretFormValues = z.infer<typeof secretSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  secret?: any // Data secret jika sedang edit
  profiles: string[] // Daftar nama profil
}

export function SecretDialog({ isOpen, onClose, secret, profiles }: Props) {
  const isEditing = !!secret
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()

  const form = useForm<SecretFormValues>({
    resolver: zodResolver(secretSchema),
    defaultValues: {
      name: '',
      password: '',
      service: 'pppoe',
      profile: 'default',
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (secret) {
        form.reset({
          name: secret.name,
          password: '', // Jangan tampilkan password lama
          service: secret.service || 'pppoe',
          profile: secret.profile || 'default',
        })
      } else {
        form.reset({
          name: '',
          password: '',
          service: 'pppoe',
          profile: 'default',
        })
      }
    }
  }, [isOpen, secret, form])

  const mutation = useMutation({
    mutationFn: async (values: SecretFormValues) => {
      const payload: any = {
        router_id: activeRouter?.id,
        action: isEditing ? 'secret_edit' : 'secret_add',
        params: { ...values }
      }
      if (isEditing) {
        payload.params.id = secret['.id']
      }
      const res = await api.post('/mikrotik_action.php', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Berhasil mengedit user' : 'Berhasil menambah user')
      queryClient.invalidateQueries({ queryKey: ['ppp-secret', activeRouter?.id] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan')
    }
  })

  const onSubmit = (values: SecretFormValues) => {
    mutation.mutate(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit PPPoE User' : 'Tambah PPPoE User'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Ubah data akun pengguna.' : 'Buat akun pengguna baru untuk terhubung ke router.'}
            {isEditing && <div className="text-xs text-muted-foreground mt-1">Kosongkan password jika tidak ingin mengubahnya.</div>}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="user123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password {isEditing && '(Opsional)'}</FormLabel>
                  <FormControl>
                    <Input type={privacyMode ? 'password' : 'text'} placeholder="***" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih service" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="any">any</SelectItem>
                      <SelectItem value="async">async</SelectItem>
                      <SelectItem value="l2tp">l2tp</SelectItem>
                      <SelectItem value="ovpn">ovpn</SelectItem>
                      <SelectItem value="pppoe">pppoe</SelectItem>
                      <SelectItem value="pptp">pptp</SelectItem>
                      <SelectItem value="sstp">sstp</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="profile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih profil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
