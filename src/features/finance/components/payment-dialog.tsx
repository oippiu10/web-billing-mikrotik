import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCheck, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  paidDialog: any
  privacyMode: boolean
  onSave: (payload: { calculatedAmount: number; calculatedNote: string; calculatedMethod?: string; calculatedDate?: string }) => void
  isPending: boolean
  fmt: (n: number) => string
}

export function PaymentDialog({
  isOpen,
  onClose,
  paidDialog,
  privacyMode,
  onSave,
  isPending,
  fmt,
}: PaymentDialogProps) {
  const now = new Date()
  const [isInstallmentMode, setIsInstallmentMode] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [paidDate, setPaidDate] = useState(now.toISOString().slice(0, 10))
  const [paidMethod, setPaidMethod] = useState('cash')
  const [paidNote, setPaidNote] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentNote, setInstallmentNote] = useState('')

  useEffect(() => {
    if (paidDialog) {
      const initAmt = paidDialog.paid_amount || paidDialog.harga || 0
      setPaidAmount(String(initAmt))
      setPaidDate(paidDialog.paid_at || now.toISOString().slice(0, 10))
      setPaidMethod(paidDialog.method || 'cash')
      setPaidNote(paidDialog.note || '')
      setInstallmentAmount('')
      setInstallmentNote('')
      setIsInstallmentMode(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidDialog, isOpen])

  if (!paidDialog) return null

  const hasInstallment = parseFloat(String(paidDialog.paid_amount || 0)) > 0

  const handleSave = () => {
    // Validasi Form
    if (isInstallmentMode) {
      const instAmt = parseFloat(installmentAmount || '0')
      if (!instAmt || instAmt <= 0) {
        toast.error('Nominal angsuran harus diisi dan lebih dari 0')
        return
      }
    } else {
      const amt = parseFloat(paidAmount || '0')
      if (!amt || amt <= 0) {
        toast.error('Nominal pembayaran harus diisi dan lebih dari 0')
        return
      }
    }
    if (!paidDate) {
      toast.error('Tanggal bayar harus diisi')
      return
    }

    let finalAmount = parseFloat(paidAmount) || parseFloat(paidDialog.harga || 0) || 0
    let finalNote = paidNote

    if (isInstallmentMode) {
      const prevAmount = parseFloat(String(paidDialog.paid_amount || 0))
      const instAmt = parseFloat(installmentAmount || '0')
      finalAmount = prevAmount + instAmt

      const instDesc = `[Angsuran: +${fmt(instAmt)} tgl ${paidDate} (${paidMethod.toUpperCase()})${
        installmentNote ? ' - ' + installmentNote : ''
      }]`

      if (paidDialog.note && paidDialog.note.includes('[Angsuran:')) {
        finalNote = `${paidDialog.note}\n${instDesc}`
      } else {
        const firstDesc = `[Awal: ${fmt(prevAmount)} tgl ${
          paidDialog.paid_at || paidDate
        } (${(paidDialog.method || 'CASH').toUpperCase()})${
          paidDialog.note ? ' - ' + paidDialog.note : ''
        }]`
        finalNote = `${firstDesc}\n${instDesc}`
      }
    } else {
      const match = paidNote.match(/\[Awal:\s*Rp\s*([\d.]+)/)
      const awalAmt = match ? parseFloat(match[1].replace(/\./g, '')) : 0
      if (finalAmount === awalAmt && paidNote.includes('[Angsuran:')) {
        const lines = paidNote.split('\n')
        const awalLine = lines.find((l: string) => l.startsWith('[Awal:'))
        if (awalLine) {
          finalNote = awalLine
        }
      }
    }

    onSave({
      calculatedAmount: finalAmount,
      calculatedNote: finalNote,
      calculatedMethod: paidMethod,
      calculatedDate: paidDate,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-sm rounded-3xl border shadow-2xl'>
        <DialogHeader>
          <DialogTitle className='text-base font-black tracking-tight'>
            {hasInstallment ? 'Edit Pembayaran' : 'Tandai Lunas'} — {paidDialog.username}
          </DialogTitle>
        </DialogHeader>

        {hasInstallment && (
          <div className='grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg text-xs font-bold mb-1 select-none border'>
            <button
              type='button'
              onClick={() => setIsInstallmentMode(false)}
              className={cn(
                'py-1.5 rounded-md transition-all font-semibold',
                !isInstallmentMode
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Koreksi Total
            </button>
            <button
              type='button'
              onClick={() => setIsInstallmentMode(true)}
              className={cn(
                'py-1.5 rounded-md transition-all font-semibold',
                isInstallmentMode
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Tambah Angsuran
            </button>
          </div>
        )}

        <div className='space-y-3 py-2'>
          {isInstallmentMode ? (
            <>
              {/* Installment Summary Panel */}
              <div className='bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border text-xs space-y-1.5 mb-2'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground font-medium'>Total Tagihan Paket:</span>
                  <span className='font-mono font-extrabold text-foreground'>
                    {fmt(parseFloat(String(paidDialog.harga || 0)))}
                  </span>
                </div>
                <div className='flex justify-between text-emerald-600 dark:text-emerald-400 font-medium'>
                  <span>Terbayar Sebelumnya:</span>
                  <span className='font-mono font-extrabold'>
                    {fmt(parseFloat(String(paidDialog.paid_amount || 0)))}
                  </span>
                </div>
                <div className='flex justify-between text-rose-500 font-bold border-t border-dashed pt-1.5'>
                  <span>Sisa Kekurangan:</span>
                  <span className='font-mono font-extrabold'>
                    {fmt(
                      Math.max(
                        0,
                        parseFloat(String(paidDialog.harga || 0)) -
                          parseFloat(String(paidDialog.paid_amount || 0))
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Additional Amount input */}
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Nominal Tambahan Setor (Rp)
                </label>
                <Input
                  type={privacyMode ? 'password' : 'number'}
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className='mt-1 font-mono rounded-xl'
                  placeholder='0'
                />
                {parseFloat(installmentAmount || '0') > 0 && (
                  <div className='flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-900 px-2 py-1.5 rounded-lg mt-1.5 select-none'>
                    <span>Total Setelah Setor:</span>
                    <span
                      className={cn(
                        'font-mono font-extrabold',
                        parseFloat(String(paidDialog.paid_amount || 0)) +
                          parseFloat(installmentAmount || '0') >=
                          parseFloat(String(paidDialog.harga || 0))
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      )}
                    >
                      {fmt(
                        parseFloat(String(paidDialog.paid_amount || 0)) +
                          parseFloat(installmentAmount || '0')
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Date of installment */}
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Tanggal Setor
                </label>
                <Input
                  type='date'
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className='mt-1 rounded-xl'
                />
              </div>

              {/* Method of installment */}
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Metode Setor
                </label>
                <Select value={paidMethod} onValueChange={setPaidMethod}>
                  <SelectTrigger className='mt-1 rounded-xl'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value='cash'>Tunai</SelectItem>
                    <SelectItem value='transfer'>Transfer Bank</SelectItem>
                    <SelectItem value='qris'>QRIS</SelectItem>
                    <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                    <SelectItem value='titipan'>Titipan / Deposit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Note of installment */}
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Catatan Setoran (Opsional)
                </label>
                <Input
                  value={installmentNote}
                  onChange={(e) => setInstallmentNote(e.target.value)}
                  className='mt-1 rounded-xl'
                  placeholder='Misal: Pelunasan sisa...'
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Nominal (Rp)
                </label>
                <Input
                  type={privacyMode ? 'password' : 'number'}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className='mt-1 font-mono rounded-xl'
                  placeholder='0'
                />
                {parseFloat(String(paidDialog.harga || 0)) > 0 && (
                  <div className='flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-900 px-2 py-1.5 rounded-lg mt-1.5 select-none'>
                    <span>
                      Paket:{' '}
                      <span className='font-mono font-extrabold text-foreground'>
                        {fmt(parseFloat(String(paidDialog.harga || 0)))}
                      </span>
                    </span>
                    {parseFloat(String(paidAmount || 0)) < parseFloat(String(paidDialog.harga || 0)) ? (
                      <span className='text-rose-500 font-black uppercase tracking-wider scale-95'>
                        Kurang:{' '}
                        {fmt(
                          parseFloat(String(paidDialog.harga || 0)) -
                            parseFloat(String(paidAmount || 0))
                        )}
                      </span>
                    ) : (
                      <span className='text-emerald-600 font-black uppercase tracking-wider scale-95'>
                        Lunas
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Tanggal Bayar
                </label>
                <Input
                  type='date'
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className='mt-1 rounded-xl'
                />
              </div>
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Metode
                </label>
                <Select value={paidMethod} onValueChange={setPaidMethod}>
                  <SelectTrigger className='mt-1 rounded-xl'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value='cash'>Tunai</SelectItem>
                    <SelectItem value='transfer'>Transfer Bank</SelectItem>
                    <SelectItem value='qris'>QRIS</SelectItem>
                    <SelectItem value='e-wallet'>E-Wallet</SelectItem>
                    <SelectItem value='titipan'>Titipan / Deposit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                  Catatan (Opsional)
                </label>
                <Input
                  value={paidNote}
                  onChange={(e) => setPaidNote(e.target.value)}
                  className='mt-1 rounded-xl'
                  placeholder='Catatan tambahan...'
                />
                {paidNote && paidNote.includes('[Angsuran:') && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const lines = paidNote.split('\n')
                      const awalLine = lines.find((l: string) => l.startsWith('[Awal:'))
                      if (awalLine) {
                        setPaidNote(awalLine)
                        const match = awalLine.match(/\[Awal:\s*Rp\s*([\d.]+)/)
                        if (match) {
                          const awalAmt = parseFloat(match[1].replace(/\./g, ''))
                          setPaidAmount(String(awalAmt))
                        }
                      } else {
                        setPaidNote('')
                        setPaidAmount(String(paidDialog.harga || 0))
                      }
                      toast.success(
                        'Log angsuran dibersihkan! Nominal dikembalikan ke pembayaran awal.'
                      )
                    }}
                    className='mt-2 text-[9px] h-7 px-2.5 text-rose-500 border-rose-200 hover:bg-rose-50 rounded-xl transition-all w-full justify-center flex'
                  >
                    <RefreshCw className='mr-1.5 h-3.5 w-3.5 animate-spin' /> Reset Log Angsuran
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant='outline' onClick={onClose} className="rounded-xl font-bold border-2">
            Batal
          </Button>
          <Button
            className='bg-green-500 hover:bg-green-600 rounded-xl font-bold px-5 text-white'
            onClick={handleSave}
            disabled={isPending}
          >
            <CheckCheck className='mr-1.5 h-4 w-4' /> Simpan Pembayaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
