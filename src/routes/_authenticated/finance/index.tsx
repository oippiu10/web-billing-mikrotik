import { createFileRoute } from '@tanstack/react-router'
import { FinanceDashboard } from '@/features/finance'

export const Route = createFileRoute('/_authenticated/finance/')({
  component: FinanceDashboard,
})
