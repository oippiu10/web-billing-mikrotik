import { createFileRoute } from '@tanstack/react-router'
import { FinanceExpenses } from '@/features/finance/expenses'

export const Route = createFileRoute('/_authenticated/finance/expenses')({
  component: FinanceExpenses,
})
