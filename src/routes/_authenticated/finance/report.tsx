import { createFileRoute } from '@tanstack/react-router'
import { FinanceReport } from '@/features/finance/report'

export const Route = createFileRoute('/_authenticated/finance/report')({
  component: FinanceReport,
})
