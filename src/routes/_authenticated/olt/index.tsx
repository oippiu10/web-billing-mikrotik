import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/olt/')({
  component: OltRoadmap,
})

function OltRoadmap() {
  return (
    <RoadmapDummyPage
      title='OLT Monitoring & Provisioning'
      description='Halaman dummy untuk roadmap monitoring OLT, ONU/ONT, redaman, port PON, dan provisioning.'
      features={[
        { title: 'OLT Devices', description: 'Manajemen daftar OLT multi-vendor.', items: ['Tambah/edit OLT', 'SNMP/Telnet/SSH credential', 'Health status dan uptime'] },
        { title: 'PON Port Monitor', description: 'Monitoring port PON dan kapasitas splitter.', items: ['Daftar board/slot/port', 'RX/TX power summary', 'Utilisasi ONU per port'] },
        { title: 'ONU/ONT List', description: 'Inventaris ONU/ONT dari OLT.', items: ['Serial number', 'Status online/offline/los', 'Signal, distance, uptime'] },
        { title: 'Provisioning', description: 'Rencana auto register ONU baru.', status: 'Planned', items: ['Unconfigured ONU', 'Template profile', 'Bind ke pelanggan'] },
        { title: 'Alarm & LOS', description: 'Riwayat alarm jaringan fiber.', items: ['LOS/dying gasp', 'Flapping ONU', 'Notifikasi teknisi'] },
        { title: 'Vendor Adapter', description: 'Adapter per vendor OLT.', status: 'Next', items: ['Huawei', 'ZTE', 'Fiberhome', 'VSOL/BDCOM/C-Data'] },
      ]}
    />
  )
}
