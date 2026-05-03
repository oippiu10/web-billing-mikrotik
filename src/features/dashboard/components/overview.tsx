import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface OverviewProps {
  data?: { time: string; rx: number; tx: number }[]
}

export function Overview({ data = [] }: OverviewProps) {
  const displayData = data.length > 0 ? data : defaultData

  const formatYAxis = (value: number) => {
    if (value >= 1) return `${value.toFixed(1)}M`
    if (value > 0) return `${(value * 1024).toFixed(0)}K`
    return '0'
  }

  return (
    <ResponsiveContainer width='100%' height={350}>
      <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.1} />
        <XAxis
          dataKey='time'
          stroke='#888888'
          fontSize={10}
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis
          stroke='#888888'
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatYAxis}
        />
        <Tooltip 
          contentStyle={{ 
            borderRadius: '12px', 
            border: 'none', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            color: '#fff'
          }}
          itemStyle={{ padding: '2px 0' }}
          formatter={(value: any) => [`${parseFloat(value).toFixed(2)} Mbps`]}
        />
        <Area
          type="monotone"
          dataKey='rx'
          name="Download"
          stroke='#3b82f6'
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorRx)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey='tx'
          name="Upload"
          stroke='#10b981'
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorTx)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const defaultData = [
  { time: '', rx: 0, tx: 0 },
]
