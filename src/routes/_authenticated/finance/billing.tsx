import { createFileRoute } from '@tanstack/react-router'
import { FinanceBilling } from '@/features/finance/billing'
import { z } from 'zod'

type BillingSearch = {
  month: number
  year: number
  search?: string
  status?: string
  profile?: string
  tipe?: string
}

export const Route = createFileRoute('/_authenticated/finance/billing')({
  validateSearch: (search: Record<string, unknown>): BillingSearch => {
    return {
      month: Number(search.month) || new Date().getMonth() + 1,
      year: Number(search.year) || new Date().getFullYear(),
      search: (search.search as string) || undefined,
      status: (search.status as string) || undefined,
      profile: (search.profile as string) || undefined,
      tipe: (search.tipe as string) || undefined,
    }
  },
  component: FinanceBilling,
})
