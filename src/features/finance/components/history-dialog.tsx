import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PrivacyText } from '@/components/privacy'
import {
  History,
  Receipt,
  Calendar,
  Trash2,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryDialogProps {
  isOpen: boolean
  onClose: () => void
  historyUser: any
  isHistoryLoading: boolean
  userHistory: any[]
  fmt: (n: number) => string
  handleDeleteAngsuran: (pay: any, content: string, originalPart: string) => void
}

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const parseNote = (noteText: string) => {
  if (!noteText) return []
  const lines = noteText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.map((line, idx) => {
    const isStructured = line.startsWith('[') && line.includes(']')
    if (isStructured) {
      const content = line.substring(1, line.length - 1)
      return { id: idx, content, isStructured: true }
    }
    return { id: idx, content: line, isStructured: false }
  })
}

export function HistoryDialog({
  isOpen,
  onClose,
  historyUser,
  isHistoryLoading,
  userHistory,
  fmt,
  handleDeleteAngsuran,
}: HistoryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-md gap-0 overflow-hidden p-0 rounded-3xl border shadow-2xl'>
        <DialogHeader className='flex flex-row items-center justify-between gap-4 border-b p-4'>
          <DialogTitle className='flex items-center gap-2 text-base font-black tracking-tight'>
            <History className='h-4 w-4 text-primary' />
            Riwayat Pembayaran
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh]'>
          <div className='space-y-4 p-4'>
            {/* Identity Header */}
            <div className='flex items-center justify-between border-b border-border/50 pb-2'>
              <div>
                <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
                  Username Pelanggan
                </p>
                <p className='text-lg font-black tracking-tight'>
                  <PrivacyText>{historyUser?.username}</PrivacyText>
                </p>
              </div>
            </div>

            {/* History list */}
            {isHistoryLoading ? (
              <div className='space-y-3 py-2'>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className='animate-pulse space-y-2 rounded-2xl border bg-muted/10 p-3'
                  >
                    <div className='flex justify-between'>
                      <div className='h-4 w-28 rounded bg-muted' />
                      <div className='h-4 w-16 rounded bg-muted' />
                    </div>
                    <div className='h-3.5 w-32 rounded bg-muted' />
                  </div>
                ))}
              </div>
            ) : !userHistory || userHistory.length === 0 ? (
              <div className='flex flex-col items-center justify-center space-y-3 py-12 text-center'>
                <div className='rounded-full bg-muted/40 p-3'>
                  <Receipt className='h-8 w-8 text-muted-foreground/60' />
                </div>
                <div>
                  <h4 className='text-sm font-bold text-foreground'>
                    Belum Ada Riwayat Bayar
                  </h4>
                  <p className='mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground'>
                    Pelanggan ini belum memiliki catatan riwayat pembayaran di database.
                  </p>
                </div>
              </div>
            ) : (
              <div className='space-y-3'>
                <p className='px-1 text-[10px] font-black tracking-wider text-muted-foreground uppercase'>
                  Daftar Transaksi ({userHistory.length})
                </p>
                <div className='space-y-2.5'>
                  {userHistory.map((pay: any) => {
                    const methodLower = (pay.method || 'cash').toLowerCase()
                    let methodColor =
                      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' // Cash
                    if (
                      methodLower.includes('tf') ||
                      methodLower.includes('transfer') ||
                      methodLower.includes('bank')
                    ) {
                      methodColor =
                        'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                    } else if (
                      methodLower.includes('qris') ||
                      methodLower.includes('link') ||
                      methodLower.includes('dana') ||
                      methodLower.includes('gopay')
                    ) {
                      methodColor =
                        'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    }

                    const monthName =
                      MONTHS_ID[pay.payment_month - 1] || `Bulan ${pay.payment_month}`

                    return (
                      <div
                        key={pay.id}
                        className='space-y-2.5 rounded-2xl border border-border/60 bg-card p-3 transition-all duration-300 hover:shadow-md'
                      >
                        {/* Header row */}
                        <div className='flex items-center justify-between border-b border-border/40 pb-1.5'>
                          <div className='flex items-center gap-1.5'>
                            <Calendar className='h-3.5 w-3.5 text-indigo-500' />
                            <span className='text-sm font-black text-foreground'>
                              {monthName} {pay.payment_year}
                            </span>
                          </div>
                          <Badge className='h-4.5 bg-emerald-500 px-2 text-[9px] font-black hover:bg-emerald-600 rounded-lg'>
                            LUNAS
                          </Badge>
                        </div>

                        {/* Amount & Method */}
                        <div className='flex items-center justify-between text-xs'>
                          <div>
                            <p className='text-[9px] font-bold text-muted-foreground'>
                              NOMINAL
                            </p>
                            <p className='font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400'>
                              <PrivacyText>{fmt(pay.amount)}</PrivacyText>
                            </p>
                          </div>
                          <div className='text-right'>
                            <p className='text-[9px] font-bold text-muted-foreground'>
                              METODE
                            </p>
                            <span
                              className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase ${methodColor}`}
                            >
                              {pay.method || 'CASH'}
                            </span>
                          </div>
                        </div>

                        {/* Date of payment & Note */}
                        <div className='space-y-1 border-t border-dashed border-border/50 pt-1.5 text-[10px]'>
                          <div className='flex items-center justify-between text-muted-foreground'>
                            <span>Tanggal Bayar:</span>
                            <span className='font-bold text-foreground/80'>
                              {pay.payment_date}
                            </span>
                          </div>
                          {pay.note && (
                            <div className='mt-2 space-y-1.5 border-t border-dashed border-border/30 pt-2 select-none'>
                              <p className='text-[8px] font-black text-muted-foreground uppercase tracking-wider'>
                                Rincian Riwayat Setoran / Catatan:
                              </p>
                              <div className='space-y-1.5'>
                                {parseNote(pay.note).map((item) => (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      'text-xs font-semibold px-2 py-1.5 rounded-lg flex items-center gap-2 border leading-normal',
                                      item.isStructured
                                        ? 'bg-slate-50 dark:bg-slate-900/60 border-border/60 text-foreground font-mono text-[9px]'
                                        : 'bg-muted/40 border-border/30 text-foreground/80 italic'
                                    )}
                                  >
                                    {item.isStructured ? (
                                      <div className='flex items-center justify-between w-full gap-2'>
                                        <div className='flex items-center gap-2'>
                                          <div className='h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 shadow-xs' />
                                          <span className='break-all'>{item.content}</span>
                                        </div>
                                        {item.content.includes('Angsuran:') && (
                                          <Button
                                            type='button'
                                            variant='ghost'
                                            size='icon'
                                            onClick={() =>
                                              handleDeleteAngsuran(
                                                pay,
                                                item.content,
                                                `[${item.content}]`
                                              )
                                            }
                                            className='h-5 w-5 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 transition-colors'
                                            title='Hapus setoran angsuran ini'
                                          >
                                            <Trash2 className='h-3.5 w-3.5' />
                                          </Button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className='flex items-center gap-2 w-full'>
                                        <FileText className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                                        <span className='w-full'>{item.content}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className='flex justify-end border-t bg-muted/20 p-3'>
          <Button
            size='sm'
            onClick={onClose}
            className='h-8 px-4 text-xs rounded-xl font-bold'
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
