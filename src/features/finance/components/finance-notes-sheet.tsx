import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NotebookText, Trash2, Send, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export function FinanceNotesSheet() {
  const { activeRouter } = useRouterStore()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['finance_notes', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/finance_notes.php', {
        params: { action: 'list', router_id: activeRouter?.software_id || activeRouter?.id }
      })
      return res.data?.data || []
    },
    enabled: !!activeRouter && open,
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        action: 'add',
        router_id: activeRouter?.software_id || activeRouter?.id,
        content: noteContent
      }
      const res = await api.post('/finance_notes.php', payload)
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success(d.message || 'Catatan tersimpan')
        setNoteContent('')
        queryClient.invalidateQueries({ queryKey: ['finance_notes'] })
      } else {
        toast.error(d.message || 'Gagal menyimpan')
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const payload = {
        action: 'delete',
        router_id: activeRouter?.software_id || activeRouter?.id,
        id: noteId
      }
      const res = await api.post('/finance_notes.php', payload)
      return res.data
    },
    onSuccess: (d) => {
      if (d.success) {
        toast.success('Catatan dihapus')
        queryClient.invalidateQueries({ queryKey: ['finance_notes'] })
      } else {
        toast.error(d.message || 'Gagal menghapus')
      }
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    addMutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-bold border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-400">
          <NotebookText className="h-4 w-4" />
          <span className="hidden sm:inline">Catatan</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md border-l border-border/50 shadow-2xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <SheetTitle className="flex items-center gap-2">
            <NotebookText className="h-5 w-5 text-indigo-500" />
            Catatan Keuangan
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Simpan janji bayar, target, atau anomali dana di sini.
          </p>
        </SheetHeader>

        {/* Input Area */}
        <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur">
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              placeholder="Tulis catatan baru..."
              className="resize-none pr-12 min-h-[80px] bg-background text-sm focus-visible:ring-indigo-500 rounded-xl"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!noteContent.trim() || addMutation.isPending}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <NotebookText className="h-12 w-12 mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Belum ada catatan</p>
              <p className="text-xs text-muted-foreground">Catatan yang Anda buat akan muncul di sini</p>
            </div>
          ) : (
            notes.map((note: any) => (
              <div key={note.id} className="group relative bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(note.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if(window.confirm('Hapus catatan ini?')) {
                        deleteMutation.mutate(note.id)
                      }
                    }}
                    className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
