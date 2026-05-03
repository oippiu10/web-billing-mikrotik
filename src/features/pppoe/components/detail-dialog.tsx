import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Shield,
  User,
  Network,
  Clock,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wifi,
  Zap,
  MonitorSmartphone,
  Fingerprint,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { PrivacyText } from '@/components/privacy'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  data: any
  type?: 'profile' | 'secret' | 'active' | 'generic'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number) => {
  if (isNaN(bytes) || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatBps = (bps: number) => {
  if (isNaN(bps) || bps === 0) return '0 bps'
  const k = 1000
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps']
  const i = Math.floor(Math.log(bps) / Math.log(k))
  return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const detectType = (data: any): 'profile' | 'secret' | 'active' | 'generic' => {
  if (!data) return 'generic'
  if ('uptime' in data && 'caller-id' in data) return 'active'
  if ('rate-limit' in data || ('local-address' in data && !('profile' in data))) return 'profile'
  if ('password' in data || ('profile' in data && 'service' in data)) return 'secret'
  return 'generic'
}

// ─── Live Traffic Chart ─────────────────────────────────────────────────────
// Polling realtime dari API ppp_active, menghitung delta bytes ÷ interval = throughput
function LiveTrafficChart({
  userName,
  initialBytesIn,
  initialBytesOut,
}: {
  userName: string
  initialBytesIn: number
  initialBytesOut: number
}) {
  const { activeRouter } = useRouterStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const HISTORY_LEN = 30
  const POLL_INTERVAL = 1000 // ms — realtime 1 detik

  const [inBpsHistory, setInBpsHistory] = useState<number[]>(Array(HISTORY_LEN).fill(0))
  const [outBpsHistory, setOutBpsHistory] = useState<number[]>(Array(HISTORY_LEN).fill(0))
  const [lastInBps, setLastInBps] = useState(0)
  const [lastOutBps, setLastOutBps] = useState(0)
  const [totalIn, setTotalIn] = useState(initialBytesIn)
  const [totalOut, setTotalOut] = useState(initialBytesOut)
  const [isConnected, setIsConnected] = useState(true)

  const prevBytesIn = useRef(initialBytesIn)
  const prevBytesOut = useRef(initialBytesOut)
  const prevTime = useRef(Date.now())

  const pollTraffic = useCallback(async () => {
    if (!activeRouter?.id) return
    try {
      // Baca dari cache interface daemon (update setiap ~1 detik, tanpa login ulang)
      const res = await api.get('/mikrotik_live.php', {
        params: { router_id: activeRouter.id, cmd: 'interface' }
      })

      const interfaces: any[] = res.data.data || []

      // Cari interface PPPoE untuk user ini
      const possibleNames = [
        `<pppoe-${userName}>`,
        `pppoe-${userName}`,
        userName,
      ]

      const iface = interfaces.find(i => possibleNames.includes(i.name?.trim()))

      // Debug: log interface names jika tidak ditemukan
      if (!iface && import.meta.env.DEV) {
        const pppoeIfaces = interfaces.filter(i => String(i.name || '').toLowerCase().includes('pppoe'))
        console.debug(`[LiveTraffic] Looking for: ${JSON.stringify(possibleNames)}`)
        console.debug(`[LiveTraffic] PPPoE ifaces found:`, pppoeIfaces.map(i => i.name))
        console.debug(`[LiveTraffic] Total interfaces:`, interfaces.length, '| from_cache:', res.data.from_cache, '| via_daemon:', res.data.via_daemon)
      }

      if (!iface) {
        // Coba fallback: baca ppp_active untuk bytes total
        const res2 = await api.get('/mikrotik_live.php', {
          params: { router_id: activeRouter.id, cmd: 'ppp_active' }
        })
        const sessions: any[] = res2.data.data || []
        const session = sessions.find(s => s.name === userName)
        if (!session) {
          setIsConnected(false)
          return
        }
        // Ppp_active tidak punya rate, hitung delta manual
        setIsConnected(true)
        const nowBytesIn  = parseInt(session['bytes-in']  || '0')
        const nowBytesOut = parseInt(session['bytes-out'] || '0')
        const now = Date.now()
        const elapsedSec = (now - prevTime.current) / 1000
        const deltaIn  = Math.max(0, nowBytesIn  - prevBytesIn.current)
        const deltaOut = Math.max(0, nowBytesOut - prevBytesOut.current)
        const bpsIn  = elapsedSec > 0 ? Math.floor((deltaIn  * 8) / elapsedSec) : 0
        const bpsOut = elapsedSec > 0 ? Math.floor((deltaOut * 8) / elapsedSec) : 0
        prevBytesIn.current  = nowBytesIn
        prevBytesOut.current = nowBytesOut
        prevTime.current     = now
        setTotalIn(nowBytesIn)
        setTotalOut(nowBytesOut)
        setLastInBps(bpsIn)
        setLastOutBps(bpsOut)
        setInBpsHistory(prev  => [...prev.slice(1), bpsIn])
        setOutBpsHistory(prev => [...prev.slice(1), bpsOut])
        return
      }

      setIsConnected(true)

      // Gunakan rx/tx-bits-per-second yang sudah dihitung daemon
      const bpsIn  = parseFloat(iface['rx-bits-per-second'] || '0')  // upload client
      const bpsOut = parseFloat(iface['tx-bits-per-second'] || '0')  // download client
      const nowBytesIn  = parseInt(iface['rx-byte'] || '0')
      const nowBytesOut = parseInt(iface['tx-byte'] || '0')

      setTotalIn(nowBytesIn)
      setTotalOut(nowBytesOut)
      setLastInBps(bpsIn)
      setLastOutBps(bpsOut)
      setInBpsHistory(prev  => [...prev.slice(1), bpsIn])
      setOutBpsHistory(prev => [...prev.slice(1), bpsOut])
    } catch {
      setIsConnected(false)
    }
  }, [activeRouter?.id, userName])

  useEffect(() => {
    pollTraffic() // poll langsung saat dialog terbuka
    const timer = setInterval(pollTraffic, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [pollTraffic])

  // Draw canvas chart
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const drawLine = (data: number[], color: string, fillColor: string) => {
      const max = Math.max(...data, 1)
      const stepX = W / (data.length - 1)
      ctx.beginPath()
      data.forEach((val, i) => {
        const x = i * stepX
        const y = H - (val / max) * (H - 4) - 2
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()
    }

    drawLine(inBpsHistory, 'rgba(34,197,94,0.9)', 'rgba(34,197,94,0.12)')
    drawLine(outBpsHistory, 'rgba(59,130,246,0.9)', 'rgba(59,130,246,0.12)')
  }, [inBpsHistory, outBpsHistory])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Live Traffic Monitor</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 h-4 ${
            isConnected
              ? 'bg-green-500/10 text-green-600 border-green-200/50 animate-pulse'
              : 'bg-red-500/10 text-red-600 border-red-200/50'
          }`}
        >
          {isConnected ? 'LIVE' : 'DISCONNECTED'}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto">
          realtime
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={440}
        height={80}
        className="w-full rounded-lg border border-border bg-muted/30"
      />

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-500 rounded" /> Download (Rx)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" /> Upload (Tx)
        </span>
      </div>

      {/* Realtime bps */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-200/30 px-3 py-2">
          <ArrowDownToLine className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Download Speed</div>
            <div className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
              {formatBps(lastInBps)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-200/30 px-3 py-2">
          <ArrowUpFromLine className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Upload Speed</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
              {formatBps(lastOutBps)}
            </div>
          </div>
        </div>
      </div>

      {/* Total bytes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 border px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Rx (Download)</div>
          <div className="text-sm font-semibold font-mono text-green-600 dark:text-green-400">
            {formatBytes(totalIn)}
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 border px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Tx (Upload)</div>
          <div className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400">
            {formatBytes(totalOut)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Live Uptime Ticker ─────────────────────────────────────────────────────
// Parse string uptime MikroTik (misal "4d13h49m14s") → total detik
function parseUptimeToSeconds(uptime: string): number {
  let total = 0
  const wMatch = uptime.match(/(\d+)w/)
  const dMatch = uptime.match(/(\d+)d/)
  const hMatch = uptime.match(/(\d+)h/)
  const mMatch = uptime.match(/(\d+)m/)
  const sMatch = uptime.match(/(\d+)s/)
  if (wMatch) total += parseInt(wMatch[1]) * 7 * 24 * 3600
  if (dMatch) total += parseInt(dMatch[1]) * 24 * 3600
  if (hMatch) total += parseInt(hMatch[1]) * 3600
  if (mMatch) total += parseInt(mMatch[1]) * 60
  if (sMatch) total += parseInt(sMatch[1])
  return total
}

// Format total detik → string seperti MikroTik: "4d13h49m14s"
function formatSecondsToUptime(totalSec: number): string {
  const w = Math.floor(totalSec / (7 * 24 * 3600))
  totalSec %= 7 * 24 * 3600
  const d = Math.floor(totalSec / (24 * 3600))
  totalSec %= 24 * 3600
  const h = Math.floor(totalSec / 3600)
  totalSec %= 3600
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  let result = ''
  if (w > 0) result += `${w}w`
  if (d > 0) result += `${d}d`
  if (h > 0) result += `${h}h`
  if (m > 0) result += `${m}m`
  result += `${s}s`
  return result || '0s'
}

function LiveUptime({ initialUptime }: { initialUptime: string }) {
  const [seconds, setSeconds] = useState(() => parseUptimeToSeconds(initialUptime))

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
        <span className="w-3.5 h-3.5 shrink-0"><Clock className="w-3.5 h-3.5" /></span>
        <span className="text-[10px] uppercase tracking-wider font-medium">Uptime</span>
        <span className="ml-auto text-[9px] text-green-500 animate-pulse">▶ live</span>
      </div>
      <div className="text-sm font-semibold font-mono">
        {formatSecondsToUptime(seconds)}
      </div>
    </div>
  )
}
function ActiveDetailContent({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-200/30">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 border border-green-300/30">
          <Wifi className="w-6 h-6 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate"><PrivacyText>{data.name}</PrivacyText></div>
          <div className="text-xs text-muted-foreground">{data.service}</div>
        </div>
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-300/30 hover:bg-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
          Online
        </Badge>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={<Network className="w-4 h-4" />} label="IP Address" value={data.address || '-'} mono privateValue />
        <LiveUptime initialUptime={data.uptime || '0s'} />
        <InfoCard icon={<MonitorSmartphone className="w-4 h-4" />} label="Caller ID (MAC)" value={data['caller-id'] || '-'} mono privateValue />
        <InfoCard icon={<Fingerprint className="w-4 h-4" />} label="Session ID" value={data['.id'] || '-'} mono small />
      </div>

      <Separator />

      {/* Real live traffic chart */}
      <LiveTrafficChart
        userName={data.name}
        initialBytesIn={parseInt(data['bytes-in'] || '0')}
        initialBytesOut={parseInt(data['bytes-out'] || '0')}
      />
    </div>
  )
}

// ─── Secret Detail ──────────────────────────────────────────────────────────
function SecretDetailContent({ data }: { data: any }) {
  const isDisabled = data.disabled === 'true'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border border-blue-200/30">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 border border-blue-300/30">
          <User className="w-6 h-6 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate"><PrivacyText>{data.name}</PrivacyText></div>
          <div className="text-xs text-muted-foreground">PPPoE Secret Account</div>
        </div>
        {isDisabled ? (
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Disabled</Badge>
        ) : (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-300/30 hover:bg-blue-500/20">Active</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={<Shield className="w-4 h-4" />} label="Profile" value={data.profile || '-'} />
        <InfoCard icon={<Zap className="w-4 h-4" />} label="Service" value={data.service || '-'} />
        <InfoCard icon={<MonitorSmartphone className="w-4 h-4" />} label="Last Caller ID" value={data['last-caller-id'] || '-'} mono privateValue />
        <InfoCard icon={<Clock className="w-4 h-4" />} label="Last Logged Out" value={data['last-logged-out'] || '-'} />
      </div>

      <Separator />
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Teknis</div>
        {Object.entries(data).map(([key, value]) => {
          if (['.id', 'name', 'profile', 'service', 'last-caller-id', 'last-logged-out', 'disabled'].includes(key)) return null
          return (
            <div key={key} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground capitalize">{key.replace(/-/g, ' ')}</span>
              <span className="text-sm font-mono font-medium"><PrivacyText>{String(value) || '-'}</PrivacyText></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Profile Detail ─────────────────────────────────────────────────────────
function ProfileDetailContent({ data }: { data: any }) {
  const isDefault = data.default === 'true'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-200/30">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/20 border border-violet-300/30">
          <Shield className="w-6 h-6 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate"><PrivacyText>{data.name}</PrivacyText></div>
          <div className="text-xs text-muted-foreground">PPPoE Profile / Paket</div>
        </div>
        {isDefault && (
          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-300/30">Default</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoCard icon={<Network className="w-4 h-4" />} label="Local Address" value={data['local-address'] || '-'} mono privateValue />
        <InfoCard icon={<Network className="w-4 h-4" />} label="Remote Address" value={data['remote-address'] || '-'} mono privateValue />
      </div>

      {data['rate-limit'] && (
        <div className="rounded-xl border bg-gradient-to-r from-orange-500/10 to-amber-500/5 border-orange-200/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">Rate Limit (Rx / Tx)</span>
          </div>
          <div className="font-mono text-base font-bold text-orange-600 dark:text-orange-400">
            <PrivacyText>{data['rate-limit']}</PrivacyText>
          </div>
        </div>
      )}

      <Separator />
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semua Parameter</div>
        {Object.entries(data).map(([key, value]) => {
          if (['.id', 'name', 'local-address', 'remote-address', 'rate-limit', 'default'].includes(key)) return null
          return (
            <div key={key} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground capitalize">{key.replace(/-/g, ' ')}</span>
              <span className="text-sm font-mono font-medium"><PrivacyText>{String(value) || '-'}</PrivacyText></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Generic fallback ────────────────────────────────────────────────────────
function GenericDetailContent({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => {
        if (key === '.id') return null
        return (
          <div key={key} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground capitalize">{key.replace(/-/g, ' ')}</span>
            <span className="text-sm font-mono font-medium break-all text-right max-w-[60%]"><PrivacyText>{String(value) || '-'}</PrivacyText></span>
          </div>
        )
      })}
    </div>
  )
}

// ─── InfoCard ────────────────────────────────────────────────────────────────
function InfoCard({
  icon,
  label,
  value,
  mono = false,
  small = false,
  privateValue = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
  small?: boolean
  privateValue?: boolean
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={`font-semibold break-all leading-tight ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'}`}>
        {privateValue ? <PrivacyText>{value}</PrivacyText> : value}
      </div>
    </div>
  )
}

// ─── Main Dialog Export ──────────────────────────────────────────────────────
export function DetailDialog({ open, onOpenChange, title, data, type }: Props) {
  if (!data) return null

  const detectedType = type || detectType(data)

  const getIcon = () => {
    if (detectedType === 'active') return <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
    if (detectedType === 'secret') return <User className="w-4 h-4 text-muted-foreground" />
    if (detectedType === 'profile') return <Shield className="w-4 h-4 text-muted-foreground" />
    return <Activity className="w-4 h-4 text-muted-foreground" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-border/50">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-muted/50 to-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {getIcon()}
              {title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[78vh]">
          <div className="p-6">
            {detectedType === 'active' && <ActiveDetailContent data={data} />}
            {detectedType === 'secret' && <SecretDetailContent data={data} />}
            {detectedType === 'profile' && <ProfileDetailContent data={data} />}
            {detectedType === 'generic' && <GenericDetailContent data={data} />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
