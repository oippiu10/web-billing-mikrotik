import { createFileRoute } from '@tanstack/react-router'
import { CustomerOverview } from '@/features/customers/overview'

export const Route = createFileRoute('/_authenticated/customers/overview')({
  component: CustomerOverview,
})
