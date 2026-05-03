import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { getCookie } from '@/lib/cookies'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((state) => state.auth.setUser)
  const setAccessToken = useAuthStore((state) => state.auth.setAccessToken)
  const resetAuth = useAuthStore((state) => state.auth.reset)

  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const res = await api.get('/auth/verify_session.php')
      return res.data
    },
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (sessionQuery.data?.success && sessionQuery.data.data) {
      const user = sessionQuery.data.data
      setUser({
        id: Number(user.id),
        username: user.username,
        fullName: user.full_name || user.username,
        role: user.role || 'admin',
        roleId: user.role_id ? Number(user.role_id) : undefined,
      })
      setAccessToken('php-session')
    }
  }, [sessionQuery.data, setAccessToken, setUser])

  useEffect(() => {
    if (sessionQuery.isError || (sessionQuery.isSuccess && !sessionQuery.data?.success)) {
      resetAuth()
      navigate({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true,
      })
    }
  }, [sessionQuery.isError, sessionQuery.isSuccess, sessionQuery.data?.success, location.href, navigate, resetAuth])

  if (sessionQuery.isLoading) {
    return (
      <div className='flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' />
        Memeriksa sesi admin...
      </div>
    )
  }

  if (sessionQuery.isError || !sessionQuery.data?.success) return null

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
