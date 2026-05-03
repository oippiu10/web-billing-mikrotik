import { createFileRoute } from '@tanstack/react-router'
import RoutersPage from '@/features/settings/routers'

export const Route = createFileRoute('/_authenticated/settings/routers')({
  component: RoutersPage,
})
