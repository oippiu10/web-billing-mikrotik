import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouterStore } from '@/stores/router-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RouterSelector } from '@/components/router-selector'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
    Map as MapIcon, Layers, Server, MapPin, Share2, Search, 
    Pencil, CheckCircle2, XCircle, Activity, RefreshCw, ChevronLeft,
    Users, Wifi, WifiOff, Box, Maximize2, LocateFixed 
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePermission } from '@/lib/permissions'

declare const L: any

const popupStyles = `
  .premium-popup .leaflet-popup-content-wrapper {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .premium-popup .leaflet-popup-content {
    margin: 0 !important;
    width: auto !important;
  }
  .premium-popup .leaflet-popup-tip-container {
    display: none !important;
  }
  .premium-popup .leaflet-popup-close-button {
    display: none !important;
  }
`

export default function NetworkMap() {
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = popupStyles
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const { activeRouter } = useRouterStore()
  const permissions = usePermission()
  const [showStats, setShowStats] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [clusterGroup, setClusterGroup] = useState<any>(null)
  const elementsRef = useRef<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [layers, setLayers] = useState({
    cables: true,
    odps: true,
    users: true,
    lines: true
  })
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<any[]>([])
  const tempLineRef = useRef<any>(null)
  const queryClient = useQueryClient()
  const lastFittedId = useRef<number | null>(null)

  // Data Queries
  const { data: odpList } = useQuery({
    queryKey: ['odps', activeRouter?.id],
    queryFn: async () => {
      const res = await api.get('/odp.php', { params: { router_id: activeRouter?.id } })
      return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  const { data: usersList } = useQuery({
    queryKey: ['users-map', activeRouter?.id],
    queryFn: async () => {
        const res = await api.get('/get_all_users_paginated.php', {
            params: { router_id: activeRouter?.id, per_page: 9999 }
        })
        return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  const { data: linesList } = useQuery({
    queryKey: ['network-lines', activeRouter?.id],
    queryFn: async () => {
        const res = await api.get('/network_lines.php', { params: { router_id: activeRouter?.id } })
        return res.data.data || []
    },
    enabled: !!activeRouter,
  })

  const { data: routerSummary } = useQuery({
    queryKey: ['router-summary', activeRouter?.id],
    queryFn: async () => {
        const res = await api.get('/mikrotik_live.php', { 
            params: { router_id: activeRouter?.id, cmd: 'summary' } 
        })
        return res.data.data || null
    },
    enabled: !!activeRouter,
    refetchInterval: 2000,
  })

  const formatBps = (bits: any) => {
    const b = parseInt(bits || '0')
    if (b < 1000) return b + ' bps'
    if (b < 1000000) return (b / 1000).toFixed(1) + ' Kbps'
    return (b / 1000000).toFixed(1) + ' Mbps'
  }

  const totalUsers = usersList?.length || 0
  const onlineUsers = usersList?.filter((u: any) => u.status === 'online').length || 0
  const offlineUsers = Math.max(totalUsers - onlineUsers, 0)
  const totalOdp = odpList?.length || 0
  const totalManualLines = linesList?.length || 0
  const usedPorts = odpList?.reduce((sum: number, odp: any) => sum + Number(odp.total_users || 0), 0) || 0
  const totalPorts = odpList?.reduce((sum: number, odp: any) => sum + Number(odp.ratio_total || 0), 0) || 0
  const capacityPercent = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance) return

    let center: [number, number] = [-6.9, 110.4]
    if (activeRouter?.lat && activeRouter?.lng) {
      center = [parseFloat(activeRouter.lat), parseFloat(activeRouter.lng)]
    }

    const map = L.map(mapRef.current, {
        zoomControl: false 
    }).setView(center, 14)
    
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps'
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const clusters = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true
    })
    map.addLayer(clusters)
    
    setClusterGroup(clusters)
    setMapInstance(map)
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 2 })
                toast.success('Lokasi Anda terdeteksi')
            },
            () => console.log('Geolocation failed')
        )
    }
    
    setTimeout(() => map.invalidateSize(), 300)

    return () => {
        map.remove()
        setMapInstance(null)
    }
  }, [])

  // Drawing Events
  useEffect(() => {
    if (!mapInstance) return
    if (isDrawing) {
        mapInstance.getContainer().style.cursor = 'crosshair'
        const onClick = (e: any) => {
            setDrawPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]])
        }
        mapInstance.on('click', onClick)
        return () => {
            mapInstance.off('click', onClick)
            mapInstance.getContainer().style.cursor = ''
        }
    }
  }, [mapInstance, isDrawing])

  useEffect(() => {
    if (!mapInstance) return
    if (tempLineRef.current) tempLineRef.current.remove()
    if (drawPoints.length > 1) {
        tempLineRef.current = L.polyline(drawPoints, { 
            color: '#f97316', 
            weight: 4, 
            dashArray: '5, 10',
            opacity: 0.8
        }).addTo(mapInstance)
    }
  }, [mapInstance, drawPoints])

  // Helper: ODP Capacity Color
  const getODPColor = (used: number, total: number) => {
    if (!total || total === 0) return '#3b82f6'
    const pct = (used / total) * 100
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return '#22c55e'
  }

  // Update Map Content
  useEffect(() => {
    if (!mapInstance || !clusterGroup) return

    elementsRef.current.forEach(el => el.remove())
    elementsRef.current = []
    clusterGroup.clearLayers()

    const bounds = L.latLngBounds([])
    let hasPoints = false

    // 1. Router
    // Handle Router Marker
    const rLat = parseFloat(activeRouter?.lat || '0')
    const rLng = parseFloat(activeRouter?.lng || '0')
    
    if (rLat !== 0 && rLng !== 0 && mapInstance) {
        const rPos: [number, number] = [rLat, rLng]
        
        // Find existing router marker in elementsRef
        let rMarker = (elementsRef.current as any[]).find(el => el._isRouter)
        
        if (!rMarker) {
            rMarker = L.marker(rPos, {
                icon: L.divIcon({
                    className: 'router-icon',
                    html: `<div style="background-color: #ef4444; width: 36px; height: 36px; border-radius: 10px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>`,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                })
            }).addTo(mapInstance)
            rMarker._isRouter = true
            elementsRef.current.push(rMarker)
        } else {
            rMarker.setLatLng(rPos)
        }

        const isFetching = !routerSummary
        const res = routerSummary?.resource
        const identity = routerSummary?.identity || 'SERVER UTAMA'
        const topIf = routerSummary?.top_interface
        const internet = routerSummary?.internet || 'Error'

        const cpu = res?.['cpu-load'] !== undefined ? `${res['cpu-load']}%` : '...'
        const uptime = res?.uptime || '...'
        const model = res?.['board-name'] || '...'
        
        const popupContent = `
            <div class='p-0 w-[280px] bg-[#1e293b]/95 backdrop-blur-md text-white rounded-2xl overflow-hidden shadow-2xl border-0'>
                <div class='p-4 bg-gradient-to-r from-blue-600/30 to-transparent flex items-center justify-between border-b border-white/10'>
                    <div class='flex items-center gap-3'>
                        <div class='p-2 bg-blue-500/20 rounded-xl text-blue-400'><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/></svg></div>
                        <b class='text-sm uppercase tracking-wider font-black'>${identity}</b>
                    </div>
                    <div class='flex items-center gap-1.5'>
                        <div class='w-2.5 h-2.5 rounded-full ${isFetching ? 'bg-slate-500 animate-pulse' : 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]'}'></div>
                        <span class='text-[10px] font-black uppercase tracking-tighter'>${isFetching ? 'SYNCING' : 'ONLINE'}</span>
                    </div>
                </div>

                <div class='p-4 space-y-3.5'>
                    ${isFetching ? `
                        <div class='py-8 flex flex-col items-center justify-center gap-3 text-slate-500'>
                            <div class='w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                            <span class='text-[10px] font-bold uppercase tracking-widest'>Connecting...</span>
                        </div>
                    ` : `
                    <div class='flex items-center justify-between group'>
                        <div class='flex items-center gap-3 text-slate-400'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="22" y1="15" x2="20" y2="15"/><line x1="22" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="2" y2="15"/><line x1="4" y1="9" x2="2" y2="9"/></svg>
                            <span class='text-[11px] font-bold'>Model</span>
                        </div>
                        <span class='text-[11px] font-black text-slate-200'>${model}</span>
                    </div>

                    <div class='flex items-center justify-between'>
                        <div class='flex items-center gap-3 text-slate-400'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="15" y1="2" x2="15" y2="4" /><line x1="9" y1="2" x2="9" y2="4" /><line x1="15" y1="20" x2="15" y2="22" /><line x1="9" y1="20" x2="9" y2="22" /><line x1="22" y1="15" x2="20" y2="15" /><line x1="22" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="2" y2="15" /><line x1="4" y1="9" x2="2" y2="9" /></svg>
                            <span class='text-[11px] font-bold'>CPU</span>
                        </div>
                        <span class='text-[11px] font-black text-green-400'>${cpu}</span>
                    </div>

                    <div class='flex items-center justify-between'>
                        <div class='flex items-center gap-3 text-slate-400'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class='text-[11px] font-bold'>Uptime</span>
                        </div>
                        <span class='text-[11px] font-black text-orange-400'>${uptime}</span>
                    </div>

                    <div class='flex items-center justify-between'>
                        <div class='flex items-center gap-3 text-slate-400'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <span class='text-[11px] font-bold'>Internet (8.8.8.8)</span>
                        </div>
                        <span class='text-[11px] font-black ${internet === 'OK' ? 'text-green-400' : 'text-red-500'}'>${internet}</span>
                    </div>

                    ${topIf ? `
                    <div class='mt-4 p-3.5 bg-black/40 rounded-xl border border-white/5 space-y-3'>
                        <div class='flex items-center gap-2'>
                            <span class='text-[9px] font-black uppercase text-cyan-400 tracking-widest'>TRAFFIC ${topIf.name}</span>
                        </div>
                        <div class='flex justify-between'>
                            <div class='flex items-center gap-2'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class='text-green-400'><path d="m19 12-7 7-7-7"/><path d="M12 19V5"/></svg>
                                <span class='text-[13px] font-black'>${formatBps(topIf.bps_rx)}</span>
                            </div>
                            <div class='flex items-center gap-2'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class='text-blue-400'><path d="m5 12 7-7 7 7"/><path d="M12 5v14"/></svg>
                                <span class='text-[13px] font-black'>${formatBps(topIf.bps_tx)}</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    `}
                </div>
            </div>
        `

        // Update popup content without closing it if possible, or bind normally
        rMarker.bindPopup(popupContent, { 
            className: 'premium-popup',
            autoPan: false,
            closeButton: false
        })

        // If popup is open, update its content live
        if (rMarker.isPopupOpen()) {
            rMarker.setPopupContent(popupContent)
        }

        bounds.extend(rPos)
        hasPoints = true
    }

    // 2. ODP
    if (odpList && layers.odps) {
        odpList.forEach((odp: any) => {
            if (odp.lat && odp.lng) {
                const pos = [parseFloat(odp.lat), parseFloat(odp.lng)]
                const color = getODPColor(odp.total_users, odp.ratio_total)
                const marker = L.marker(pos, {
                    icon: L.divIcon({
                        className: 'odp-icon',
                        html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                    })
                }).addTo(mapInstance)
                const used = Number(odp.total_users || 0)
                const total = Number(odp.ratio_total || 0)
                const pct = total > 0 ? Math.round((used / total) * 100) : 0
                const odpUsers = usersList?.filter((u: any) => String(u.odp_id) === String(odp.id)) || []
                marker.bindPopup(`
                    <div class='w-[260px] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white'>
                        <div style='background:${color}' class='p-4 text-white'>
                            <div class='flex items-center justify-between gap-3'>
                                <div>
                                    <p class='text-[9px] font-black uppercase tracking-[0.2em] opacity-80'>Optical Distribution Point</p>
                                    <h4 class='mt-1 truncate text-sm font-black'>${odp.name}</h4>
                                </div>
                                <div class='rounded-xl bg-white/20 px-2.5 py-1 text-xs font-black'>${pct}%</div>
                            </div>
                        </div>
                        <div class='space-y-3 p-4'>
                            <div>
                                <div class='mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'>
                                    <span>Kapasitas</span><span>${used}/${total || '?'}</span>
                                </div>
                                <div class='h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800'>
                                    <div class='h-full rounded-full' style='width:${Math.min(pct, 100)}%; background:${color}'></div>
                                </div>
                            </div>
                            <div class='grid grid-cols-2 gap-2'>
                                <div class='rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70'>
                                    <p class='text-lg font-black'>${odpUsers.length}</p>
                                    <p class='text-[9px] font-black uppercase text-slate-500'>Pelanggan</p>
                                </div>
                                <div class='rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70'>
                                    <p class='text-lg font-black'>${Math.max((total || 0) - used, 0)}</p>
                                    <p class='text-[9px] font-black uppercase text-slate-500'>Sisa Port</p>
                                </div>
                            </div>
                            ${odp.alamat ? `<p class='rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-500 dark:bg-slate-800/70 dark:text-slate-400'>${odp.alamat}</p>` : ''}
                        </div>
                    </div>
                `, { className: 'premium-popup', closeButton: false })
                elementsRef.current.push(marker)
                bounds.extend(pos)
                hasPoints = true

                if (layers.cables && activeRouter?.lat && activeRouter?.lng) {
                    const line = L.polyline([[parseFloat(activeRouter.lat), parseFloat(activeRouter.lng)], pos], { color: '#ef4444', weight: 2, dashArray: '8, 8', opacity: 0.4 }).addTo(mapInstance)
                    elementsRef.current.push(line)
                }
            }
        })
    }

    // 3. Users
    if (usersList && layers.users) {
        usersList
          .filter((user: any) => statusFilter === 'all' || user.status === statusFilter)
          .forEach((user: any) => {
            if (user.lat && user.lng) {
                const pos = [parseFloat(user.lat), parseFloat(user.lng)]
                const marker = L.circleMarker(pos, {
                    radius: 5,
                    fillColor: user.status === 'online' ? '#22c55e' : '#94a3b8',
                    color: '#fff', weight: 1.5, opacity: 1, fillOpacity: 0.9
                })
                const statusColor = user.status === 'online' ? '#22c55e' : '#94a3b8'
                const profile = user.profile || user.paket || '-'
                marker.bindPopup(`
                    <div class='w-[280px] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white'>
                        <div class='p-4 ${user.status === 'online' ? 'bg-emerald-600' : 'bg-slate-600'} text-white'>
                            <div class='flex items-center justify-between gap-3'>
                                <div class='min-w-0'>
                                    <p class='text-[9px] font-black uppercase tracking-[0.2em] opacity-80'>Pelanggan PPPoE</p>
                                    <h4 class='mt-1 truncate text-sm font-black'>${user.username}</h4>
                                </div>
                                <div class='flex items-center gap-1.5 rounded-xl bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase'>
                                    <span class='h-2 w-2 rounded-full bg-white'></span>${user.status || 'unknown'}
                                </div>
                            </div>
                        </div>
                        <div class='space-y-3 p-4'>
                            <div class='grid grid-cols-2 gap-2'>
                                <div class='rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70'>
                                    <p class='truncate text-xs font-black'>${profile}</p>
                                    <p class='text-[9px] font-black uppercase text-slate-500'>Profile</p>
                                </div>
                                <div class='rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70'>
                                    <p class='truncate text-xs font-black'>${user.ip_address || user.address || '-'}</p>
                                    <p class='text-[9px] font-black uppercase text-slate-500'>IP Address</p>
                                </div>
                            </div>
                            ${user.alamat ? `<p class='rounded-xl bg-slate-50 p-3 text-[10px] font-bold text-slate-500 dark:bg-slate-800/70 dark:text-slate-400'>${user.alamat}</p>` : ''}
                            <button onclick='window.checkLiveByUsername("${user.username}")' class='w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-700'>Cek Live Status</button>
                        </div>
                    </div>
                `, { className: 'premium-popup', closeButton: false })
                clusterGroup.addLayer(marker)
                bounds.extend(pos)
                hasPoints = true

                if (layers.cables && user.odp_id) {
                    const odp = odpList?.find((o: any) => String(o.id) === String(user.odp_id))
                    if (odp && odp.lat && odp.lng) {
                        const line = L.polyline([[parseFloat(odp.lat), parseFloat(odp.lng)], pos], { color: '#3b82f6', weight: 1, opacity: 0.2 }).addTo(mapInstance)
                        elementsRef.current.push(line)
                    }
                }
            }
        })
    }

    // 4. Lines
    if (linesList && layers.lines) {
        linesList.forEach((line: any) => {
            if (line.path && line.path.length > 0) {
                const poly = L.polyline(line.path, { color: line.color || '#3b82f6', weight: 3, opacity: 0.8 }).addTo(mapInstance)
                poly.bindPopup(`<b>Kabel: ${line.name}</b>`)
                elementsRef.current.push(poly)
                line.path.forEach((p: any) => bounds.extend(p))
                hasPoints = true
            }
        })
    }
    if (hasPoints && mapInstance && lastFittedId.current !== activeRouter?.id) {
        mapInstance.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
        lastFittedId.current = activeRouter?.id || null
    }
  }, [mapInstance, clusterGroup, odpList, usersList, linesList, activeRouter, layers, routerSummary, statusFilter])

  const handleSearch = () => {
    if (!searchQuery || !usersList || !mapInstance) return
    const user = usersList.find((u: any) => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    if (user && user.lat && user.lng) {
        mapInstance.flyTo([user.lat, user.lng], 19, { duration: 2 })
        toast.success(`Menuju lokasi ${user.username}`)
    } else {
        toast.error('Lokasi pelanggan tidak ditemukan')
    }
  }

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const fitAllPoints = () => {
    if (!mapInstance) return
    const bounds = L.latLngBounds([])
    let hasPoints = false
    if (activeRouter?.lat && activeRouter?.lng) {
      bounds.extend([parseFloat(activeRouter.lat), parseFloat(activeRouter.lng)])
      hasPoints = true
    }
    odpList?.forEach((o: any) => {
      if (o.lat && o.lng) {
        bounds.extend([parseFloat(o.lat), parseFloat(o.lng)])
        hasPoints = true
      }
    })
    usersList?.forEach((u: any) => {
      if (u.lat && u.lng) {
        bounds.extend([parseFloat(u.lat), parseFloat(u.lng)])
        hasPoints = true
      }
    })
    if (hasPoints) mapInstance.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
  }

  const goToRouter = () => {
    if (mapInstance && activeRouter?.lat && activeRouter?.lng) {
      mapInstance.flyTo([parseFloat(activeRouter.lat), parseFloat(activeRouter.lng)], 17, { duration: 1.5 })
    }
  }

  const saveLine = async () => {
    if (!permissions.canManageCustomers) {
        toast.error('Anda tidak punya akses mengubah network map')
        return
    }
    if (drawPoints.length < 2) {
        toast.error('Gambarkan minimal 2 titik')
        return
    }
    const name = prompt('Nama Jalur Kabel:', `Kabel Baru ${new Date().toLocaleTimeString()}`)
    if (!name) return

    try {
        await api.post('/network_lines.php', {
            router_id: activeRouter?.software_id || activeRouter?.id,
            name,
            type: 'manual',
            path: drawPoints,
            color: '#3b82f6'
        })
        toast.success('Jalur kabel disimpan')
        setIsDrawing(false)
        setDrawPoints([])
        queryClient.invalidateQueries({ queryKey: ['network-lines'] })
    } catch (err) {
        toast.error('Gagal menyimpan jalur')
    }
  }

  // Live Status Logic
  const [liveTarget, setLiveTarget] = useState<any>(null)
  const [liveResult, setLiveResult] = useState<any>(null)
  const [isLiveLoading, setIsLiveLoading] = useState(false)

  const checkLive = async (entity: any) => {
    setLiveTarget(entity)
    setLiveResult(null)
    setIsLiveLoading(true)
    try {
        // Find user in ppp_active to get IP or use direct IP if available
        const res = await api.post('/mikrotik_action.php', {
            router_id: activeRouter?.id,
            action: 'ping',
            params: { address: entity.username || entity.name } // Mikrotik can ping by PPP name if resolve=yes
        })
        setLiveResult(res.data.data)
    } catch (err) {
        toast.error('Gagal mengambil status live')
    } finally {
        setIsLiveLoading(false)
    }
  }

  // Register global function for Leaflet popups
  (window as any).checkLiveByUsername = (username: string) => {
    const user = usersList?.find((u: any) => u.username === username)
    if (user) checkLive(user)
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto flex items-center gap-2'>
          <div className='p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg'>
            <MapIcon className='h-5 w-5 text-indigo-600' />
          </div>
          <h1 className='text-lg font-bold'>Network Topology Map</h1>
        </div>
        <RouterSelector />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='p-0 flex flex-col h-[calc(100vh-64px)] overflow-hidden' fluid>
        <div className='flex-1 relative overflow-hidden bg-slate-950'>
            <div className='absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_30%)]' />
            <div ref={mapRef} className='absolute inset-0 z-0 [&_.leaflet-control-attribution]:hidden [&_.leaflet-control-zoom]:rounded-2xl [&_.leaflet-control-zoom]:overflow-hidden [&_.leaflet-control-zoom]:border-0 [&_.leaflet-control-zoom]:shadow-2xl' />
            <div className='pointer-events-none absolute inset-x-0 top-0 z-[500] h-32 bg-gradient-to-b from-slate-950/35 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 z-[500] h-40 bg-gradient-to-t from-slate-950/35 to-transparent' />
            
            <div className='absolute left-6 right-6 top-6 z-[1000] flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
              <div className='w-full max-w-md flex gap-2'>
                <div className='relative flex-1 group'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors' />
                    <Input 
                        placeholder='Cari Nama Pelanggan...' 
                        className='pl-10 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border border-white/30 dark:border-white/10 font-bold rounded-2xl'
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <button onClick={handleSearch} className='h-12 px-6 bg-primary text-primary-foreground rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all'>
                    Cari
                </button>
              </div>

              <div className='flex flex-wrap items-center gap-2 xl:justify-end'>
                {[
                  { id: 'all', label: 'Semua', value: totalUsers },
                  { id: 'online', label: 'Online', value: onlineUsers },
                  { id: 'offline', label: 'Offline', value: offlineUsers },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={cn(
                      'rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-xl transition-all',
                      statusFilter === f.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-white/30 bg-white/90 hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800'
                    )}
                  >
                    {f.label} <span className='ml-1 opacity-70'>({f.value})</span>
                  </button>
                ))}
                <button onClick={goToRouter} className='h-10 w-10 rounded-2xl border border-white/30 bg-white/90 shadow-xl backdrop-blur-xl hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800' title='Fokus router'>
                  <LocateFixed className='mx-auto h-4 w-4' />
                </button>
                <button onClick={fitAllPoints} className='h-10 w-10 rounded-2xl border border-white/30 bg-white/90 shadow-xl backdrop-blur-xl hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800' title='Fit semua titik'>
                  <Maximize2 className='mx-auto h-4 w-4' />
                </button>
              </div>
            </div>

            {/* Live Status Overlay */}
            {liveTarget && (
                <div className='absolute bottom-24 left-6 z-[1000] w-64 animate-in slide-in-from-left duration-300'>
                    <Card className='border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl overflow-hidden'>
                        <CardContent className='p-4 space-y-3'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-2'>
                                    <Activity className='h-4 w-4 text-green-500 animate-pulse' />
                                    <span className='text-[10px] font-black uppercase tracking-widest'>Live Diagnostics</span>
                                </div>
                                <button onClick={() => setLiveTarget(null)} className='text-muted-foreground hover:text-foreground'><XCircle className='h-4 w-4' /></button>
                            </div>
                            <div className='p-3 bg-muted/50 rounded-2xl'>
                                <p className='text-xs font-black truncate'>{liveTarget.username || liveTarget.name}</p>
                                <p className='text-[9px] text-muted-foreground uppercase font-bold tracking-tighter'>Target Device</p>
                            </div>
                            <div className='space-y-2'>
                                {isLiveLoading ? (
                                    <div className='flex flex-col items-center py-4 gap-2'>
                                        <RefreshCw className='h-5 w-5 animate-spin text-primary' />
                                        <span className='text-[10px] font-bold text-muted-foreground'>Pinging...</span>
                                    </div>
                                ) : liveResult ? (
                                    <div className='space-y-1.5'>
                                        {liveResult.map((p: any, i: number) => (
                                            <div key={i} className='flex items-center justify-between text-[10px] font-mono p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg'>
                                                <span className='text-muted-foreground'>Seq {p.seq || i}</span>
                                                <span className={cn('font-bold', p.status ? 'text-red-500' : 'text-green-600')}>
                                                    {p.status || `${p.time || '0ms'}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='text-[10px] text-center text-muted-foreground py-2'>Klik "Cek Status" di peta</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sidebar Toggle Button (Only when hidden) */}
            {!showStats && (
                <button 
                    onClick={() => setShowStats(true)}
                    className='absolute top-24 left-6 z-[1001] p-4 bg-primary text-primary-foreground rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2 group'
                >
                    <Layers className='h-5 w-5' />
                    <span className='text-[10px] font-black uppercase tracking-widest overflow-hidden w-0 group-hover:w-24 transition-all'>Layers</span>
                </button>
            )}

            <div className={`absolute top-28 left-6 z-[1000] transition-all duration-300 transform ${showStats ? 'translate-x-0' : '-translate-x-[calc(100%+30px)] opacity-0 pointer-events-none'}`}>
                <Card className='w-72 overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90'>
                    <CardContent className='p-3'>
                        <div className='mb-2 flex items-center justify-between px-1'>
                            <div className='flex items-center gap-2'>
                                <Layers className='h-4 w-4 text-primary' />
                                <h3 className='text-xs font-black uppercase tracking-widest'>Layers</h3>
                            </div>
                            <button
                                onClick={() => setShowStats(false)}
                                className='rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
                                title='Sembunyikan'
                            >
                                <ChevronLeft className='h-4 w-4' />
                            </button>
                        </div>

                        <div className='space-y-1'>
                            {[
                                { id: 'odps', label: 'ODP', desc: `${totalOdp} titik`, icon: Box, color: 'text-blue-500', dot: 'bg-blue-500' },
                                { id: 'users', label: 'Pelanggan', desc: `${totalUsers} user`, icon: Users, color: 'text-emerald-500', dot: 'bg-emerald-500' },
                                { id: 'cables', label: 'Kabel otomatis', desc: 'router → odp → user', icon: Share2, color: 'text-red-500', dot: 'bg-red-500' },
                                { id: 'lines', label: 'Jalur manual', desc: `${totalManualLines} line`, icon: Pencil, color: 'text-orange-500', dot: 'bg-orange-500' },
                            ].map((l) => {
                                const Icon = l.icon
                                const active = layers[l.id as keyof typeof layers]
                                return (
                                    <button
                                        key={l.id}
                                        onClick={() => toggleLayer(l.id as any)}
                                        className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-muted/70'
                                    >
                                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted/70', active ? l.color : 'text-muted-foreground opacity-50')}>
                                            <Icon className='h-4 w-4' />
                                        </div>
                                        <div className='min-w-0 flex-1'>
                                            <p className={cn('truncate text-xs font-bold', !active && 'text-muted-foreground')}>
                                                {l.label}
                                            </p>
                                            <p className='truncate text-[10px] text-muted-foreground'>{l.desc}</p>
                                        </div>
                                        <div className={cn('relative h-5 w-9 rounded-full transition', active ? 'bg-primary' : 'bg-muted')}>
                                            <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', active ? 'left-4' : 'left-0.5')} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {permissions.canManageCustomers && (
                <div className='flex gap-2'>
                    {isDrawing ? (
                        <>
                            <button onClick={saveLine} className='flex-1 h-10 bg-green-600 text-white rounded-xl shadow-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all'>
                                <CheckCircle2 className='h-3.5 w-3.5' /> Simpan
                            </button>
                            <button onClick={() => { setIsDrawing(false); setDrawPoints([]); }} className='h-10 w-10 bg-red-100 text-red-600 rounded-xl shadow-xl flex items-center justify-center hover:bg-red-200 transition-all'>
                                <XCircle className='h-3.5 w-3.5' />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsDrawing(true)} className='flex-1 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-border/50 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-muted transition-all'>
                            <Pencil className='h-3.5 w-3.5 text-orange-500' /> Gambar
                        </button>
                    )}
                    <button className='h-10 w-10 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-border/50 flex items-center justify-center hover:bg-muted transition-all'>
                        <Share2 className='h-3.5 w-3.5' />
                    </button>
                </div>
                )}
            </div>

            <div className='absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2'>
                <div className='flex items-center gap-4 rounded-2xl border border-white/40 bg-white/95 px-4 py-2.5 text-xs shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90'>
                    <div className='flex items-center gap-2 font-bold'><Wifi className='h-4 w-4 text-emerald-500' /> {onlineUsers} Online</div>
                    <div className='h-4 w-px bg-border' />
                    <div className='flex items-center gap-2 font-bold'><WifiOff className='h-4 w-4 text-slate-500' /> {offlineUsers} Offline</div>
                    <div className='h-4 w-px bg-border' />
                    <div className='flex items-center gap-2 font-bold'><Box className='h-4 w-4 text-blue-500' /> {totalOdp} ODP</div>
                    <div className='h-4 w-px bg-border' />
                    <div className={cn('font-black', capacityPercent >= 90 ? 'text-red-600' : capacityPercent >= 70 ? 'text-orange-600' : 'text-emerald-600')}>Port {capacityPercent}%</div>
                </div>
            </div>
        </div>
      </Main>
    </>
  )
}
