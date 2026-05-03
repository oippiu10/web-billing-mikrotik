import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/system-tools/')({ component: SystemToolsRoadmap })

function SystemToolsRoadmap() {
  return (
    <RoadmapDummyPage
      title='System Tools'
      description='Halaman dummy untuk tools admin sistem, backup restore, audit, integrasi, dan maintenance.'
      features={[
        { title: 'Backup & Restore', description: 'Backup database dan file konfigurasi.', status: 'Next', items: ['Export SQL', 'Restore SQL', 'Download backup'] },
        { title: 'API Keys', description: 'Manajemen token integrasi eksternal.', items: ['Create/revoke key', 'Permission scope', 'Last used'] },
        { title: 'Webhook', description: 'Kirim event ke sistem lain.', status: 'Planned', items: ['Payment event', 'Customer event', 'Network alarm'] },
        { title: 'Audit Security', description: 'Pemeriksaan keamanan aplikasi.', items: ['Login history', 'Failed login', 'Sensitive action log'] },
        { title: 'Maintenance Mode', description: 'Mode maintenance aplikasi.', items: ['Banner maintenance', 'Allow admin only', 'Schedule downtime'] },
        { title: 'Data Cleanup', description: 'Tools bersih-bersih data lama.', items: ['Log retention', 'Cache cleanup', 'Orphan records'] },
      ]}
    />
  )
}
