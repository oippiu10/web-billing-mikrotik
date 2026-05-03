import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BarChart3, Download, UserCheck, Users, Wifi, WifiOff } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Overview', url: '/customers/overview', icon: BarChart3 },
  { label: 'Semua', url: '/customers', icon: Users },
  { label: 'Online', url: '/customers/online', icon: Wifi },
  { label: 'Offline', url: '/customers/offline', icon: WifiOff },
  { label: 'Per Profil', url: '/customers/by-profile', icon: UserCheck },
  { label: 'Import / Export', url: '/customers/import-export', icon: Download },
]

export function CustomersSubNav({ active }: { active: string }) {
  return (
    <div className='flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1 shadow-sm'>
      {NAV_ITEMS.map(nav => {
        const Icon = nav.icon
        return (
          <Link key={nav.url} to={nav.url}>
            <Button
              size='sm'
              variant={nav.url === active ? 'default' : 'ghost'}
              className={cn('h-8 gap-1.5 px-3 text-xs font-bold', nav.url === active && 'shadow-sm')}
            >
              <Icon className='h-3.5 w-3.5' />
              {nav.label}
            </Button>
          </Link>
        )
      })}
    </div>
  )
}
