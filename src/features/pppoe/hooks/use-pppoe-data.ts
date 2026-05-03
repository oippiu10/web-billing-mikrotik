/**
 * Shared hook untuk semua halaman PPPoE
 * Mencegah duplikasi fetch data antara halaman
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'

export function usePPPoEData() {
  const { activeRouter } = useRouterStore()

  const { data: pppActive, isLoading: isActiveLoading } = useQuery({
    queryKey: ['ppp-active', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_active' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 3000,
  })

  const { data: pppSecrets, isLoading: isSecretsLoading } = useQuery({
    queryKey: ['ppp-secret', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_secret' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 60000,
  })

  const { data: pppProfiles, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['ppp-profile', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter?.id, cmd: 'ppp_profile' }
      })
      return res.data.data || []
    },
    enabled: !!activeRouter,
    refetchInterval: 300000,
  })

  const activeNames = useMemo(
    () => new Set<string>((pppActive || []).map((a: any) => String(a.name))),
    [pppActive]
  )

  const offlineUsers = useMemo(
    () => (pppSecrets || []).filter((s: any) => !activeNames.has(s.name)),
    [pppSecrets, activeNames]
  )

  const profileNames = (pppProfiles || []).map((p: any) => p.name)

  return {
    activeRouter,
    pppActive: pppActive || [],
    pppSecrets: pppSecrets || [],
    pppProfiles: pppProfiles || [],
    offlineUsers,
    activeNames,
    profileNames,
    isActiveLoading,
    isSecretsLoading,
    isProfilesLoading,
  }
}
