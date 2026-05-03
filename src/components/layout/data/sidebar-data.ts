import {
  LayoutDashboard,
  Monitor,
  ListTodo,
  Settings,
  Users,
  Command,
  Network,
  Share2,
  Wallet,
  Receipt,
  AlertTriangle,
  BarChart3,
  Wifi,
  WifiOff,
  KeyRound,
  Shield,
  LayoutGrid,
  Gauge,
  List,
  Server,
  FileUp,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin MikroTik',
    email: 'admin@mikrotik.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'MikroTik Monitor',
      logo: Command,
      plan: 'Professional',
    },
  ],
  navGroups: [
    {
      title: 'Monitoring',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Live Monitor',
          url: '/monitoring',
          icon: Monitor,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator', 'viewer'],
        },
        {
          title: 'Network Map',
          url: '/network-map',
          icon: Network,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'],
        },
        {
          title: 'Pelanggan',
          icon: Users,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator', 'viewer'],
          items: [
            {
              title: 'Overview Pelanggan',
              url: '/customers/overview',
              icon: Gauge,
            },
            {
              title: 'Semua Pelanggan',
              url: '/customers',
              icon: List,
            },
            {
              title: 'Pelanggan Offline',
              url: '/customers/offline',
              icon: WifiOff,
            },
            {
              title: 'Import / Export',
              url: '/customers/import-export',
              icon: FileUp,
              requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'],
            },
          ],
        },
        {
          title: 'PPPoE',
          icon: Network,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator', 'viewer'],
          items: [
            {
              title: 'Overview',
              url: '/pppoe',
              icon: LayoutGrid,
            },
            {
              title: 'Active',
              url: '/pppoe/active',
              icon: Wifi,
            },
            {
              title: 'Offline',
              url: '/pppoe/offline',
              icon: WifiOff,
            },
            {
              title: 'Secrets',
              url: '/pppoe/secrets',
              icon: KeyRound,
              requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'],
            },
            {
              title: 'Profiles',
              url: '/pppoe/profiles',
              icon: Shield,
              requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
            },
          ],
        },
        {
          title: 'ODP',
          icon: Share2,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'operator'],
          items: [
            {
              title: 'Overview ODP',
              url: '/odp/capacity',
              icon: Gauge,
            },
            {
              title: 'Daftar ODP',
              url: '/odp',
              icon: Share2,
            },
          ],
        },
        {
          title: 'GenieACS',
          icon: Server,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
          items: [
            {
              title: 'Devices',
              url: '/genieacs',
              icon: Monitor,
            },
            {
              title: 'Settings',
              url: '/genieacs/settings',
              icon: Settings,
            },
          ],
        },
      ],
    },
    {
      title: 'Administrasi',
      items: [
        {
          title: 'Keuangan',
          icon: Wallet,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator', 'finance'],
          items: [
            {
              title: 'Dashboard Keuangan',
              url: '/finance',
              icon: Wallet,
            },
            {
              title: 'Tagihan Bulanan',
              url: '/finance/billing',
              icon: Receipt,
            },
            {
              title: 'Piutang',
              url: '/finance/receivable',
              icon: AlertTriangle,
            },
            {
              title: 'Laporan Tahunan',
              url: '/finance/report',
              icon: BarChart3,
            },
          ],
        },
        {
          title: 'Log Aktivitas',
          url: '/logs',
          icon: ListTodo,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
        },
      ],
    },
    {
      title: 'Sistem',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
          items: [
            {
              title: 'Routers',
              url: '/settings/routers',
            },
            {
              title: 'Admin Users',
              url: '/settings/admins',
              requiredRoles: ['admin', 'administrator', 'super_admin', 'super admin', 'superadministrator'],
            },
            {
              title: 'Account',
              url: '/settings/account',
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
            },
          ],
        },
      ],
    },
  ],
}
