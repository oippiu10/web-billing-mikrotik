import { useAuthStore } from '@/stores/auth-store'

export type AppRole = 'super_admin' | 'admin' | 'administrator' | 'finance' | 'operator' | 'viewer' | string

export const roleAliases: Record<string, string> = {
  'super admin': 'super_admin',
  superadministrator: 'super_admin',
  administrator: 'admin',
}

export function normalizeRole(role?: string | null): string {
  const normalized = String(role || '').trim().toLowerCase()
  return roleAliases[normalized] || normalized
}

export function getCurrentRole(): string {
  return normalizeRole(useAuthStore.getState().auth.user?.role)
}

export function hasRole(role: string | undefined | null, allowed: string[]): boolean {
  const current = normalizeRole(role)
  if (current === 'super_admin') return true
  return allowed.map(normalizeRole).includes(current)
}

export function usePermission() {
  const role = useAuthStore((state) => normalizeRole(state.auth.user?.role))
  const can = (allowed: string[]) => hasRole(role, allowed)

  return {
    role,
    can,
    isSuperAdmin: role === 'super_admin',
    canManageAdmins: can(['admin']),
    canManageFinance: can(['admin', 'finance']),
    canViewFinance: can(['admin', 'finance']),
    canManageCustomers: can(['admin', 'operator']),
    canDeleteCustomers: can(['admin']),
    canImportCustomers: can(['admin', 'operator']),
    canManagePPPoE: can(['admin', 'operator']),
    canDeletePPPoE: can(['admin']),
    canManageRouter: can(['admin']),
    canViewLogs: can(['admin']),
    canViewOnly: role === 'viewer',
  }
}
