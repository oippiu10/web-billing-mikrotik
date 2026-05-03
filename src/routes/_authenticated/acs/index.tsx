import { createFileRoute } from '@tanstack/react-router'
import { RoadmapDummyPage } from '@/features/roadmap-dummy'

export const Route = createFileRoute('/_authenticated/acs/')({ component: AcsRoadmap })

function AcsRoadmap() {
  return (
    <RoadmapDummyPage
      title='ACS / TR-069 Management'
      description='Halaman dummy untuk ACS lengkap: ONT/CPE management, preset, remote config, dan diagnostics.'
      features={[
        { title: 'CPE Devices', description: 'Daftar perangkat dari GenieACS/ACS.', items: ['Online/offline CPE', 'Model, serial, software version', 'Last inform'] },
        { title: 'Provision Preset', description: 'Template konfigurasi ONT/CPE.', items: ['PPPoE username/password', 'WiFi SSID/password', 'Bridge/router mode'] },
        { title: 'Remote Diagnostics', description: 'Tools remote troubleshooting.', items: ['Reboot device', 'Ping/trace dari CPE', 'Parameter browser'] },
        { title: 'Firmware Management', description: 'Rencana upgrade firmware massal.', status: 'Planned', items: ['Upload firmware', 'Target model', 'Schedule upgrade'] },
        { title: 'WiFi Management', description: 'Kelola WiFi pelanggan.', items: ['Ganti SSID/password', 'Channel/bandwidth', 'Guest WiFi'] },
        { title: 'ACS Event Log', description: 'Riwayat inform dan task ACS.', items: ['Task success/fail', 'Parameter changes', 'Audit admin'] },
      ]}
    />
  )
}
