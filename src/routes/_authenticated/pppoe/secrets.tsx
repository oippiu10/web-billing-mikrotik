import { createFileRoute } from '@tanstack/react-router'
import { PPPoESecretsPage } from '@/features/pppoe/secrets'

export const Route = createFileRoute('/_authenticated/pppoe/secrets')({
  component: PPPoESecretsPage,
})
