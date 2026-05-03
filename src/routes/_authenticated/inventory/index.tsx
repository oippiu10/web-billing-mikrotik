import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/inventory/')({ component: InventoryRoadmap })

function InventoryRoadmap() {
  return (
    <RoadmapDummyPage
      title='Inventory & Asset'
      description='Halaman dummy untuk stok perangkat, aset jaringan, material fiber, dan perangkat pelanggan.'
      features={[
        { title: 'Stok Barang', description: 'Manajemen stok modem/ONT/kabel/material.', status: 'Next', items: ['Stok masuk/keluar', 'Kategori barang', 'Minimum stock alert'] },
        { title: 'Asset Pelanggan', description: 'Perangkat yang dipasang ke pelanggan.', items: ['Serial ONT/router', 'Tanggal pasang', 'Status dipinjam/milik'] },
        { title: 'Asset Jaringan', description: 'Aset backbone dan distribusi.', items: ['Router/switch/OLT', 'ODC/ODP/splitter', 'Lokasi aset'] },
        { title: 'Supplier & Purchase', description: 'Roadmap pembelian barang.', status: 'Planned', items: ['Supplier', 'Purchase order', 'Harga modal'] },
        { title: 'Mutasi Barang', description: 'Perpindahan stok antar gudang/teknisi.', items: ['Gudang pusat', 'Stok teknisi', 'Riwayat mutasi'] },
        { title: 'Barcode/QR', description: 'Label asset cepat scan.', status: 'Planned', items: ['Generate QR', 'Scan asset', 'Print label'] },
      ]}
    />
  )
}
