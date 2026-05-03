import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/hotspot/')({ component: HotspotRoadmap })

function HotspotRoadmap() {
  return (
    <RoadmapDummyPage
      title='Hotspot & Voucher'
      description='Halaman dummy untuk voucher hotspot MikroTik, paket prepaid, reseller, dan cetak voucher.'
      features={[
        { title: 'Voucher Generator', description: 'Generate voucher massal.', status: 'Next', items: ['Username/password/random', 'Prefix', 'Batch voucher'] },
        { title: 'Hotspot Profiles', description: 'Paket durasi/kuota/limitasi.', items: ['Rate limit', 'Validity', 'Shared users'] },
        { title: 'Voucher Print', description: 'Cetak voucher siap jual.', items: ['Template kartu', 'QR login', 'Export PDF'] },
        { title: 'Reseller', description: 'Manajemen reseller voucher.', status: 'Planned', items: ['Saldo reseller', 'Harga reseller', 'Komisi'] },
        { title: 'Active Sessions', description: 'Pantau user hotspot aktif.', items: ['IP/MAC', 'Uptime', 'Usage download/upload'] },
        { title: 'Captive Portal', description: 'Roadmap halaman login hotspot.', status: 'Planned', items: ['Branding', 'Iklan', 'Payment link'] },
      ]}
    />
  )
}
