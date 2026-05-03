import { createFileRoute } from '@tanstack/react-router'
import { GenieACSPage } from '@/features/genieacs'

export const Route = createFileRoute('/_authenticated/genieacs/')({
  component: GenieACSPage,
})
