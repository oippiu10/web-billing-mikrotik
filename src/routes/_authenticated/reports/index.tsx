import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/reports/')({ component: ReportsRoadmap })

function ReportsRoadmap() {
  return (
    <RoadmapDummyPage
      title='Reports & Analytics'
      description='Halaman dummy untuk laporan lengkap bisnis ISP, teknis jaringan, dan performa operasional.'
      features={[
        { title: 'Laporan Pendapatan', description: 'Analitik revenue lengkap.', items: ['MRR/ARR', 'Pendapatan per paket', 'Growth pelanggan'] },
        { title: 'Laporan Tunggakan', description: 'Piutang dan aging receivable.', items: ['Aging 30/60/90 hari', 'Top debtor', 'Collection rate'] },
        { title: 'Network SLA', description: 'Laporan uptime jaringan.', status: 'Planned', items: ['Router uptime', 'OLT/ONU availability', 'Incident duration'] },
        { title: 'Churn & Retention', description: 'Pelanggan berhenti dan retensi.', items: ['Churn rate', 'Alasan berhenti', 'Winback list'] },
        { title: 'Teknisi Performance', description: 'Kinerja helpdesk lapangan.', items: ['Ticket selesai', 'SLA compliance', 'Repeat issue'] },
        { title: 'Custom Report Builder', description: 'Roadmap pembuat laporan fleksibel.', status: 'Planned', items: ['Filter builder', 'Save report', 'Schedule email'] },
      ]}
    />
  )
}
