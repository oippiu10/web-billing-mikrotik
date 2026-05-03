import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'

interface TrafficChartProps {
  data: { time: string; rx: number; tx: number }[]
  title?: string
  extraAction?: React.ReactNode
}

export function TrafficChart({ data, title = "Real-Time Traffic", extraAction }: TrafficChartProps) {
  // Calculate stats
  const latest = data[data.length - 1] || { rx: 0, tx: 0 }
  const rxValues = data.map(d => d.rx)
  const txValues = data.map(d => d.tx)
  
  const avgRx = rxValues.length ? rxValues.reduce((a, b) => a + b, 0) / rxValues.length : 0
  const avgTx = txValues.length ? txValues.reduce((a, b) => a + b, 0) / txValues.length : 0
  
  const maxRx = Math.max(...rxValues, 0)
  const maxTx = Math.max(...txValues, 0)

  return (
    <Card className="shadow-sm border-muted/50 overflow-hidden">
      <CardHeader className="pb-2 space-y-4">
        <div className="flex items-center justify-between">
           <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2 uppercase">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              {title}
           </CardTitle>
           <div className="flex gap-4 items-center">
              {extraAction}
              <div className="hidden sm:flex items-center gap-4 border-l pl-4 ml-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">RX</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">TX</span>
                </div>
              </div>
           </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 py-2 border-y border-dashed border-muted">
           <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Current</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-xl font-black text-blue-600 dark:text-blue-400">{latest.rx.toFixed(2)}</span>
                 <span className="text-[10px] font-bold text-muted-foreground">Mbps</span>
                 <span className="mx-1 text-muted-foreground">/</span>
                 <span className="text-xl font-black text-orange-600 dark:text-orange-400">{latest.tx.toFixed(2)}</span>
                 <span className="text-[10px] font-bold text-muted-foreground">Mbps</span>
              </div>
           </div>
           <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Average</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-sm font-bold text-blue-500/80">{avgRx.toFixed(2)}</span>
                 <span className="text-sm font-bold text-orange-500/80">{avgTx.toFixed(2)}</span>
                 <span className="text-[10px] text-muted-foreground font-semibold">Mbps</span>
              </div>
           </div>
           <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Peak</p>
              <div className="flex items-baseline gap-1">
                 <Badge variant="secondary" className="text-xs font-black bg-blue-500/10 text-blue-600 border-0">{maxRx.toFixed(2)}</Badge>
                 <Badge variant="secondary" className="text-xs font-black bg-orange-500/10 text-orange-600 border-0">{maxTx.toFixed(2)}</Badge>
                 <span className="text-[10px] text-muted-foreground font-semibold uppercase">Mbps</span>
              </div>
           </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 sm:p-4">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
              <XAxis 
                dataKey="time" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                minTickGap={30}
              />
              <YAxis 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => `${val}M`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="rx" 
                stroke="#2563eb" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRx)" 
                isAnimationActive={false}
                name="RX Traffic"
              />
              <Area 
                type="monotone" 
                dataKey="tx" 
                stroke="#ea580c" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTx)" 
                isAnimationActive={false}
                name="TX Traffic"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
