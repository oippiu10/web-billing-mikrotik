import { createFileRoute } from '@tanstack/react-router'
import NetworkMap from '@/features/network-map'

export const Route = createFileRoute('/_authenticated/network-map')({
  component: NetworkMap,
})
