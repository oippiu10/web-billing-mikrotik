import { useState, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Konfirmasi',
    description: 'Apakah Anda yakin?',
    confirmText: 'Ya',
    cancelText: 'Batal',
    variant: 'default',
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      confirmText: 'Ya',
      cancelText: 'Batal',
      variant: 'default',
      ...opts,
    })
    setIsOpen(true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }

  const handleConfirm = () => {
    setIsOpen(false)
    if (resolveRef.current) {
      resolveRef.current(true)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    if (resolveRef.current) {
      resolveRef.current(false)
    }
  }

  const ConfirmDialog = () => (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="rounded-3xl max-w-[90vw] md:max-w-md border shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-black tracking-tight">{options.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground pt-2">
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 pt-4">
          <AlertDialogCancel onClick={handleCancel} className="rounded-xl font-bold border-2 mt-0">
            {options.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            asChild
          >
            <Button
              variant={options.variant === 'destructive' ? 'destructive' : 'default'}
              className="rounded-xl font-bold px-5"
            >
              {options.confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, ConfirmDialog }
}
