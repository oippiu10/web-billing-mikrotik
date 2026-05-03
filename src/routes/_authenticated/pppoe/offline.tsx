import { createFileRoute } from '@tanstack/react-router'
import { PPPoEOfflinePage } from '@/features/pppoe/offline'

export const Route = createFileRoute('/_authenticated/pppoe/offline')({
  component: PPPoEOfflinePage,
})
