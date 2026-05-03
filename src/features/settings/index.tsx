import type { JSX } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Monitor, Bell, Palette, Wrench, UserCog, Router, Shield } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

type SettingsNavItem = {
  title: string
  href: string
  icon: JSX.Element
  requiredRoles?: string[]
}

const sidebarNavItems: SettingsNavItem[] = [
  {
    title: 'Routers',
    href: '/settings/routers',
    icon: <Router size={18} />,
  },
  {
    title: 'Admin Users',
    href: '/settings/admins',
    icon: <Shield size={18} />,
    requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
  },
  {
    title: 'Profile',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: 'Account',
    href: '/settings/account',
    icon: <Wrench size={18} />,
  },
  {
    title: 'Appearance',
    href: '/settings/appearance',
    icon: <Palette size={18} />,
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: <Bell size={18} />,
  },
  {
    title: 'Display',
    href: '/settings/display',
    icon: <Monitor size={18} />,
  },
]

export function Settings() {
  const role = useAuthStore((state) => state.auth.user?.role?.toLowerCase() || '')
  const visibleSidebarNavItems = sidebarNavItems.filter(
    (item) => !item.requiredRoles || item.requiredRoles.includes(role)
  )

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='pb-16' fluid>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>
            Kelola konfigurasi sistem dan preferensi akun Anda.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0'>
          <aside className='lg:w-1/4 shrink-0'>
            <SidebarNav items={visibleSidebarNavItems} />
          </aside>
          <div className='flex-1 w-full'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
