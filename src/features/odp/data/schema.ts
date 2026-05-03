import { z } from 'zod'

export const odpSchema = z.object({
  id: z.number().optional(),
  router_id: z.string().optional(),
  name: z.string().min(1, 'Nama ODP wajib diisi'),
  location: z.string().min(1, 'Lokasi wajib diisi'),
  maps_link: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  type: z.enum(['splitter', 'ratio']),
  splitter_type: z.string().optional().nullable(),
  ratio_used: z.number().optional().nullable(),
  ratio_total: z.number().optional().nullable(),
  total_users: z.number().optional(),
  users_list: z.array(z.object({
    username: z.string(),
    redaman: z.string().optional(),
  })).optional(),
})

export type ODP = z.infer<typeof odpSchema>
