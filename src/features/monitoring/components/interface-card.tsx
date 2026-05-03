import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { ArrowDown, ArrowUp, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InterfaceCardProps {
  name: string
  type: string
  status: string
  rxMbps: number
  txMbps: number
  history: { rx: number; tx: number }[]
  isTracked: boolean
  onTrackToggle: () => void
}

// Menggunakan memo untuk mencegah re-render jika data tidak berubah
export const InterfaceCard = memo(({
  name,
  type,
  status,
  rxMbps,
  txMbps,
  history,
  isTracked,
  onTrackToggle
}: InterfaceCardProps) => {
  const isRunning = status.includes('running')
  
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-md",
      isTracked && "ring-2 ring-primary border-primary/50",
      !isRunning && "opacity-60 grayscale-[0.5]"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isRunning ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            <h3 className="font-bold text-sm truncate" title={name}>{name}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
             <Badge variant="outline" className="text-[10px] font-normal px-1 py-0 h-4 uppercase opacity-70 hidden sm:inline-flex">
                {type}
             </Badge>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 onTrackToggle();
               }}
               className={cn(
                 "text-[10px] px-2 py-0.5 rounded-full border transition-colors font-semibold",
                 isTracked 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background text-muted-foreground hover:bg-muted"
               )}
             >
               {isTracked ? 'TRACKED' : 'TRACK'}
             </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="space-y-1">
            <div className="flex items-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
               <ArrowDown className="w-3 h-3 mr-1 text-blue-500" /> RX
            </div>
            <div className="text-lg font-black tracking-tight leading-none text-blue-600 dark:text-blue-400">
               {rxMbps.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">M</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
               <ArrowUp className="w-3 h-3 mr-1 text-orange-500" /> TX
            </div>
            <div className="text-lg font-black tracking-tight leading-none text-orange-600 dark:text-orange-400">
               {txMbps.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">M</span>
            </div>
          </div>
        </div>

        {/* Mini Sparklines - Sederhana tanpa gradien & animasi untuk performa */}
        <div className="h-10 w-full opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <Area 
                type="monotone" 
                dataKey="rx" 
                stroke="#2563eb" 
                strokeWidth={1.5} 
                fill="#2563eb"
                fillOpacity={0.1} 
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="tx" 
                stroke="#ea580c" 
                strokeWidth={1.5} 
                fill="#ea580c"
                fillOpacity={0.1} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 pt-2 border-t flex justify-between items-center text-[10px]">
           <span className="text-muted-foreground uppercase font-semibold">{isRunning ? 'Running' : 'Down'}</span>
           <Activity className={cn("w-3 h-3", isRunning ? "text-green-500" : "text-muted-foreground")} />
        </div>
      </CardContent>
    </Card>
  )
})

InterfaceCard.displayName = 'InterfaceCard'
