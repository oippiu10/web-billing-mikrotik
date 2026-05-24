import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', url: '/finance' },
  { label: 'Tagihan Bulanan', url: '/finance/billing' },
  { label: 'Piutang', url: '/finance/receivable' },
  { label: 'Pengeluaran', url: '/finance/expenses' },
]

interface FinanceSubNavProps {
  active: string
  rightSlot?: ReactNode
}

export function FinanceSubNav({ active, rightSlot }: FinanceSubNavProps) {
  return (
    <div className='flex items-center gap-1 flex-wrap'>
      {navItems.map((nav) => (
        <Link key={nav.url} to={nav.url}>
          <Button
            size='sm'
            variant={active === nav.url ? 'default' : 'outline'}
            className={cn('text-xs font-bold h-8', active === nav.url && 'shadow-lg shadow-primary/20')}
          >
            {nav.label}
          </Button>
        </Link>
      ))}
      {rightSlot && <div className='ml-auto'>{rightSlot}</div>}
    </div>
  )
}
