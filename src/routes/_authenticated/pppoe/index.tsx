import { createFileRoute } from '@tanstack/react-router'
import { PPPoEOverview } from '@/features/pppoe/overview'

export const Route = createFileRoute('/_authenticated/pppoe/')({
  component: PPPoEOverview,
})
