import { useState } from 'react'
import { AxiosError } from 'axios'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  username: z.string().min(1, 'Masukkan username.'),
  password: z.string().min(1, 'Masukkan password.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const res = await api.post('/auth/login.php', data)
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Login gagal')
      }

      const user = res.data.data
      const authUser = {
        id: Number(user.id),
        username: user.username,
        fullName: user.full_name || user.username,
        role: user.role || 'admin',
        roleId: user.role_id ? Number(user.role_id) : undefined,
      }

      auth.setUser(authUser)
      auth.setAccessToken('php-session')

      queryClient.setQueryData(['auth', 'session'], {
        success: true,
        data: {
          id: authUser.id,
          username: authUser.username,
          full_name: authUser.fullName,
          role_id: authUser.roleId ?? null,
          role: authUser.role,
        },
      })

      toast.success(res.data.message || 'Login berhasil')

      const target = redirectTo?.startsWith('/') && !redirectTo.startsWith('/sign-in')
        ? redirectTo
        : '/'
      await navigate({ to: target, replace: true })

      // Fallback untuk kasus router tidak berpindah setelah session PHP dibuat.
      if (window.location.pathname.endsWith('/sign-in')) {
        window.location.replace(target)
      }
    } catch (error) {
      const message = error instanceof AxiosError
        ? error.response?.data?.message || 'Username atau password salah'
        : error instanceof Error
          ? error.message
          : 'Username atau password salah'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder='admin' autoComplete='username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' autoComplete='current-password' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}
