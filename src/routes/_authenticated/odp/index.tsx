import { createFileRoute } from '@tanstack/react-router'
import ODPPage from '@/features/odp'

export const Route = createFileRoute('/_authenticated/odp/')({
  component: ODPPage,
})
