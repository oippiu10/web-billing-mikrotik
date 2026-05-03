import { createFileRoute } from '@tanstack/react-router'
import { PPPoEProfilesPage } from '@/features/pppoe/profiles'

export const Route = createFileRoute('/_authenticated/pppoe/profiles')({
  component: PPPoEProfilesPage,
})
