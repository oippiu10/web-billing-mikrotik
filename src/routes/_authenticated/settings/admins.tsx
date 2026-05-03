import { createFileRoute } from '@tanstack/react-router'
import { SettingsAdmins } from '@/features/settings/admins'

export const Route = createFileRoute('/_authenticated/settings/admins')({
  component: SettingsAdmins,
})
