import { createFileRoute } from '@tanstack/react-router'
import { FinanceBilling } from '@/features/finance/billing'

export const Route = createFileRoute('/_authenticated/finance/billing')({
  component: FinanceBilling,
})
