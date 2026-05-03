import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Overview ODP', url: '/odp/capacity' },
  { label: 'Daftar ODP', url: '/odp' },
]

export function ODPSubNav({ active }: { active: string }) {
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
