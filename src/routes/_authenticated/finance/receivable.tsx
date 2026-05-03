import { createFileRoute } from '@tanstack/react-router'
import { FinanceReceivable } from '@/features/finance/receivable'

export const Route = createFileRoute('/_authenticated/finance/receivable')({
  component: FinanceReceivable,
})
