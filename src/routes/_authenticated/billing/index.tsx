import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/billing/')({ component: BillingRoadmap })

function BillingRoadmap() {
  return (
    <RoadmapDummyPage
      title='Billing Lengkap'
      description='Halaman dummy untuk roadmap billing end-to-end: invoice, payment, pajak, denda, dan rekonsiliasi.'
      features={[
        { title: 'Invoice & Receipt', description: 'Cetak invoice dan struk pembayaran.', status: 'Next', items: ['Nomor invoice otomatis', 'Print/PDF', 'Template thermal/folio'] },
        { title: 'Recurring Billing', description: 'Generate tagihan otomatis bulanan.', items: ['Prorate pelanggan baru', 'Auto generate per paket', 'Lock periode'] },
        { title: 'Payment Gateway', description: 'Integrasi pembayaran online.', status: 'Planned', items: ['QRIS/VA/E-wallet', 'Callback payment', 'Rekonsiliasi otomatis'] },
        { title: 'Denda & Diskon', description: 'Aturan denda keterlambatan dan promo.', items: ['Late fee', 'Diskon pelanggan', 'Kupon/promo'] },
        { title: 'Kas & Pengeluaran', description: 'Catatan arus kas ISP.', items: ['Pemasukan', 'Pengeluaran operasional', 'Kategori biaya'] },
        { title: 'Tax & Accounting', description: 'Roadmap akuntansi dan pajak.', status: 'Planned', items: ['PPN/non-PPN', 'Jurnal sederhana', 'Export akuntansi'] },
      ]}
    />
  )
}
