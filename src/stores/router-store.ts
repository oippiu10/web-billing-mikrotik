import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Router {
  id: number
  name: string
  host: string
  port: number
  username: string
  is_active: number
  lat?: string
  lng?: string
  software_id?: string
}

interface RouterState {
  activeRouter: Router | null
  setActiveRouter: (router: Router | null) => void
}

export const useRouterStore = create<RouterState>()(
  persist(
    (set) => ({
      activeRouter: null,
      setActiveRouter: (router) => set({ activeRouter: router }),
    }),
    {
      name: 'router-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
