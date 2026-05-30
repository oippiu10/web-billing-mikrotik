import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Loader2, Download, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaymentCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any | null
}

export function PaymentCardDialog({ open, onOpenChange, user }: PaymentCardDialogProps) {
  const { activeRouter } = useRouterStore()
  const [year, setYear] = useState<number>(new Date().getFullYear())

  // Determine user ID correctly based on source table
  const uid = user?.user_id || user?.id;

  // Reset year when user changes
  useEffect(() => {
    if (open) {
      setYear(new Date().getFullYear())
    }
  }, [open, uid])

  const { data, isLoading } = useQuery({
    queryKey: ['payment-card', uid, year, activeRouter?.id],
    queryFn: async () => {
      if (!uid) return null
      const res = await api.get('/get_payment_card.php', {
        params: {
          user_id: uid,
          router_id: activeRouter?.software_id || activeRouter?.id,
          year: year
        }
      })
      return res.data
    },
    enabled: open && !!uid,
  })

  const fmt = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  // Generate an array of recent years for the dropdown
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full md:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold uppercase tracking-wide">
              KARTU PEMBAYARAN: {data?.user?.username || user?.username}
            </DialogTitle>
            <div className="text-sm text-muted-foreground mt-1">
              {data?.user?.profile || user?.profile} | {data?.user?.alamat || user?.alamat || 'Tanpa Alamat'}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[120px] font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" title="Cetak Kartu">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
            <div className="rounded-xl border shadow-sm bg-background overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#8CB4E2] dark:bg-blue-900/40 text-black dark:text-blue-100">
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-center w-12">No</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-left">Bulan</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-right">Iuran Bulanan</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-right">Kekurangan Bln Kemarin</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-right">Tagihan Bulan Ini</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-right w-32">Bayar</th>
                    <th className="border-r border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-right w-32">Sisa Tagihan</th>
                    <th className="border-b border-[#5B88C6] dark:border-blue-800/50 p-2.5 font-bold text-left">Ket</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px]">
                  {data?.data?.map((row: any, i: number) => {
                    const isFullyPaid = row.sisa_tagihan <= 0 && row.tagihan_bulan_ini > 0;
                    const isUnpaid = row.sisa_tagihan > 0;
                    
                    return (
                      <tr key={i} className="hover:bg-muted/50 border-b last:border-0 transition-colors">
                        <td className="p-2 border-r text-center font-sans font-medium">{row.no}</td>
                        <td className="p-2 border-r font-sans font-medium">{row.bulan}</td>
                        <td className="p-2 border-r text-right">{fmt(row.iuran_bulanan)}</td>
                        <td className="p-2 border-r text-right">{fmt(row.kekurangan_kemarin)}</td>
                        <td className="p-2 border-r text-right font-bold bg-slate-50 dark:bg-slate-900/50">{fmt(row.tagihan_bulan_ini)}</td>
                        <td className={cn(
                          "p-2 border-r text-right font-bold transition-colors",
                          isFullyPaid ? "bg-[#32CD32]/20 dark:bg-[#32CD32]/30 text-emerald-800 dark:text-emerald-300" :
                          row.bayar > 0 && isUnpaid ? "bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300" :
                          row.tagihan_bulan_ini > 0 && row.bayar === 0 ? "bg-[#FF4500]/20 dark:bg-[#FF4500]/30 text-red-800 dark:text-red-300" : ""
                        )}>
                          {fmt(row.bayar)}
                        </td>
                        <td className={cn(
                          "p-2 border-r text-right transition-colors font-bold",
                          row.sisa_tagihan > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          {row.sisa_tagihan > 0 ? `-${fmt(row.sisa_tagihan)}` : fmt(0)}
                        </td>
                        <td className="p-2 text-left font-sans text-xs text-muted-foreground">{row.keterangan || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-800">
                    <td colSpan={2} className="p-3 text-right">TOTAL {year}:</td>
                    <td className="p-3 text-right">{fmt(data?.summary?.total_iuran || 0)}</td>
                    <td className="p-3 text-right"></td>
                    <td className="p-3 text-right"></td>
                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-400">{fmt(data?.summary?.total_bayar || 0)}</td>
                    <td className="p-3 text-right text-red-600 dark:text-red-400">
                      {(data?.summary?.sisa_akhir || 0) > 0 ? `-${fmt(data?.summary?.sisa_akhir)}` : fmt(0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
