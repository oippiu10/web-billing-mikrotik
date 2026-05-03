import { createFileRoute } from '@tanstack/react-router'
import { CustomerImportExport } from '@/features/customers/import-export'

export const Route = createFileRoute('/_authenticated/customers/import-export')({
  component: CustomerImportExport,
})
