/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import {
  MessageSquare,
  Send,
  RefreshCw,
  Trash2,
  Search,
  Check,
  CheckCheck,
  X,
  Clock,
  Settings,
  Smartphone,
  AlertCircle,
  Menu,
  PhoneCall,
  AlignLeft,
  ChevronRight,
  UserPlus,
  ChevronsUpDown,
  User,
  ArrowLeft,
  Wifi,
  WifiOff,
  Zap,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { RouterSelector } from '@/components/router-selector'
import { ThemeSwitch } from '@/components/theme-switch'

export const Route = createFileRoute(
  '/_authenticated/automation/whatsapp-center'
)({
  component: WhatsAppCenter,
})

interface WaLog {
  id: number
  router_id: string
  phone: string
  message: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'received'
  error_message: string | null
  sent_at: string | null
  created_at: string
}

interface WaStats {
  total: number
  sent: number
  pending: number
  failed: number
}

interface ApiResponse {
  success: boolean
  data: WaLog[]
  pagination: {
    total_rows: number
    total_pages: number
    current_page: number
    limit: number
  }
  stats: WaStats
}

// ── TEMPLATE PESAN WA BAWAAN PREMIUM UNTUK ISP MIKROTIK ─────────────────────────
const MESSAGE_TEMPLATES = [
  {
    id: 'billing_reminder',
    name: '🔔 Pengingat Tagihan Bulanan',
    text: `Halo [Nama Pelanggan],\n\nKami menginformasikan bahwa tagihan internet WiFiKu Anda untuk bulan ini telah diterbitkan.\n\nDetail Tagihan:\n• Layanan: Internet Home\n• Total Tagihan: Rp [Jumlah]\n• Jatuh Tempo: [Tanggal]\n\nSilakan lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari isolir otomatis.\n\nTerima kasih.`,
  },
  {
    id: 'isolir_notice',
    name: '🚫 Pemberitahuan Isolir Layanan',
    text: `Pemberitahuan Isolir Layanan\n\nYth. Bapak/Ibu [Nama Pelanggan],\n\nKami informasikan bahwa layanan internet WiFiKu Anda saat ini terisolir otomatis sementara karena belum ada pembayaran yang tercatat melewati batas jatuh tempo.\n\nUntuk mengaktifkan kembali layanan internet Anda secara otomatis, silakan lakukan pembayaran tagihan sebesar Rp [Jumlah].\n\nJika sudah melakukan transfer, harap kirimkan bukti bayar ke admin.\n\nTerima kasih.`,
  },
  {
    id: 'payment_received',
    name: '✅ Konfirmasi Pembayaran Lunas',
    text: `Pembayaran Diterima (LUNAS)\n\nHalo [Nama Pelanggan],\n\nTerima kasih! Pembayaran tagihan internet Anda sebesar Rp [Jumlah] telah kami terima dengan sukses.\n\nLayanan internet Anda saat ini telah aktif kembali secara otomatis. Selamat menikmati kembali berselancar internet tanpa batas!\n\nSalam Hangat,\nWiFiKu Admin`,
  },
  {
    id: 'welcome_new',
    name: '🎉 Informasi Akun Baru (Welcome)',
    text: `Selamat Bergabung di WiFiKu!\n\nHalo [Nama Pelanggan],\n\nPemasangan internet Anda telah selesai dan aktif. Berikut adalah detail akun internet Anda:\n• Username PPPoE: [Username]\n• Password PPPoE: [Password]\n\nSimpan detail akun ini secara aman. Jika ada kendala koneksi, silakan hubungi tim helpdesk kami.\n\nTerima kasih telah memilih WiFiKu!`,
  },
]

function WhatsAppCenter() {
  const queryClient = useQueryClient()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const search: any = useSearch({ strict: false })
  const navigate = useNavigate()

  // States Utama
  const [activeTab, setActiveTab] = useState<'chats' | 'customers'>('chats')
  const [searchLeft, setSearchLeft] = useState<string>('')

  // Detail Percakapan Aktif
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [selectedName, setSelectedName] = useState<string>('')

  // State untuk form pesan chat
  const [composerMessage, setComposerMessage] = useState<string>('')
  const [sendingMessage, setSendingMessage] = useState<boolean>(false)

  // Efek menangkap draf pesan dari halaman lain
  useEffect(() => {
    if (search.phone) {
      setSelectedPhone(search.phone)
      setComposerMessage(search.text || '')
      setActiveTab('chats')
      // Bersihkan search param agar tidak mengulang jika direfresh
      navigate({ to: '/automation/whatsapp-center', replace: true })
    }
  }, [search.phone, search.text, navigate])

  // Polling Status & Mengambil data Logs & Customers
  const { data: waStatus } = useQuery({
    queryKey: ['waStatus'],
    queryFn: async () => {
      const res = await fetch('/api/wa_operations.php?action=get_device_status')
      if (!res.ok) throw new Error('Network response was not ok')
      return res.json()
    },
    refetchInterval: 8000,
  })

  const { data: customersResponse } = useQuery({
    queryKey: ['waCustomers'],
    queryFn: async () => {
      const res = await fetch('/api/wa_customers.php')
      if (!res.ok) throw new Error('Gagal memuat daftar pelanggan')
      return res.json()
    },
  })
  const customers = customersResponse?.data || []

  const { data: logResponse, refetch: refetchLogs } = useQuery<ApiResponse>({
    queryKey: ['waLogsGlobal'],
    queryFn: async () => {
      const res = await fetch(
        `/api/wa_history.php?action=get_logs&status=all&limit=300`
      )
      if (!res.ok) throw new Error('Gagal memuat log riwayat WhatsApp')
      return res.json()
    },
    refetchInterval: 4000, // Polling logs lebih cepat agar chat masuk tampil instant!
  })
  const allLogs = useMemo(() => logResponse?.data || [], [logResponse?.data])
  const stats = logResponse?.stats || {
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
  }

  // Auto-scroll ke gelembung chat terbawah saat percakapan berganti atau pesan bertambah
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedPhone, allLogs])

  // ── MUTATION: KIRIM ULANG PESAN GAGAL ──────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/wa_history.php?action=retry_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Pesan berhasil dijadwalkan ulang untuk dikirim!')
        queryClient.invalidateQueries({ queryKey: ['waLogsGlobal'] })
      } else {
        toast.error(data.message || 'Gagal mengirim ulang pesan')
      }
    },
  })

  // ── MUTATION: HAPUS LOG PESAN ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/wa_history.php?action=delete_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Log pesan berhasil dihapus')
        queryClient.invalidateQueries({ queryKey: ['waLogsGlobal'] })
      }
    },
  })

  // ── MUTATION: BERSIHKAN SEMUA LOG ──────────────────────────────────────
  const clearLogsMutation = useMutation({
    mutationFn: async (target: 'failed' | 'sent' | 'all') => {
      const res = await fetch('/api/wa_history.php?action=clear_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'Log berhasil dibersihkan!')
        queryClient.invalidateQueries({ queryKey: ['waLogsGlobal'] })
      }
    },
  })

  // ── HANDLER: KIRIM PESAN DARI CHAT WINDOW ──────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedPhone || !composerMessage.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch('/api/wa_history.php?action=send_quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedPhone,
          message: composerMessage,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Pesan sukses dikirim ke antrean gateway!')
        setComposerMessage('')
        queryClient.invalidateQueries({ queryKey: ['waLogsGlobal'] })
      } else {
        toast.error(data.message || 'Gagal mengirim pesan')
      }
    } catch (err) {
      toast.error('Gagal terhubung ke server API')
    } finally {
      setSendingMessage(false)
    }
  }

  // Pengelompokan Log berdasarkan nomor HP unik untuk daftar Percakapan Aktif
  const getUniqueConversations = () => {
    const uniquePhones = new Set<string>()
    const conversations: {
      phone: string
      lastMessage: string
      lastTime: string
      status: string
      name: string
    }[] = []

    // Urutkan logs dari yang terbaru
    const sortedLogs = [...allLogs].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    for (const log of sortedLogs) {
      if (!uniquePhones.has(log.phone)) {
        uniquePhones.add(log.phone)
        const matchingCustomer = customers.find(
          (c: any) =>
            c.phone === log.phone ||
            c.phone.replace(/[^0-9]/g, '') === log.phone.replace(/[^0-9]/g, '')
        )

        conversations.push({
          phone: log.phone,
          lastMessage: log.message,
          lastTime: log.created_at,
          status: log.status,
          name: matchingCustomer ? matchingCustomer.name : log.phone,
        })
      }
    }
    return conversations
  }

  const uniqueChats = getUniqueConversations()

  // Filter list kiri berdasarkan pencarian
  const filteredChats = uniqueChats.filter(
    (chat) =>
      chat.name.toLowerCase().includes(searchLeft.toLowerCase()) ||
      chat.phone.includes(searchLeft)
  )

  const filteredCustomers = customers.filter(
    (cust: any) =>
      cust.name.toLowerCase().includes(searchLeft.toLowerCase()) ||
      cust.phone.includes(searchLeft)
  )

  // Ambil log percakapan khusus untuk nomor telepon yang sedang aktif dipilih
  const activeConversationLogs = allLogs
    .filter(
      (log) =>
        log.phone.replace(/[^0-9]/g, '') ===
        selectedPhone.replace(/[^0-9]/g, '')
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  // Format Helper Waktu Indonesia Ringkas
  const formatShortTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isConnected = waStatus?.connected === true

  return (
    <>
      {/* ── NAVBAR HEADER BARU YANG DIREPARASI BERSIH & MEWAH ────────────────── */}
      <Header
        fixed
        className='z-40 border-b border-slate-100 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-900/60 dark:bg-zinc-950/80'
      >
        <div className='flex w-full items-center justify-between gap-3'>
          {/* Sisi Kiri: Brand & Menu */}
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='icon' className='shrink-0 md:hidden'>
              <Menu className='h-5 w-5' />
            </Button>

            <div className='flex items-center gap-2.5'>
              <div className='rounded-xl bg-emerald-500/10 p-2 text-emerald-500 shadow-2xs'>
                <MessageSquare className='h-5 w-5' />
              </div>
              <div>
                <h1 className='flex items-center gap-2 text-sm font-black tracking-tight text-slate-800 dark:text-zinc-100'>
                  WhatsApp Chat Center
                </h1>
                {/* Live Info Status */}
                <div className='mt-0.5 flex items-center gap-1.5'>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`}
                  />
                  <span className='text-[10px] font-bold tracking-wider text-muted-foreground uppercase'>
                    {isConnected ? 'Gateway Connected' : 'Gateway Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Action & Controls */}
          <div className='flex shrink-0 items-center gap-2'>
            <div className='mr-2 hidden items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-black tracking-wider text-muted-foreground uppercase lg:flex dark:border-zinc-800/40 dark:bg-zinc-900/40'>
              <span>
                Antrean:{' '}
                <b className='text-slate-800 dark:text-zinc-200'>
                  {stats.pending}
                </b>
              </span>
              <span className='h-3 w-px bg-slate-200 dark:bg-zinc-800' />
              <span>
                Sukses:{' '}
                <b className='text-emerald-600 dark:text-emerald-400'>
                  {stats.sent}
                </b>
              </span>
              <span className='h-3 w-px bg-slate-200 dark:bg-zinc-800' />
              <span>
                Gagal:{' '}
                <b className='text-rose-600 dark:text-rose-400'>
                  {stats.failed}
                </b>
              </span>
            </div>

            <RouterSelector />
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </div>
      </Header>

      <Main className='m-0 overflow-hidden p-0' fluid>
        <div className='flex h-[calc(100vh-65px)] overflow-hidden bg-slate-50/50 dark:bg-zinc-950/30'>
          {/* ── 1. SPLIT VIEW: SISI KIRI (INBOX & CUSTOMER DIRECTORY) ────────── */}
          <div className='z-10 flex w-full shrink-0 flex-col border-r border-slate-100 bg-white md:w-[350px] lg:w-[400px] dark:border-zinc-900/80 dark:bg-zinc-950'>
            {/* Header Sidebar Kiri: Tabs Selektor */}
            <div className='space-y-3.5 border-b border-slate-100 p-4 dark:border-zinc-900/50'>
              <div className='border-slate-150/40 grid grid-cols-2 rounded-xl border bg-slate-50 p-1 dark:border-zinc-800/20 dark:bg-zinc-900/60'>
                <button
                  onClick={() => {
                    setActiveTab('chats')
                    setSearchLeft('')
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black tracking-wider uppercase transition-all duration-200 ${
                    activeTab === 'chats'
                      ? 'border-slate-100 bg-white text-primary shadow-xs dark:border-zinc-700/30 dark:bg-zinc-800'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MessageSquare className='h-3.5 w-3.5' /> Chat & Log
                </button>

                <button
                  onClick={() => {
                    setActiveTab('customers')
                    setSearchLeft('')
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black tracking-wider uppercase transition-all duration-200 ${
                    activeTab === 'customers'
                      ? 'border-slate-100 bg-white text-primary shadow-xs dark:border-zinc-700/30 dark:bg-zinc-800'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserPlus className='h-3.5 w-3.5' /> Pelanggan
                </button>
              </div>

              {/* Input Pencarian Sidebar */}
              <div className='relative'>
                <Search className='absolute top-3 left-3 h-4 w-4 text-muted-foreground/70' />
                <Input
                  placeholder={
                    activeTab === 'chats'
                      ? 'Cari percakapan...'
                      : 'Cari nama atau nomor pelanggan...'
                  }
                  value={searchLeft}
                  onChange={(e) => setSearchLeft(e.target.value)}
                  className='dark:border-zinc-850 h-9.5 rounded-xl border-slate-200 bg-slate-50/30 pl-9 text-xs font-semibold dark:bg-zinc-900/30'
                />
              </div>
            </div>

            {/* List Sidebar Kiri Scrollable */}
            <div className='grow divide-y divide-slate-50 overflow-y-auto dark:divide-zinc-900/40'>
              {/* TAB 1: LOG PERCAKAPAN */}
              {activeTab === 'chats' &&
                (filteredChats.length === 0 ? (
                  <div className='px-4 py-16 text-center text-xs font-semibold text-muted-foreground'>
                    <AlertCircle className='mx-auto mb-2 h-6 w-6 text-slate-300' />
                    Belum ada log percakapan pengiriman.
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const isSelected = selectedPhone === chat.phone
                    const avatarLetter = chat.name.charAt(0).toUpperCase()
                    const isRec = chat.status === 'received'

                    return (
                      <div
                        key={chat.phone}
                        onClick={() => {
                          setSelectedPhone(chat.phone)
                          setSelectedName(chat.name)
                        }}
                        className={`flex cursor-pointer items-center gap-3.5 border-l-3 p-4 transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-slate-50/80 dark:bg-zinc-900/40'
                            : 'border-transparent hover:bg-slate-50/40 dark:hover:bg-zinc-900/10'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-tr text-xs font-black text-white ${
                            isRec
                              ? 'from-sky-400 to-blue-600 shadow-2xs'
                              : chat.status === 'sent'
                                ? 'from-emerald-400 to-emerald-600'
                                : chat.status === 'failed'
                                  ? 'from-rose-400 to-rose-600'
                                  : 'from-amber-400 to-amber-600'
                          } shadow-xs`}
                        >
                          {avatarLetter}
                        </div>

                        {/* Detail Info */}
                        <div className='min-w-0 grow'>
                          <div className='flex items-center justify-between'>
                            <h4 className='max-w-[70%] truncate text-xs font-black text-slate-800 dark:text-zinc-100'>
                              {chat.name}
                            </h4>
                            <span className='text-[9px] font-bold text-muted-foreground'>
                              {formatShortTime(chat.lastTime)}
                            </span>
                          </div>

                          <p className='mt-0.5 truncate text-[10px] font-semibold text-muted-foreground'>
                            {chat.lastMessage}
                          </p>

                          {/* Status Badge */}
                          <div className='mt-1.5 flex items-center gap-1.5'>
                            {isRec && (
                              <span className='flex items-center gap-0.5 text-[9px] font-black text-blue-500 uppercase'>
                                <MessageSquare className='h-3 w-3 text-blue-500' />{' '}
                                Masuk
                              </span>
                            )}
                            {chat.status === 'sent' && (
                              <span className='flex items-center gap-0.5 text-[9px] font-black text-emerald-500 uppercase'>
                                <CheckCheck className='h-3 w-3' /> Terkirim
                              </span>
                            )}
                            {chat.status === 'pending' && (
                              <span className='flex animate-pulse items-center gap-0.5 text-[9px] font-black text-amber-500 uppercase'>
                                <Clock className='h-3 w-3' /> Antrean
                              </span>
                            )}
                            {chat.status === 'failed' && (
                              <span className='flex items-center gap-0.5 text-[9px] font-black text-rose-500 uppercase'>
                                <X className='h-3 w-3' /> Gagal
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ))}

              {/* TAB 2: DAFTAR PELANGGAN DATABASE */}
              {activeTab === 'customers' &&
                (filteredCustomers.length === 0 ? (
                  <div className='px-4 py-16 text-center text-xs font-semibold text-muted-foreground'>
                    <AlertCircle className='mx-auto mb-2 h-6 w-6 text-slate-300' />
                    Pelanggan tidak ditemukan.
                  </div>
                ) : (
                  filteredCustomers.map((cust: any) => {
                    const isSelected = selectedPhone === cust.phone
                    const avatarLetter = cust.name.charAt(0).toUpperCase()

                    return (
                      <div
                        key={cust.name}
                        onClick={() => {
                          setSelectedPhone(cust.phone)
                          setSelectedName(cust.name)
                        }}
                        className={`flex cursor-pointer items-center gap-3.5 border-l-3 p-4 transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-slate-50/80 dark:bg-zinc-900/40'
                            : 'border-transparent hover:bg-slate-50/40 dark:hover:bg-zinc-900/10'
                        }`}
                      >
                        {/* Avatar Pelanggan */}
                        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-slate-400 to-slate-600 text-xs font-black text-white shadow-2xs'>
                          {avatarLetter}
                        </div>

                        {/* Detail Info */}
                        <div className='min-w-0 grow'>
                          <h4 className='truncate text-xs font-black text-slate-800 dark:text-zinc-100'>
                            {cust.name}
                          </h4>
                          <p className='mt-0.5 text-[10px] font-bold text-muted-foreground'>
                            📱 {cust.phone}
                          </p>
                          {cust.profile && (
                            <Badge
                              variant='secondary'
                              className='mt-1.5 bg-slate-100 text-[8px] font-black tracking-wider text-slate-600 uppercase dark:bg-zinc-900 dark:text-zinc-400'
                            >
                              {cust.profile}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                ))}
            </div>

            {/* Footer Kiri: Clear logs actions */}
            <div className='flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 p-3 dark:border-zinc-900/50 dark:bg-zinc-950/20'>
              <span className='text-[9px] font-black text-muted-foreground uppercase'>
                Pusat Antrean
              </span>
              <div className='flex gap-1.5'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7.5 rounded-lg px-2.5 text-[9px] font-black tracking-wider text-rose-500 uppercase hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20'
                  onClick={() => {
                    if (confirm('Yakin ingin membersihkan semua log gagal?')) {
                      clearLogsMutation.mutate('failed')
                    }
                  }}
                >
                  Clear Gagal
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7.5 rounded-lg px-2.5 text-[9px] font-black tracking-wider text-rose-500 uppercase hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20'
                  onClick={() => {
                    if (
                      confirm(
                        'Yakin ingin mengosongkan seluruh antrean & riwayat pesan di database?'
                      )
                    ) {
                      clearLogsMutation.mutate('all')
                    }
                  }}
                >
                  Kosongkan Semua
                </Button>
              </div>
            </div>
          </div>

          {/* ── 2. SPLIT VIEW: SISI KANAN (MAIN CHAT VIEWPORT & MESSENGER WINDOW) ── */}
          <div className='relative flex grow flex-col justify-between overflow-hidden bg-slate-50/30 dark:bg-zinc-900/10'>
            {selectedPhone ? (
              <>
                {/* Header Window Chat */}
                <div className='z-10 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6 shadow-xs dark:border-zinc-900/60 dark:bg-zinc-950'>
                  <div className='flex items-center gap-3.5'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 text-muted-foreground md:hidden'
                      onClick={() => setSelectedPhone('')}
                    >
                      <ArrowLeft className='h-4 w-4' />
                    </Button>

                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-tr from-emerald-500 to-teal-500 text-xs font-black text-white shadow-2xs'>
                      {selectedName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className='flex items-center gap-2 text-xs font-black text-slate-800 dark:text-zinc-100'>
                        {selectedName}
                      </h3>
                      <p className='mt-0.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground'>
                        <Smartphone className='h-3 w-3' /> {selectedPhone}
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={`px-2 py-0.5 text-[9px] font-black tracking-wider uppercase ${
                        isConnected
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isConnected ? 'Gateway Online' : 'Gateway Offline'}
                    </Badge>
                  </div>
                </div>

                {/* Viewport Thread Chat (WhatsApp Style Bubbles) */}
                <div className='grow space-y-4 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] p-6 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]'>
                  {activeConversationLogs.length === 0 ? (
                    <div className='flex h-full flex-col items-center justify-center py-20 text-center text-xs font-semibold text-muted-foreground'>
                      <Zap className='mb-2 h-8 w-8 animate-bounce text-primary' />
                      Belum ada riwayat pesan keluar untuk nomor ini.
                      <br />
                      Silakan ketik pesan pertama Anda di kotak obrolan di
                      bawah!
                    </div>
                  ) : (
                    activeConversationLogs.map((log) => {
                      const isReceived = log.status === 'received'
                      const isSent = log.status === 'sent'
                      const isFailed = log.status === 'failed'
                      const isPending = log.status === 'pending'

                      return (
                        <div
                          key={log.id}
                          className={`animate-fade-in flex w-full flex-col ${
                            isReceived ? 'items-start' : 'items-end'
                          }`}
                        >
                          <div
                            className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-left shadow-xs ${
                              isReceived
                                ? 'dark:text-zinc-150 rounded-tl-none border border-slate-100 bg-white text-slate-800 shadow-2xs dark:border-zinc-800/40 dark:bg-zinc-800/80'
                                : isFailed
                                  ? 'rounded-tr-none border border-rose-200/50 bg-rose-50 text-rose-800 dark:border-rose-950/50 dark:bg-rose-950/20 dark:text-rose-400'
                                  : isPending
                                    ? 'rounded-tr-none border border-slate-200 bg-slate-100 text-slate-800 shadow-2xs dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-zinc-200'
                                    : 'rounded-tr-none bg-emerald-600 text-white shadow-2xs dark:bg-emerald-700 dark:text-zinc-100'
                            }`}
                          >
                            {/* Message text with line breaks */}
                            <p className='text-xs leading-relaxed font-semibold whitespace-pre-wrap'>
                              {log.message}
                            </p>

                            {/* Metadata & Status indicators */}
                            <div className='mt-1.5 flex items-center justify-end gap-1.5 text-[9px] font-bold opacity-80'>
                              <span>{formatShortTime(log.created_at)}</span>

                              {!isReceived && isSent && (
                                <CheckCheck className='h-3.5 w-3.5 text-white/95' />
                              )}
                              {!isReceived && isPending && (
                                <Clock className='h-3 w-3' />
                              )}
                              {!isReceived && isFailed && (
                                <AlertTriangle className='h-3.5 w-3.5 text-rose-500' />
                              )}
                            </div>

                            {/* Failed retry actions inside chat bubbles */}
                            {isFailed && (
                              <div className='mt-2.5 flex items-center justify-between gap-4 border-t border-rose-200/40 pt-2 dark:border-rose-950/40'>
                                <span className='max-w-[200px] truncate text-[9px] font-black text-rose-600 dark:text-rose-400'>
                                  ❌ Error:{' '}
                                  {log.error_message || 'Gagal terkirim'}
                                </span>
                                <div className='flex shrink-0 items-center gap-1'>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='h-6 gap-1 rounded-md border-rose-200 px-2 text-[8px] font-black tracking-wider text-rose-700 uppercase hover:bg-rose-100 dark:border-rose-950 dark:hover:bg-rose-900/30'
                                    onClick={() => retryMutation.mutate(log.id)}
                                    disabled={retryMutation.isPending}
                                  >
                                    <RefreshCw
                                      className={`h-2.5 w-2.5 ${retryMutation.isPending && 'animate-spin'}`}
                                    />{' '}
                                    Retry
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    className='h-6 w-6 rounded-md p-0 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                                    onClick={() =>
                                      deleteMutation.mutate(log.id)
                                    }
                                  >
                                    <Trash2 className='h-3 w-3' />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Composer Area ( WhatsApp Chat Style Input Bar ) */}
                <div className='z-10 border-t border-slate-100 bg-white p-4 dark:border-zinc-900/60 dark:bg-zinc-950'>
                  <form
                    onSubmit={handleSendMessage}
                    className='mx-auto flex max-w-5xl items-end gap-3.5'
                  >
                    <Select
                      onValueChange={(val) => {
                        const selected = MESSAGE_TEMPLATES.find(
                          (t) => t.id === val
                        )
                        if (selected) {
                          const replacedText = selected.text.replace(
                            /\[Nama Pelanggan\]/g,
                            selectedName
                          )
                          setComposerMessage(replacedText)
                          toast.success('Template pesan berhasil dimuat!')
                        }
                      }}
                    >
                      <SelectTrigger className='h-10 w-44 shrink-0 border-slate-200 bg-slate-50 text-[10px] font-black tracking-wider uppercase shadow-2xs dark:border-zinc-800 dark:bg-zinc-900'>
                        <SelectValue placeholder='📋 PILIH TEMPLATE' />
                      </SelectTrigger>
                      <SelectContent className='text-xs font-semibold'>
                        {MESSAGE_TEMPLATES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className='relative grow'>
                      <Textarea
                        placeholder={`Ketik pesan cepat untuk ${selectedName} di sini...`}
                        value={composerMessage}
                        onChange={(e) => setComposerMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        className='max-h-[120px] min-h-[40px] resize-none rounded-xl border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold focus-visible:ring-1 dark:border-zinc-800 dark:bg-zinc-900/50'
                      />
                    </div>

                    <Button
                      type='submit'
                      disabled={sendingMessage || !composerMessage.trim()}
                      className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary p-0 shadow-xs transition-all hover:scale-105'
                    >
                      {sendingMessage ? (
                        <RefreshCw className='h-4 w-4 animate-spin' />
                      ) : (
                        <Send className='ml-0.5 h-4 w-4 text-white' />
                      )}
                    </Button>
                  </form>
                  <p className='mt-2.5 text-center text-[9px] font-black tracking-wider text-muted-foreground uppercase italic'>
                    Tekan Enter untuk mengirim langsung • Pesan akan dikirim
                    melalui antrean Gateway Baileys Lokal
                  </p>
                </div>
              </>
            ) : (
              <div className='flex h-full flex-col items-center justify-center bg-linear-to-b from-transparent to-slate-50/30 px-6 py-20 text-center dark:to-zinc-950/10'>
                <div className='relative mb-6 animate-pulse rounded-full bg-linear-to-br from-emerald-500/10 to-teal-500/10 p-6 text-emerald-500 shadow-2xs'>
                  <MessageSquare className='h-12 w-12' />
                  <span className='absolute top-2 right-2 flex h-3 w-3'>
                    <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75'></span>
                    <span className='relative inline-flex h-3 w-3 rounded-full bg-emerald-500'></span>
                  </span>
                </div>

                <h3 className='text-lg font-black tracking-tight text-slate-800 dark:text-zinc-100'>
                  Selamat Datang di WhatsApp Hub WiFiKu
                </h3>
                <p className='mt-2 max-w-sm text-xs leading-relaxed font-semibold text-muted-foreground'>
                  Silakan cari pelanggan billing di database atau pilih riwayat
                  percakapan di sebelah kiri untuk melihat pesan, melacak log,
                  dan mengirim pesan WhatsApp secara interaktif.
                </p>

                <div className='mt-8 flex w-full max-w-sm items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xs dark:border-zinc-900/60 dark:bg-zinc-950'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={`rounded-xl p-2 text-white ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    >
                      {isConnected ? (
                        <Wifi className='h-4 w-4' />
                      ) : (
                        <WifiOff className='h-4 w-4' />
                      )}
                    </div>
                    <div>
                      <p className='text-[9px] font-black tracking-wider text-muted-foreground uppercase'>
                        Status Gateway
                      </p>
                      <p className='mt-0.5 text-xs font-black text-slate-800 dark:text-zinc-200'>
                        {isConnected
                          ? 'Connected & Active'
                          : 'Offline / Disconnected'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={isConnected ? 'bg-emerald-500' : 'bg-rose-500'}
                  >
                    {isConnected ? 'READY' : 'OFFLINE'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </Main>
    </>
  )
}
