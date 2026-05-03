import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface Props {
  isOpen: boolean
  onClose: () => void
  selectedUsernames: string[]
  profiles: string[]
  odps: { id: number, name: string }[]
}

export function CustomerBulkEditDialog({ isOpen, onClose, selectedUsernames, profiles, odps }: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  
  const [updateProfile, setUpdateProfile] = useState(false)
  const [profile, setProfile] = useState(profiles[0] || 'default')
  
  const [updateDisabled, setUpdateDisabled] = useState(false)
  const [disabled, setDisabled] = useState<'yes' | 'no'>('no')
  
  const [updateODP, setUpdateODP] = useState(false)
  const [odpId, setOdpId] = useState<string>('none')

  const mutation = useMutation({
    mutationFn: async () => {
      const updates: any = {}
      if (updateProfile) updates.profile = profile
      if (updateDisabled) updates.disabled = disabled
      if (updateODP) updates.odp_id = odpId === 'none' ? null : parseInt(odpId)

      const res = await api.post('/bulk_update_users.php', {
        usernames: selectedUsernames,
        updates,
        router_id: activeRouter?.id,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message)
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        onClose()
      } else {
        toast.error(data.error || 'Gagal memperbarui data')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Terjadi kesalahan sistem')
    }
  })

  const handleSave = () => {
    if (!updateProfile && !updateDisabled && !updateODP) {
        toast.warning('Pilih minimal satu bidang untuk diperbarui')
        return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Masal Pelanggan ({selectedUsernames.length})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">Pilih kolom yang ingin diubah untuk semua pelanggan terpilih:</p>
          
          {/* Profile */}
          <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
                <Checkbox id="upd-profile" checked={updateProfile} onCheckedChange={(v) => setUpdateProfile(!!v)} />
                <Label htmlFor="upd-profile" className="text-xs font-bold">Paket (Profile)</Label>
            </div>
            {updateProfile && (
                <Select value={profile} onValueChange={setProfile}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih Paket" />
                    </SelectTrigger>
                    <SelectContent>
                        {profiles.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
                <Checkbox id="upd-disabled" checked={updateDisabled} onCheckedChange={(v) => setUpdateDisabled(!!v)} />
                <Label htmlFor="upd-disabled" className="text-xs font-bold">Status Aktif</Label>
            </div>
            {updateDisabled && (
                <Select value={disabled} onValueChange={(v) => setDisabled(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="no" className="text-xs">Enabled</SelectItem>
                        <SelectItem value="yes" className="text-xs">Disabled</SelectItem>
                    </SelectContent>
                </Select>
            )}
          </div>

          {/* ODP */}
          <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
                <Checkbox id="upd-odp" checked={updateODP} onCheckedChange={(v) => setUpdateODP(!!v)} />
                <Label htmlFor="upd-odp" className="text-xs font-bold">Hubungkan ke ODP</Label>
            </div>
            {updateODP && (
                <Select value={odpId} onValueChange={setOdpId}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih ODP" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none" className="text-xs">Tanpa ODP</SelectItem>
                        {odps.map(o => <SelectItem key={o.id} value={o.id.toString()} className="text-xs">{o.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
