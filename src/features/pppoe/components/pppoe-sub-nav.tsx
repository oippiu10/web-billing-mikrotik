/** Sub-navigasi yang dipakai di semua halaman PPPoE */
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Overview', url: '/pppoe' },
  { label: 'Active', url: '/pppoe/active' },
  { label: 'Offline', url: '/pppoe/offline' },
  { label: 'Secrets', url: '/pppoe/secrets' },
  { label: 'Profiles', url: '/pppoe/profiles' },
]

export function PPPoESubNav({ active }: { active: string }) {
  return (
    <div className='flex items-center gap-1 flex-wrap'>
      {NAV_ITEMS.map(nav => (
        <Link key={nav.url} to={nav.url}>
          <Button
            size='sm'
            variant={nav.url === active ? 'default' : 'outline'}
            className={cn(
              'text-xs font-bold h-8',
              nav.url === active && 'shadow-lg shadow-primary/20'
            )}
          >
            {nav.label}
          </Button>
        </Link>
      ))}
    </div>
  )
}
