import { createLazyFileRoute } from '@tanstack/react-router'
import { SystemUpdatePage } from '@/features/system-tools/system-update'

export const Route = createLazyFileRoute('/_authenticated/system-tools/update')({
  component: SystemUpdatePage,
})
