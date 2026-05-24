import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle, Info, ChevronLeft, ChevronRight, Hash, Send, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { type Customer } from '../data/schema'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface Props {
  selectedCustomers: Customer[]
  profiles?: string[]
  odps: { id: number, name: string }[]
  total: number
  totalComplete: number
  page: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  onClose: () => void
}

export function BatchEditCustomers({ 
    selectedCustomers, 
    odps, 
    total, 
    totalComplete,
    page, 
    onPageChange, 
    isLoading,
    onClose 
}: Props) {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [editedData, setEditedData] = useState<any[]>([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const perPage = 10
  const totalPages = Math.ceil(total / perPage)

  useEffect(() => {
    setEditedData(selectedCustomers.map(c => ({
      id: c.id,
      username: c.username,
      wa: c.wa || '',
      alamat: c.alamat || '',
      redaman: c.redaman || '',
      tanggal_tagihan: c.tanggal_tagihan?.toString() || '',
      odp_id: c.odp_id?.toString() || 'none',
      tipe_langganan: c.tipe_langganan || 'pascabayar'
    })))
  }, [selectedCustomers])

  const handleFieldChange = (index: number, field: string, value: any) => {
    const newData = [...editedData]
    newData[index][field] = value
    setEditedData(newData)
  }

  // Detect which rows have been modified
  const modifiedRows = useMemo(() => {
    return editedData.filter((row) => {
      const original = selectedCustomers.find(c => c.id === row.id)
      if (!original) return false
      
      return (
        row.wa !== (original.wa || '') ||
        row.alamat !== (original.alamat || '') ||
        row.redaman !== (original.redaman || '') ||
        row.tanggal_tagihan !== (original.tanggal_tagihan?.toString() || '') ||
        row.odp_id !== (original.odp_id?.toString() || 'none') ||
        row.tipe_langganan !== (original.tipe_langganan || 'pascabayar')
      )
    })
  }, [editedData, selectedCustomers])

  const isRowModified = (id: number) => modifiedRows.some(r => r.id === id)

  const mutation = useMutation({
    mutationFn: async () => {
      const updates = modifiedRows.map(item => ({
        ...item,
        odp_id: item.odp_id === 'none' ? null : parseInt(item.odp_id),
        tanggal_tagihan: item.tanggal_tagihan === '' ? null : parseInt(item.tanggal_tagihan)
      }))

      const res = await api.post('/bulk_upsert_users.php', {
        router_id: activeRouter?.id,
        updates
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success && (!data.details || data.details.errors === 0)) {
        toast.success(data.message)
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        setIsConfirmOpen(false)
      } else if (data.success && data.details?.errors > 0) {
        toast.warning(`${data.message}. Periksa detail error.`)
      } else {
        toast.error(data.message || 'Gagal menyimpan perubahan')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan sistem')
    }
  })

  const stats = editedData.reduce((acc, curr) => {
    const isMissing = !curr.wa || !curr.alamat || !curr.redaman || curr.odp_id === 'none' || (curr.tipe_langganan !== 'prabayar' && !curr.tanggal_tagihan)
    if (isMissing) acc.missing++
    else acc.complete++
    return acc
  }, { missing: 0, complete: 0 })

  return (
    <div className="flex flex-col h-full bg-background border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium */}
      <div className="flex flex-col border-b bg-gradient-to-r from-muted/50 to-background">
        <div className="flex flex-wrap items-center justify-between px-6 py-4 md:px-8 md:py-6 gap-4">
            <div className="flex items-center gap-3 md:gap-5">
            <Button variant="outline" size="icon" onClick={onClose} className="rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground truncate max-w-[200px] md:max-w-none">Penataan Data</h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Hal {page}/{totalPages}</p>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <p className="text-[10px] md:text-xs text-blue-600 font-semibold">{modifiedRows.length} diedit</p>
                </div>
            </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 ml-auto">
                {/* Stats Chips */}
                <div className="hidden sm:flex items-center gap-1 p-1 bg-muted/50 rounded-2xl border">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl shadow-sm border border-green-100">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-[10px] font-bold text-green-700">{totalComplete} / {total} Global</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl shadow-sm border border-red-100">
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        <span className="text-[10px] font-bold text-red-700">{total - totalComplete} Belum</span>
                    </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-border mx-1" />

                <div className="flex items-center gap-2">
                    <Button 
                        className={cn(
                            "rounded-xl gap-2 font-bold px-4 md:px-6 h-9 md:h-10 text-xs md:text-sm shadow-lg transition-all",
                            modifiedRows.length > 0 
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25" 
                                : "bg-muted text-muted-foreground shadow-none"
                        )}
                        onClick={() => setIsConfirmOpen(true)}
                        disabled={modifiedRows.length === 0 || mutation.isPending || isLoading}
                    >
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan
                    </Button>
                </div>
            </div>
        </div>

        {/* Floating Quick Pagination */}
        <div className="flex items-center justify-center pb-4">
            <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-full border shadow-sm scale-90 md:scale-100">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 rounded-full px-2" 
                    disabled={page <= 1 || isLoading}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <div className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-x">
                    Hal {page} / {totalPages}
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 rounded-full px-2" 
                    disabled={page >= totalPages || isLoading}
                    onClick={() => onPageChange(page + 1)}
                >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
      </div>

      {/* Spreadsheet Content */}
      <div className="flex-1 overflow-auto p-0 relative bg-muted/10 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {isLoading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 p-8 bg-background rounded-3xl shadow-2xl border">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <div className="text-center">
                        <p className="text-sm font-bold">Sinkronisasi Data...</p>
                        <p className="text-xs text-muted-foreground mt-1">Mengambil data dari server</p>
                    </div>
                </div>
            </div>
        )}
        <div className="min-w-max">
            <Table className="border-separate border-spacing-0">
            <TableHeader className="bg-background sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center border-b font-black text-xs uppercase tracking-tighter text-muted-foreground/50"><Hash className="h-3 w-3 mx-auto" /></TableHead>
                <TableHead className="min-w-[150px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70 py-4">Pelanggan</TableHead>
                <TableHead className="min-w-[150px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">WhatsApp</TableHead>
                <TableHead className="min-w-[200px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">Alamat Pemasangan</TableHead>
                <TableHead className="min-w-[100px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">Redaman</TableHead>
                <TableHead className="min-w-[180px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">Lokasi ODP</TableHead>
                <TableHead className="min-w-[120px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">Tipe</TableHead>
                <TableHead className="min-w-[100px] border-b font-black text-xs uppercase tracking-widest text-muted-foreground/70">Tagihan</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {editedData.map((row, idx) => {
                const isModified = isRowModified(row.id)
                const isComplete = row.wa && row.alamat && row.redaman && row.odp_id !== 'none' && (row.tipe_langganan === 'prabayar' || row.tanggal_tagihan)
                
                return (
                    <TableRow key={row.username} className={cn(
                        "group transition-colors",
                        isModified ? "bg-blue-50/30 hover:bg-blue-50/50" : 
                        isComplete ? "bg-green-50/20 hover:bg-green-50/40" : "bg-background hover:bg-muted/30"
                    )}>
                    <TableCell className="text-center text-[10px] text-muted-foreground/50 font-black border-b">{((page - 1) * perPage) + idx + 1}</TableCell>
                    <TableCell className="border-b py-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{row.username}</span>
                                {isComplete && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                            </div>
                            {isModified && <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-1"><AlertCircle className="h-2 w-2" /> Perubahan Terdeteksi</span>}
                            {isComplete && !isModified && <span className="text-[9px] font-bold text-green-600 uppercase tracking-tighter flex items-center gap-1">Data Lengkap</span>}
                        </div>
                    </TableCell>
                    <TableCell className="border-b">
                        <Input 
                        value={row.wa} 
                        onChange={(e) => handleFieldChange(idx, 'wa', e.target.value)}
                        placeholder="+628..."
                        className={cn(
                            "h-9 text-xs border-transparent bg-transparent hover:border-input focus:bg-background transition-all font-medium",
                            !row.wa && "bg-red-50/50 border-red-100 placeholder:text-red-300"
                        )}
                        />
                    </TableCell>
                    <TableCell className="border-b">
                        <Input 
                        value={row.alamat} 
                        onChange={(e) => handleFieldChange(idx, 'alamat', e.target.value)}
                        placeholder="Nama jalan / No rumah"
                        className={cn(
                            "h-9 text-xs border-transparent bg-transparent hover:border-input focus:bg-background transition-all font-medium",
                            !row.alamat && "bg-red-50/50 border-red-100 placeholder:text-red-300"
                        )}
                        />
                    </TableCell>
                    <TableCell className="border-b">
                        <Input 
                        value={row.redaman} 
                        onChange={(e) => handleFieldChange(idx, 'redaman', e.target.value)}
                        placeholder="-20"
                        className={cn(
                            "h-9 text-xs font-mono border-transparent bg-transparent hover:border-input focus:bg-background transition-all",
                            !row.redaman && "bg-red-50/50 border-red-100 placeholder:text-red-300"
                        )}
                        />
                    </TableCell>
                    <TableCell className="border-b">
                        <Select 
                        value={row.odp_id} 
                        onValueChange={(v) => handleFieldChange(idx, 'odp_id', v)}
                        >
                        <SelectTrigger className={cn(
                            "h-9 text-xs border-transparent bg-transparent hover:border-input transition-all",
                            row.odp_id === 'none' && "bg-red-50/50 border-red-100"
                        )}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" className="text-xs">-- Pilih ODP --</SelectItem>
                            {odps.map(o => <SelectItem key={o.id} value={o.id.toString()} className="text-xs font-medium">{o.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell className="border-b">
                        <Select 
                        value={row.tipe_langganan || 'pascabayar'} 
                        onValueChange={(v) => handleFieldChange(idx, 'tipe_langganan', v)}
                        >
                        <SelectTrigger className="h-9 text-xs border-transparent bg-transparent hover:border-input transition-all font-semibold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="prabayar" className="text-xs">Prabayar</SelectItem>
                            <SelectItem value="pascabayar" className="text-xs">Pascabayar</SelectItem>
                        </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell className="border-b">
                        <Input 
                        value={row.tanggal_tagihan} 
                        onChange={(e) => handleFieldChange(idx, 'tanggal_tagihan', e.target.value)}
                        placeholder="1-31"
                        className={cn(
                            "h-9 text-xs border-transparent bg-transparent hover:border-input focus:bg-background transition-all font-bold",
                            !row.tanggal_tagihan && "bg-red-50/50 border-red-100 placeholder:text-red-300"
                        )}
                        />
                    </TableCell>
                    </TableRow>
                )
                })}
            </TableBody>
            </Table>
        </div>
      </div>

      {/* Footer Info Premium */}
      <div className="px-6 md:px-8 py-4 border-t bg-background flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 md:gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                <Info className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">Database: {totalComplete} / {total} Lengkap</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Baris Biru = Diedit</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Baris Hijau = Lengkap</span>
            </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
             <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs font-bold" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
             <div className="text-[10px] font-black bg-muted px-4 py-1.5 rounded-xl border tracking-widest uppercase">Hal {page} / {totalPages}</div>
             <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs font-bold" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-2 shadow-2xl max-w-[90vw] md:max-w-md">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl md:text-2xl font-black flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Send className="h-5 w-5" />
                    </div>
                    Konfirmasi Update
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm md:text-base py-4">
                    Anda akan memperbarui <span className="font-black text-foreground underline decoration-blue-500 decoration-2">{modifiedRows.length} data pelanggan</span>. 
                    <br/><br/>
                    Perubahan hanya menyimpan data tambahan pelanggan di database, tidak mengubah username/password/profile PPPoE atau konfigurasi MikroTik. Lanjutkan?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="rounded-2xl font-bold border-2 mt-0">Batal</AlertDialogCancel>
                <AlertDialogAction 
                    className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-8"
                    onClick={(e) => {
                        e.preventDefault()
                        mutation.mutate()
                    }}
                >
                    Ya, Simpan Sekarang
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
