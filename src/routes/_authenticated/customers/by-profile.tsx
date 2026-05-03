import { createFileRoute } from '@tanstack/react-router'
import { CustomersByProfile } from '@/features/customers/by-profile'

export const Route = createFileRoute('/_authenticated/customers/by-profile')({
  component: CustomersByProfile,
})
