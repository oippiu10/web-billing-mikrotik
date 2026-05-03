import { createFileRoute } from '@tanstack/react-router'
import { PPPoEActivePage } from '@/features/pppoe/active'

export const Route = createFileRoute('/_authenticated/pppoe/active')({
  component: PPPoEActivePage,
})
