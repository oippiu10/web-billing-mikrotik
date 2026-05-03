import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/tickets/')({ component: TicketsRoadmap })

function TicketsRoadmap() {
  return (
    <RoadmapDummyPage
      title='Helpdesk & Ticketing'
      description='Halaman dummy untuk laporan gangguan, jadwal teknisi, SLA, dan riwayat pekerjaan.'
      features={[
        { title: 'Ticket Gangguan', description: 'Kelola komplain pelanggan.', status: 'Next', items: ['Open/progress/closed', 'Prioritas', 'Kategori gangguan'] },
        { title: 'Assign Teknisi', description: 'Penugasan teknisi lapangan.', items: ['Teknisi PIC', 'Jadwal kunjungan', 'Catatan hasil'] },
        { title: 'SLA Monitor', description: 'Pantau target penyelesaian.', items: ['Timer SLA', 'Overdue warning', 'Report SLA'] },
        { title: 'Work Order', description: 'Perintah kerja instalasi/perbaikan.', items: ['Install baru', 'Relokasi', 'Replace perangkat'] },
        { title: 'Customer Timeline', description: 'Riwayat semua aktivitas pelanggan.', items: ['Ticket history', 'Payment history', 'Network event'] },
        { title: 'Mobile Teknisi', description: 'Roadmap tampilan mobile teknisi.', status: 'Planned', items: ['Upload foto', 'Update lokasi', 'Checklist pekerjaan'] },
      ]}
    />
  )
}
