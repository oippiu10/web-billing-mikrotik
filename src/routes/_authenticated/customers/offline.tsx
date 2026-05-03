import { createFileRoute } from '@tanstack/react-router'
import CustomersOffline from '@/features/customers/offline'

export const Route = createFileRoute('/_authenticated/customers/offline')({
  component: CustomersOffline,
})
