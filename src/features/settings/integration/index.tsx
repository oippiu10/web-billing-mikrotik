import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Globe, User, Lock, Settings, Server } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { RouterSelector } from '@/components/router-selector'
import { usePermission } from '@/lib/permissions'

const integrationFormSchema = z.object({
  genieacs_url: z.string().url({ message: 'Harus berupa URL yang valid (http/https)' }),
  genieacs_user: z.string().min(1, { message: 'Username wajib diisi' }),
  genieacs_pass: z.string().min(1, { message: 'Password wajib diisi' }),
})

type IntegrationFormValues = z.infer<typeof integrationFormSchema>

export default function SettingsIntegration() {
  const queryClient = useQueryClient()
  const permissions = usePermission()

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['web-settings'],
    queryFn: async () => {
      const res = await api.get('/web_settings.php')
      return res.data.data || {}
    }
  })

  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    values: {
      genieacs_url: settings?.genieacs_url || 'http://',
      genieacs_user: settings?.genieacs_user || '',
      genieacs_pass: settings?.genieacs_pass || '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: IntegrationFormValues) => {
      const res = await api.post('/web_settings.php', {
        settings: values
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Pengaturan integrasi berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['web-settings'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan pengaturan')
    }
  })

  function onSubmit(data: IntegrationFormValues) {
    mutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg'>
            <Settings className='h-5 w-5 text-teal-600' />
          </div>
          <h1 className='text-lg font-bold'>GenieACS — Integration Settings</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-medium'>Integrasi Pihak Ketiga</h3>
            <p className='text-sm text-muted-foreground'>
              Konfigurasikan koneksi ke server eksternal seperti GenieACS.
            </p>
          </div>
          <Separator />
          
          <Card className="border-none shadow-md bg-card/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-teal-600 flex items-center gap-2">
                <Server className="w-5 h-5" />
                GenieACS Configuration
              </CardTitle>
              <CardDescription>
                Pastikan server GenieACS Anda dapat dijangkau oleh server web ini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
                  <FormField
                    control={form.control}
                    name='genieacs_url'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            GenieACS API URL
                        </FormLabel>
                        <FormControl>
                          <Input placeholder='http://api-acs.domain.com' disabled={!permissions.canManageRouter} {...field} />
                        </FormControl>
                        <FormDescription>
                          URL lengkap ke API GenieACS (biasanya port 7557).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name='genieacs_user'
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                API Username
                            </FormLabel>
                            <FormControl>
                            <Input placeholder='admin' disabled={!permissions.canManageRouter} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name='genieacs_pass'
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                API Password
                            </FormLabel>
                            <FormControl>
                            <Input type="password" placeholder='password' disabled={!permissions.canManageRouter} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>

                  {permissions.canManageRouter ? (
                    <Button type='submit' disabled={mutation.isPending}>
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Simpan Perubahan
                    </Button>
                  ) : (
                    <p className='text-xs text-muted-foreground'>Mode baca saja. Hanya admin yang dapat mengubah integrasi.</p>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
