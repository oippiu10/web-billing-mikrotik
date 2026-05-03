import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouterStore } from '@/stores/router-store'
import { Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function RouterSelector() {
  const queryClient = useQueryClient()
  const { activeRouter, setActiveRouter } = useRouterStore()

  // Ambil daftar router via React Query
  const { data: routers = [], isLoading } = useQuery({
    queryKey: ['routers'],
    queryFn: async () => {
      const res = await api.get('/routers.php')
      return res.data.data
    }
  })

  // Sinkronisasi awal: pastikan activeRouter ada dan sinkron dengan database (is_active=1)
  useEffect(() => {
    if (routers.length > 0) {
      const dbActive = routers.find((r: any) => r.is_active === 1)
      
      if (!activeRouter) {
        // Jika belum ada di store, gunakan yang is_active=1 atau yang pertama
        setActiveRouter(dbActive || routers[0])
      } else {
        // Selalu sinkronkan data di store dengan versi terbaru dari database
        const latestData = routers.find((r: any) => r.id === activeRouter.id)
        if (latestData) {
          // Periksa apakah ada perubahan data (untuk menghindari loop render, meski zustand menangani ini)
          if (JSON.stringify(latestData) !== JSON.stringify(activeRouter)) {
            setActiveRouter(latestData)
          }
        } else {
          setActiveRouter(dbActive || routers[0])
        }
      }
    }
  }, [routers, activeRouter?.id, setActiveRouter])

  // Mutation untuk ganti router aktif
  const mutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch('/routers.php', { id })
    },
    onSuccess: (_, id) => {
      // Cari router yang baru dipilih dari data yang ada
      const newActive = routers.find((r: any) => r.id === id)
      if (newActive) {
        setActiveRouter(newActive)
        toast.success(`Monitoring berhasil berpindah ke router ${newActive.name}`)
      }
      
      // Invalidate queries agar data router (is_active) diperbarui di semua komponen
      queryClient.invalidateQueries({ queryKey: ['routers'] })
      // Reset total cache agar semua halaman dipaksa ambil data baru dari MikroTik yang baru
      queryClient.resetQueries()
    },
    onError: () => {
      toast.error('Gagal memindah router')
    }
  })

  if (routers.length <= 1 && !isLoading) return null

  return (
    <div className='flex items-center gap-2'>
      <div className='relative flex items-center justify-center'>
        <Server className='h-4 w-4 text-primary' />
        <span 
          className={cn(
            "absolute -top-1 -right-1 block h-2 w-2 rounded-full ring-2 ring-background",
            activeRouter ? "bg-green-500 animate-pulse" : "bg-yellow-500"
          )}
        />
      </div>
      
      <Select
        value={activeRouter?.id?.toString()}
        onValueChange={(val) => mutation.mutate(parseInt(val))}
        disabled={isLoading || mutation.isPending}
      >
        <SelectTrigger className='h-9 w-[180px] font-semibold'>
          <SelectValue placeholder='Pilih Router' />
        </SelectTrigger>
        <SelectContent>
          {routers.map((router: any) => (
            <SelectItem key={router.id} value={router.id.toString()}>
              {router.name || router.host}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
