import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { RouterSelector } from '@/components/router-selector'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CustomersSubNav } from './components/customers-sub-nav'
import { FileUp, FileDown, AlertCircle, CheckCircle2, Info, FileSpreadsheet, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { usePermission } from '@/lib/permissions'

export function CustomerImportExport() {
  const { activeRouter } = useRouterStore()
  const permissions = usePermission()
  const [file, setFile] = useState<File | null>(null)

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!activeRouter) throw new Error('Pilih router terlebih dahulu')
      
      const response = await api.get('/export_users.php', {
        params: { router_id: activeRouter.id },
        responseType: 'blob',
      })
      
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
      const fileName = `Export_Pelanggan_${activeRouter.name.replace(/\s+/g, '_')}_${dateStr}_${timeStr}.csv`
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
    onSuccess: () => {
      toast.success('Data pelanggan berhasil diunduh')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Gagal mengekspor data')
    }
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!activeRouter) throw new Error('Pilih router terlebih dahulu')
      
      const formData = new FormData()
      formData.append('csv_file', file)
      formData.append('router_id', activeRouter.id.toString())
      
      const res = await api.post('/import_users.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message)
        setFile(null)
        // Reset file input
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        toast.error(data.message || 'Gagal mengimpor data')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat mengunggah file')
    }
  })

  const downloadTemplate = () => {
    const headers = ['username', 'password', 'profile', 'alamat', 'wa', 'tanggal_tagihan', 'maps', 'lat', 'lng', 'redaman', 'odp_name']
    const sample = ['pelanggan1', '123456', '150RB-20MB', 'Jl. Contoh No. 1', '628123456789', '2026-05-10', 'https://maps...', '-7.123', '110.123', '10dB', 'ODP-XXX-01']
    
    const csvContent = [headers, sample].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "Template_Import_Pelanggan.csv")
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.info('Template CSV berhasil diunduh')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Hanya file CSV yang diizinkan')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleImport = () => {
    if (!file) {
      toast.error('Pilih file CSV terlebih dahulu')
      return
    }
    importMutation.mutate(file)
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-primary/10 rounded-lg'>
            <FileSpreadsheet className='h-5 w-5 text-primary' />
          </div>
          <h1 className='text-lg font-bold'>Import / Export Pelanggan</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='space-y-6' fluid>
        <CustomersSubNav active='/customers/import-export' />

        <div className='grid gap-6 md:grid-cols-2'>
          {/* Export Card */}
          <Card className='border-none shadow-lg overflow-hidden'>
            <div className='h-1.5 w-full bg-blue-500' />
            <CardHeader>
              <div className='flex items-center gap-2 mb-2'>
                <div className='p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg'>
                  <FileDown className='h-5 w-5 text-blue-600' />
                </div>
                <CardTitle className='text-lg'>Export Data Pelanggan</CardTitle>
              </div>
              <CardDescription>
                Unduh seluruh data pelanggan yang ada di database router ini ke dalam format CSV.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Alert className='bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900'>
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className='text-xs font-bold text-blue-700 dark:text-blue-400'>Informasi Export</AlertTitle>
                <AlertDescription className='text-[10px] text-blue-600/80 dark:text-blue-400/60'>
                  File mencakup: Username, Pass, Profile, Alamat, WA, Tgl Tagihan, Maps, Lat, Lng, Redaman, dan Nama ODP.
                </AlertDescription>
              </Alert>
              <Button 
                className='w-full' 
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || !activeRouter}
              >
                <Download className='mr-2 h-4 w-4' />
                {exportMutation.isPending ? 'Mengekspor...' : 'Download CSV Pelanggan'}
              </Button>
            </CardContent>
          </Card>

          {/* Import Card */}
          {permissions.canImportCustomers && <Card className='border-none shadow-lg overflow-hidden'>
            <div className='h-1.5 w-full bg-emerald-500' />
            <CardHeader className='flex flex-row items-start justify-between'>
              <div>
                <div className='flex items-center gap-2 mb-2'>
                  <div className='p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg'>
                    <FileUp className='h-5 w-5 text-emerald-600' />
                  </div>
                  <CardTitle className='text-lg'>Import Data Pelanggan</CardTitle>
                </div>
                <CardDescription>
                  Unggah file CSV untuk menambah/update data massal.
                </CardDescription>
              </div>
              <Button variant='outline' className='text-[10px] h-7 px-2 font-black' onClick={downloadTemplate}>
                <Download className='mr-1 h-3 w-3' /> TEMPLATE
              </Button>
            </CardHeader>
            <CardContent className='space-y-4'>
               <div className='p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/30'>
                  <Upload className='h-8 w-8 text-muted-foreground opacity-50' />
                  <div className='text-center'>
                    <p className='text-xs font-bold'>Klik atau geser file CSV ke sini</p>
                    <p className='text-[10px] text-muted-foreground'>Format file harus .csv</p>
                  </div>
                  <Input 
                    id='csv-upload'
                    type='file' 
                    accept='.csv'
                    className='hidden'
                    onChange={handleFileChange}
                  />
                  <Button 
                    variant='outline' 
                    size='sm' 
                    onClick={() => document.getElementById('csv-upload')?.click()}
                  >
                    Pilih File
                  </Button>
                  {file && (
                    <Badge variant='secondary' className='mt-2 font-bold flex items-center gap-1 py-1'>
                       <CheckCircle2 className='h-3 w-3 text-emerald-500' />
                       {file.name}
                    </Badge>
                  )}
               </div>

               <div className='space-y-2'>
                  <p className='text-[11px] font-black uppercase tracking-widest text-muted-foreground'>Petunjuk Format CSV:</p>
                  <ul className='text-[10px] space-y-1 list-disc pl-4 text-muted-foreground font-medium'>
                    <li>Pemisah kolom menggunakan koma (,).</li>
                    <li>Wajib: <b>username</b> dan <b>profile</b>.</li>
                    <li>Opsional: <b>password, alamat, wa, tanggal_tagihan, maps, lat, lng, redaman, odp_name</b>.</li>
                    <li><b>odp_name</b> harus sesuai dengan nama ODP yang ada di database.</li>
                    <li>Sistem akan melakukan <b>UPSERT</b> (Update jika data sudah ada).</li>
                  </ul>
               </div>

               <Button 
                className='w-full bg-emerald-600 hover:bg-emerald-700'
                onClick={handleImport}
                disabled={!file || importMutation.isPending || !activeRouter}
               >
                 <Upload className='mr-2 h-4 w-4' />
                 {importMutation.isPending ? 'Mengimpor...' : 'Proses Import Sekarang'}
               </Button>
            </CardContent>
          </Card>}
        </div>
      </Main>
    </>
  )
}
