import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Overview', url: '/customers/overview' },
  { label: 'Semua Pelanggan', url: '/customers' },
  { label: 'Sedang Offline', url: '/customers/offline' },
  { label: 'Import / Export', url: '/customers/import-export' },
]

export function CustomersSubNav({ active }: { active: string }) {
  return (
    <div className='flex items-center gap-1 flex-wrap'>
      {NAV_ITEMS.map(nav => (
        <Link key={nav.url} to={nav.url}>
          <Button
            size='sm'
            variant={nav.url === active ? 'default' : 'outline'}
            className={cn('text-xs font-bold h-8', nav.url === active && 'shadow-lg shadow-primary/20')}
          >
            {nav.label}
          </Button>
        </Link>
      ))}
    </div>
  )
}
