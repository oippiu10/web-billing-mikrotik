import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/automation/')({ component: AutomationRoadmap })

function AutomationRoadmap() {
  return (
    <RoadmapDummyPage
      title='Automation Center'
      description='Halaman dummy untuk otomatisasi billing, isolir, reminder, backup, dan monitoring alert.'
      features={[
        { title: 'Auto Isolir', description: 'Disable pelanggan menunggak otomatis/manual.', status: 'Next', items: ['Grace period', 'Disable PPP secret', 'Whitelist pelanggan'] },
        { title: 'Auto Open Isolir', description: 'Aktifkan kembali setelah bayar.', items: ['Mark paid trigger', 'Enable PPP secret', 'Catat activity log'] },
        { title: 'WhatsApp Reminder', description: 'Pengingat tagihan via WhatsApp.', status: 'Next', items: ['Template pesan', 'Kirim massal', 'Jadwal H-3/H+3'] },
        { title: 'Backup Scheduler', description: 'Backup database dan konfigurasi router.', items: ['Backup SQL', 'Export MikroTik', 'Retention file'] },
        { title: 'Alert Rules', description: 'Rules alert jaringan.', items: ['Router down', 'OLT alarm', 'ODP penuh'] },
        { title: 'Job Queue', description: 'Antrian task otomatis.', status: 'Planned', items: ['Retry failed job', 'Progress task', 'Log worker'] },
      ]}
    />
  )
}
