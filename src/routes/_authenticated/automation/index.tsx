import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Bot, ShieldOff, ShieldCheck, MessageCircle, DatabaseBackup, BellRing, Play, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/_authenticated/automation/')({ component: AutomationCenter })

const jobs = [
  { title: 'Auto Isolir', icon: ShieldOff, color: 'text-red-500', desc: 'Disable PPP secret pelanggan yang menunggak sesuai periode dan grace period.', status: 'Prototype' },
  { title: 'Auto Open Isolir', icon: ShieldCheck, color: 'text-green-500', desc: 'Enable kembali PPP secret pelanggan setelah pembayaran tercatat lunas.', status: 'Planned' },
  { title: 'WhatsApp Reminder', icon: MessageCircle, color: 'text-emerald-500', desc: 'Reminder tagihan H-3, hari H, dan H+3 via WhatsApp gateway/manual.', status: 'Planned' },
  { title: 'Backup Scheduler', icon: DatabaseBackup, color: 'text-blue-500', desc: 'Backup database, export konfigurasi MikroTik, dan retention file otomatis.', status: 'Planned' },
  { title: 'Alert Rules', icon: BellRing, color: 'text-orange-500', desc: 'Alert router down, OLT alarm, pelanggan flapping, dan ODP penuh.', status: 'Planned' },
]

function AutomationCenter() {
  const { activeRouter } = useRouterStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [graceDays, setGraceDays] = useState(7)
  const [dryRun, setDryRun] = useState(true)
  const [lastResult, setLastResult] = useState<any>(null)

  const isolateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/automation_isolate.php', {
        router_id: activeRouter?.software_id || activeRouter?.id,
        month,
        year,
        grace_days: graceDays,
        dry_run: dryRun,
      })
      return res.data
    },
    onSuccess: (data) => {
      setLastResult(data)
      if (data.success) {
        toast.success(dryRun ? `Simulasi selesai: ${data.total_candidates || 0} kandidat` : `Auto isolir selesai: ${data.total_processed || 0} diproses`)
      } else toast.error(data.message || 'Gagal menjalankan auto isolir')
    },
    onError: () => toast.error('Gagal menghubungi server'),
  })

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='rounded-lg bg-primary/10 p-2'><Bot className='h-5 w-5 text-primary' /></div>
          <h1 className='text-lg font-bold'>Automation Center</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Automation Center</h2>
          <p className='text-muted-foreground'>Pusat otomatisasi billing dan monitoring. Beberapa fitur masih prototype/planned agar roadmap tidak hilang.</p>
        </div>

        <Card className='border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardHeader>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-red-700 dark:text-red-300'><ShieldOff className='h-5 w-5' /> Auto Isolir PPPoE</CardTitle>
                <CardDescription>Prototype: cari pelanggan belum bayar lalu disable PPP secret di MikroTik. Gunakan simulasi dulu sebelum eksekusi.</CardDescription>
              </div>
              <Badge variant='secondary'>Prototype</Badge>
            </div>
          </CardHeader>
          <CardContent className='grid gap-3 md:grid-cols-[160px_140px_140px_160px_auto] md:items-end'>
            <div>
              <label className='text-xs font-bold uppercase text-muted-foreground'>Bulan</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className='mt-1'><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className='text-xs font-bold uppercase text-muted-foreground'>Tahun</label>
              <Input className='mt-1' type='number' value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div>
              <label className='text-xs font-bold uppercase text-muted-foreground'>Grace Days</label>
              <Input className='mt-1' type='number' value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} />
            </div>
            <div>
              <label className='text-xs font-bold uppercase text-muted-foreground'>Mode</label>
              <Select value={dryRun ? 'dry' : 'execute'} onValueChange={(v) => setDryRun(v === 'dry')}>
                <SelectTrigger className='mt-1'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='dry'>Simulasi aman</SelectItem>
                  <SelectItem value='execute'>Eksekusi isolir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className='gap-2' disabled={!activeRouter || isolateMutation.isPending} onClick={() => {
              if (!dryRun) {
                const ok = window.confirm('PERINGATAN: Mode eksekusi akan men-disable PPP secret pelanggan belum bayar. Pastikan sudah melakukan simulasi. Lanjutkan?')
                if (!ok) return
              }
              isolateMutation.mutate()
            }}>
              <Play className='h-4 w-4' /> Jalankan
            </Button>
            {!dryRun && <p className='flex items-center gap-2 text-xs font-bold text-red-600 md:col-span-5'><AlertTriangle className='h-4 w-4' /> Mode eksekusi akan men-disable PPP secret pelanggan kandidat.</p>}
          </CardContent>
        </Card>

        {lastResult && (
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    {lastResult.success ? <CheckCircle2 className='h-5 w-5 text-green-500' /> : <XCircle className='h-5 w-5 text-red-500' />}
                    Hasil Auto Isolir
                  </CardTitle>
                  <CardDescription>
                    Mode: {lastResult.dry_run ? 'Simulasi' : 'Eksekusi'} • Kandidat: {lastResult.total_candidates || 0} • Diproses: {lastResult.total_processed || 0}
                  </CardDescription>
                </div>
                <Badge variant={lastResult.success ? 'default' : 'destructive'}>{lastResult.success ? 'Selesai' : 'Gagal'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!lastResult.success ? (
                <p className='text-sm text-red-600'>{lastResult.message || 'Terjadi kesalahan'}</p>
              ) : (lastResult.data || []).length === 0 ? (
                <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>Tidak ada kandidat untuk periode ini.</p>
              ) : (
                <div className='max-h-[420px] overflow-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Secret ID</TableHead>
                        <TableHead className='text-right'>Tagihan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(lastResult.data || []).map((row: any, idx: number) => (
                        <TableRow key={`${row.username}-${idx}`}>
                          <TableCell className='font-medium'>{row.username || '-'}</TableCell>
                          <TableCell><Badge variant='outline'>{row.status || '-'}</Badge></TableCell>
                          <TableCell className='text-muted-foreground'>{row.secret_id || '-'}</TableCell>
                          <TableCell className='text-right'>{Number(row.harga || 0).toLocaleString('id-ID')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {jobs.map((job) => {
            const Icon = job.icon
            return (
              <Card key={job.title}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='flex items-center gap-2 text-base'><Icon className={`h-5 w-5 ${job.color}`} /> {job.title}</CardTitle>
                    <Badge variant='outline'>{job.status}</Badge>
                  </div>
                  <CardDescription>{job.desc}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </Main>
    </>
  )
}
