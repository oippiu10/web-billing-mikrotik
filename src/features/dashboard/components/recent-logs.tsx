import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, FilterX, Terminal, History, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MikrotikLog {
  '.id': string
  time: string
  topics: string
  message: string
}

interface SystemLog {
  action: string
  time: string
}

interface RecentLogsProps {
  mikrotikLogs?: MikrotikLog[]
  systemLogs?: SystemLog[]
}

export function RecentLogs({ mikrotikLogs = [], systemLogs = [] }: RecentLogsProps) {
  const [search, setSearch] = useState('')
  const [hidePPPoE, setHidePPPoE] = useState(false)

  const filteredLogs = mikrotikLogs.filter(log => {
    const msgMatch = log.message.toLowerCase().includes(search.toLowerCase())
    const topicMatch = log.topics.toLowerCase().includes(search.toLowerCase())
    const isPPPoE = log.message.toLowerCase().includes('pppoe connection established') || log.topics.toLowerCase().includes('pppoe')
    
    // Jika filter aktif, sembunyikan log PPPoE kecuali sedang dicari secara spesifik
    if (hidePPPoE && isPPPoE && !search) return false
    return msgMatch || topicMatch
  })

  const getTopicColor = (topic: string) => {
    const t = topic.toLowerCase().trim()
    if (t.includes('error') || t.includes('critical') || t.includes('failed')) return 'bg-red-500/10 text-red-500 border-red-500/20'
    if (t.includes('warning') || t.includes('alert')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    if (t.includes('pppoe') || t.includes('ppp') || t.includes('account')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    if (t.includes('system') || t.includes('info')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    if (t.includes('script')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    if (t.includes('hotspot')) return 'bg-pink-500/10 text-pink-500 border-pink-500/20'
    if (t.includes('dhcp')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
    return 'bg-primary/5 text-primary/60 border-primary/10'
  }

  const getMessageColor = (topics: string) => {
    const t = topics.toLowerCase()
    if (t.includes('error') || t.includes('critical') || t.includes('failed')) return 'text-red-500'
    if (t.includes('warning') || t.includes('alert')) return 'text-orange-500'
    return ''
  }

  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
      {/* Table 1: Mikrotik Logs */}
      <div className='lg:col-span-2 overflow-hidden rounded-xl border border-muted/50 bg-background/30 backdrop-blur-sm shadow-sm flex flex-col'>
        <div className='flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/20 border-b border-muted/30 shrink-0'>
          <div className='flex items-center gap-2'>
            <Terminal className='w-4 h-4 text-primary' />
            <h3 className='text-xs font-black uppercase tracking-widest'>MikroTik Device Logs</h3>
          </div>
          <div className='flex items-center gap-2'>
            <div className='relative'>
              <Search className='absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground' />
              <Input 
                placeholder='Search logs...' 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='h-7 w-[150px] pl-7 text-[10px] bg-background/50 focus-visible:ring-primary'
              />
            </div>
            <Button 
              variant={hidePPPoE ? 'default' : 'outline'} 
              size='sm' 
              onClick={() => setHidePPPoE(!hidePPPoE)}
              className='h-7 px-2 text-[10px] gap-1 font-bold uppercase'
            >
              <FilterX className='w-3 h-3' />
              {hidePPPoE ? 'Showing All' : 'Hide PPPoE'}
            </Button>
          </div>
        </div>
        <div className='flex-1 max-h-[600px] overflow-auto custom-scrollbar'>
          <div className='min-w-[600px]'>
            <Table>
              <TableHeader className='bg-muted/10 sticky top-0 z-10 bg-background/95 backdrop-blur-sm'>
                <TableRow className='hover:bg-transparent border-muted/20'>
                  <TableHead className='w-[60px] text-[9px] font-black uppercase h-9 px-3'>ID</TableHead>
                  <TableHead className='w-[140px] text-[9px] font-black uppercase h-9 px-3'>Time</TableHead>
                  <TableHead className='w-[180px] text-[9px] font-black uppercase h-9 px-3'>Topics</TableHead>
                  <TableHead className='min-w-[300px] text-[9px] font-black uppercase h-9 px-3'>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className='text-center py-12 text-[10px] font-bold text-muted-foreground uppercase tracking-widest'>
                      {search || hidePPPoE ? 'No logs match filters' : 'No recent logs found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log, i) => (
                    <TableRow key={i} className='border-muted/10 hover:bg-muted/5 transition-colors group'>
                      <TableCell className='py-2 px-3 text-[10px] font-mono text-muted-foreground/60 whitespace-nowrap'>
                        {log['.id']?.replace('*', '')}
                      </TableCell>
                      <TableCell className='py-2 px-3 text-[10px] font-mono text-muted-foreground whitespace-nowrap'>
                        {log.time}
                      </TableCell>
                      <TableCell className='py-2 px-3'>
                        <div className='flex flex-wrap items-center gap-1'>
                          {log.topics?.split(',').map((t, ti) => (
                            <span key={ti} className={cn('text-[9px] font-bold px-1.5 rounded-sm border whitespace-nowrap leading-none py-0.5', getTopicColor(t))}>
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className='py-2 px-3'>
                        <span className={cn('text-[11px] font-mono leading-relaxed break-words block min-w-0', getMessageColor(log.topics))}>
                          {log.message}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Table 2: System Application Logs */}
      <div className='overflow-hidden rounded-xl border border-muted/50 bg-background/30 backdrop-blur-sm shadow-sm'>
        <div className='flex items-center gap-2 p-3 bg-muted/20 border-b border-muted/30'>
          <History className='w-4 h-4 text-emerald-500' />
          <h3 className='text-xs font-black uppercase tracking-widest'>App Activity Logs</h3>
        </div>
        <div className='max-h-[600px] overflow-auto'>
          <Table>
            <TableHeader className='bg-muted/10 sticky top-0 z-10 bg-background/95 backdrop-blur-sm'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-16 text-[10px] font-black uppercase h-8'>Time</TableHead>
                <TableHead className='text-[10px] font-black uppercase h-8'>Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className='text-center py-8 text-[10px] font-bold text-muted-foreground uppercase'>
                    No activity found
                  </TableCell>
                </TableRow>
              ) : (
                systemLogs.map((log, i) => (
                  <TableRow key={i} className='border-muted/10 hover:bg-muted/5 transition-colors'>
                    <TableCell className='py-2 text-[10px] font-mono text-muted-foreground whitespace-nowrap'>
                      {log.time}
                    </TableCell>
                    <TableCell className='py-2'>
                      <div className='flex items-center gap-2'>
                         <div className='p-1 rounded-full bg-emerald-500/10'>
                            <Info className='w-2.5 h-2.5 text-emerald-500' />
                         </div>
                         <span className='text-[10px] font-bold leading-tight'>
                            {log.action}
                         </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
