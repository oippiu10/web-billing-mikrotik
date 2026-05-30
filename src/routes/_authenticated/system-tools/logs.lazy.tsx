import { createLazyFileRoute } from '@tanstack/react-router'
import { SystemLogsPage } from '@/features/system-tools/system-logs'

export const Route = createLazyFileRoute('/_authenticated/system-tools/logs')({
  component: SystemLogsPage,
})
