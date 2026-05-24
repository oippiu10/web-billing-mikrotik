import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePrivacyStore } from '@/stores/privacy-store'

interface PrivacyTextProps {
  children: React.ReactNode
  className?: string
  mask?: string
}

export function PrivacyText({ children, className, mask = '••••••' }: PrivacyTextProps) {
  const privacyMode = usePrivacyStore((state) => state.privacyMode)

  if (privacyMode) {
    return <span className={cn('select-none tracking-widest opacity-80', className)}>••••••</span>
  }

  return <span className={className}>{children}</span>
}

interface PrivacyToggleProps {
  className?: string
}

export function PrivacyToggle({ className }: PrivacyToggleProps) {
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const togglePrivacyMode = usePrivacyStore((state) => state.togglePrivacyMode)

  return (
    <Button
      type='button'
      variant={privacyMode ? 'default' : 'outline'}
      size='sm'
      className={cn('h-8 gap-1.5 text-xs font-bold', className)}
      onClick={togglePrivacyMode}
      title={privacyMode ? 'Tampilkan data sensitif' : 'Sembunyikan data sensitif'}
    >
      {privacyMode ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
      {privacyMode ? 'Privacy ON' : 'Privacy OFF'}
    </Button>
  )
}

export function PrivacyIconToggle({ className }: PrivacyToggleProps) {
  const privacyMode = usePrivacyStore((state) => state.privacyMode)
  const togglePrivacyMode = usePrivacyStore((state) => state.togglePrivacyMode)

  return (
    <Button
      type='button'
      variant={privacyMode ? 'secondary' : 'ghost'}
      size='icon'
      className={cn('scale-95 rounded-full', privacyMode && 'text-primary', className)}
      onClick={togglePrivacyMode}
      title={privacyMode ? 'Privacy aktif - klik untuk tampilkan data' : 'Privacy mati - klik untuk sembunyikan data'}
    >
      {privacyMode ? <EyeOff className='size-[1.2rem]' /> : <Eye className='size-[1.2rem]' />}
      <span className='sr-only'>Toggle privacy mode</span>
    </Button>
  )
}
