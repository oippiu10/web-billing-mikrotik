import { createFileRoute } from '@tanstack/react-router'
import SettingsIntegration from '@/features/settings/integration'

export const Route = createFileRoute('/_authenticated/genieacs/settings')({
  component: SettingsIntegration,
})
