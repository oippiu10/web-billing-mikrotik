import { createFileRoute } from '@tanstack/react-router'
import { ODPCapacity } from '@/features/odp/capacity'

export const Route = createFileRoute('/_authenticated/odp/capacity')({
  component: ODPCapacity,
})
