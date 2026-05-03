import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
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
  selectedIds: number[]
}

export function ODPBulkEditDialog({ isOpen, onClose, selectedIds }: Props) {
  const queryClient = useQueryClient()
  
  const [updateType, setUpdateType] = useState(false)
  const [type, setType] = useState<'splitter' | 'ratio'>('splitter')
  
  const [updateSplitter, setUpdateSplitter] = useState(false)
  const [splitterType, setSplitterType] = useState('1:8')

  const mutation = useMutation({
    mutationFn: async () => {
      const updates: any = {}
      if (updateType) updates.type = type
      if (updateSplitter) updates.splitter_type = splitterType

      const res = await api.post('/bulk_update_odp.php', {
        ids: selectedIds,
        updates,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message)
        queryClient.invalidateQueries({ queryKey: ['odps'] })
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
    if (!updateType && !updateSplitter) {
        toast.warning('Pilih minimal satu bidang untuk diperbarui')
        return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Masal ODP ({selectedIds.length})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">Pilih kolom yang ingin diubah untuk semua ODP terpilih:</p>
          
          {/* Type */}
          <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
                <Checkbox id="upd-type" checked={updateType} onCheckedChange={(v) => setUpdateType(!!v)} />
                <Label htmlFor="upd-type" className="text-xs font-bold">Tipe ODP</Label>
            </div>
            {updateType && (
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="splitter" className="text-xs">Splitter</SelectItem>
                        <SelectItem value="ratio" className="text-xs">Ratio</SelectItem>
                    </SelectContent>
                </Select>
            )}
          </div>

          {/* Splitter Type */}
          <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
                <Checkbox id="upd-splitter" checked={updateSplitter} onCheckedChange={(v) => setUpdateSplitter(!!v)} />
                <Label htmlFor="upd-splitter" className="text-xs font-bold">Kapasitas (Splitter)</Label>
            </div>
            {updateSplitter && (
                <Select value={splitterType} onValueChange={setSplitterType}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih Kapasitas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1:4" className="text-xs">1:4</SelectItem>
                        <SelectItem value="1:8" className="text-xs">1:8</SelectItem>
                        <SelectItem value="1:16" className="text-xs">1:16</SelectItem>
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
