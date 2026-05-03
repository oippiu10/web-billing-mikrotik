import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Monitor } from 'lucide-react'
import { PrivacyText } from '@/components/privacy'

interface ActivePPPSession {
  name: string
  address: string
  uptime: string
  service: string
  'caller-id'?: string
}

interface ActivePPPProps {
  sessions?: ActivePPPSession[]
}

export function ActivePPP({ sessions = [] }: ActivePPPProps) {
  // Helper to parse Mikrotik uptime (e.g., 2w3h50m58s or 01:02:03) to seconds for sorting
  const parseUptime = (uptime: string) => {
    if (!uptime) return 0
    let totalSeconds = 0

    // Handle format like 2w3d04:05:06 or 04:05:06 (if exists)
    if (uptime.includes(':')) {
      const parts = uptime.split(/[wd]/)
      const timePart = parts[parts.length - 1]
      const timeMatch = timePart.match(/(\d+):(\d+):(\d+)/)
      if (timeMatch) {
        totalSeconds += parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3])
      }

      const daysMatch = uptime.match(/(\d+)d/)
      if (daysMatch) totalSeconds += parseInt(daysMatch[1]) * 86400
      const weeksMatch = uptime.match(/(\d+)w/)
      if (weeksMatch) totalSeconds += parseInt(weeksMatch[1]) * 604800
      
      return totalSeconds
    }

    // Handle format like 2w3h50m58s (Standard RouterOS)
    const regex = /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/
    const matches = uptime.match(regex)
    if (matches) {
      const w = parseInt(matches[1] || '0')
      const d = parseInt(matches[2] || '0')
      const h = parseInt(matches[3] || '0')
      const m = parseInt(matches[4] || '0')
      const s = parseInt(matches[5] || '0')
      totalSeconds = w * 7 * 24 * 3600 + d * 24 * 3600 + h * 3600 + m * 60 + s
    }
    return totalSeconds
  }

  // Sort sessions: Newest first (smallest uptime)
  const sortedSessions = [...sessions].sort((a, b) => parseUptime(a.uptime) - parseUptime(b.uptime))

  if (sortedSessions.length === 0) {
    return (
      <div className='flex h-[300px] flex-col items-center justify-center text-center space-y-3 bg-muted/5 rounded-xl border border-dashed'>
        <div className='rounded-full bg-muted/20 p-4'>
            <Monitor className='h-8 w-8 text-muted-foreground/50' />
        </div>
        <div>
            <p className='text-sm font-bold uppercase tracking-widest'>No active sessions</p>
            <p className='text-[10px] font-bold text-muted-foreground uppercase mt-1'>Waiting for users to connect...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-muted/50 bg-background/30 backdrop-blur-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 text-[10px] font-black uppercase tracking-widest h-10">No</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">User</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Address</TableHead>
            <TableHead className='text-right text-[10px] font-black uppercase tracking-widest h-10'>Uptime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSessions.map((session, index) => (
            <TableRow key={index} className="group border-muted/30 hover:bg-muted/10 transition-colors">
              <TableCell className="py-3 text-[10px] font-black text-muted-foreground/50">{index + 1}</TableCell>
              <TableCell className='py-3'>
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-tight"><PrivacyText>{session.name}</PrivacyText></span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Active Session</span>
                </div>
              </TableCell>
              <TableCell className="py-3">
                 <span className="text-[11px] font-mono font-bold bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground">
                    <PrivacyText>{session.address}</PrivacyText>
                 </span>
              </TableCell>
              <TableCell className="py-3 text-right">
                 <div className="flex items-center justify-end gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-primary/80">{session.uptime}</span>
                 </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
