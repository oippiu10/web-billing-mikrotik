import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type DummyFeature = {
  title: string
  description: string
  status?: 'Dummy' | 'Planned' | 'Next'
  items: string[]
}

type RoadmapDummyPageProps = {
  title: string
  description: string
  features: DummyFeature[]
}

export function RoadmapDummyPage({ title, description, features }: RoadmapDummyPageProps) {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
        <p className='text-muted-foreground'>{description}</p>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader className='space-y-2'>
              <div className='flex items-start justify-between gap-2'>
                <CardTitle className='text-base'>{feature.title}</CardTitle>
                <Badge variant='secondary'>{feature.status ?? 'Dummy'}</Badge>
              </div>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='list-disc space-y-1 pl-5 text-sm text-muted-foreground'>
                {feature.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
