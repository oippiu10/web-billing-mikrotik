import { z } from 'zod'

export const customerSchema = z.object({
  id: z.number().or(z.string()).optional(),
  router_id: z.string().optional(),
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().optional(),
  profile: z.string().optional(),
  wa: z.string().optional(),
  alamat: z.string().optional(),
  maps: z.string().optional(),
  lat: z.number().or(z.string()).optional().nullable(),
  lng: z.number().or(z.string()).optional().nullable(),
  foto: z.string().optional().nullable(),
  'remote-address': z.string().optional(),
  'rate-limit': z.string().optional(),
  disabled: z.enum(['yes', 'no']).optional(),
  status: z.enum(['online', 'offline']).optional(),
  redaman: z.string().optional().nullable(),
  tanggal_tagihan: z.string().optional().nullable(),
  tanggal_dibuat: z.string().optional().nullable(),
  odp_id: z.number().or(z.string()).optional().nullable(),
  odp_name: z.string().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type Customer = z.infer<typeof customerSchema>
