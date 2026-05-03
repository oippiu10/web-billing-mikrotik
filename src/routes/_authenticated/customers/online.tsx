import { createFileRoute } from '@tanstack/react-router'
import { CustomersOnline } from '@/features/customers/online'

export const Route = createFileRoute('/_authenticated/customers/online')({
  component: CustomersOnline,
})
