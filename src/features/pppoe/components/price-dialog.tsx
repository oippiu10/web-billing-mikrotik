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

const priceSchema = z.object({
  price: z.number().min(0, { message: 'Harga tidak boleh negatif' }),
})

type PriceFormValues = z.infer<typeof priceSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  profile?: any // Data profile untuk update
}

export function PriceDialog({ isOpen, onClose, profile }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()

  const form = useForm<PriceFormValues>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      price: 0,
    },
  })

  useEffect(() => {
    if (isOpen && profile) {
      form.reset({
        price: profile.price || 0,
      })
    }
  }, [isOpen, profile, form])

  const mutation = useMutation({
    mutationFn: async (values: PriceFormValues) => {
      const payload = {
        profile_name: profile.name,
        price: values.price,
      }
      
      const res = await api.put(`/profile_pricing_operations.php?operation=update&router_id=${activeRouter?.id}`, payload)
      return res.data
    },
    onSuccess: () => {
      toast.success(`Berhasil mengupdate harga untuk profil ${profile?.name}`)
      queryClient.invalidateQueries({ queryKey: ['ppp-profile', activeRouter?.id] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Gagal mengupdate harga')
    }
  })

  const onSubmit = (values: PriceFormValues) => {
    mutation.mutate(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atur Harga Profil</DialogTitle>
          <DialogDescription>
            Ubah harga untuk profil paket PPPoE <strong>{profile?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Harga Paket (Rp)</FormLabel>
                  <FormControl>
                    <Input 
                        type="number"
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Menyimpan...' : 'Simpan Harga'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
