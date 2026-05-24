const fs = require('fs');
let code = fs.readFileSync('src/features/network-map/index.tsx', 'utf8');

if (!code.includes('const formatBps')) {
    code = code.replace('export default function NetworkMap', `const formatBps = (bits: number) => {
    if (bits >= 1000000) return (bits / 1000000).toFixed(1) + ' Mbps'
    if (bits >= 1000) return (bits / 1000).toFixed(0) + ' Kbps'
    return bits + ' bps'
}

export default function NetworkMap`);
}

const oldFuncRegex = /\;?\(window as any\)\.checkLiveByUsername =.*?}\s*/s;
code = code.replace(oldFuncRegex, '');

code = code.replace('return (\n    <>\n      <Header', `  ;(window as any).syncAcsByUsername = async (username: string) => {
    const acsDevice = acsDevices?.find((d: any) => getNestedParam(d, 'VirtualParameters.pppoeUsername') === username)
    if (acsDevice && acsDevice._id) {
       toast.loading('Menyinkronkan data dengan modem...', { id: 'acs-sync' })
       try {
           await api.post(\`/genieacs_proxy.php?path=/devices/\${acsDevice._id}/tasks?timeout=3000&connection_request\`, { name: 'refreshObject', objectName: '' })
           toast.success('Perintah sinkronisasi berhasil dikirim', { id: 'acs-sync' })
           setTimeout(() => {
               queryClient.invalidateQueries({ queryKey: ['genieacs-devices'] })
           }, 2000)
       } catch(err) {
           toast.error('Gagal menyinkronkan data ACS', { id: 'acs-sync' })
       }
    } else {
       toast.error('Perangkat belum terhubung ke ACS')
    }
  }

  return (
    <>
      <Header`);

const startIdx = code.indexOf("const profile = user.profile || user.paket || '-'");
const endMarker = "bounds.extend(pos)\n                hasPoints = true";
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `const profile = user.profile || user.paket || '-'
                const acsDevice = acsDevices?.find((d: any) => getNestedParam(d, 'VirtualParameters.pppoeUsername') === user.username)
                
                const getConnectedHosts = (d: any) => {
                    if (!d) return []
                    const hosts: any[] = []
                    const searchForHosts = (obj: any) => {
                        if (!obj || typeof obj !== 'object') return
                        if (obj.MACAddress && obj.MACAddress._value) {
                            const ip = obj.IPAddress?._value || '-'
                            const activeVal = obj.Active?._value
                            if (activeVal === undefined || activeVal === true || activeVal === 'true' || activeVal === '1') {
                                hosts.push({
                                    name: obj.HostName?._value || 'Unknown Device',
                                    ip: ip === '0.0.0.0' ? '-' : ip,
                                    mac: obj.MACAddress._value || '-'
                                })
                            }
                            return
                        }
                        for (const k in obj) {
                            if (typeof obj[k] === 'object') {
                                searchForHosts(obj[k])
                            }
                        }
                    }
                    searchForHosts(d)
                    return hosts
                }

                const redamanLive = acsDevice ? getNestedParam(acsDevice, 'VirtualParameters.RXPower') : null
                const redamanAwal = user.redaman
                const model = acsDevice ? (getNestedParam(acsDevice, 'Device.DeviceInfo.ProductClass') || getNestedParam(acsDevice, 'InternetGatewayDevice.DeviceInfo.ModelName')) : null
                const temp = acsDevice ? getNestedParam(acsDevice, 'VirtualParameters.gettemp') : null
                const wifiClients = acsDevice ? getNestedParam(acsDevice, 'VirtualParameters.activedevices') : null
                const uptimeRaw = acsDevice ? getNestedParam(acsDevice, 'VirtualParameters.getdeviceuptime') || getNestedParam(acsDevice, 'InternetGatewayDevice.DeviceInfo.UpTime') : null
                
                let uptime = '-'
                if (uptimeRaw && !isNaN(Number(uptimeRaw))) {
                    const secs = Number(uptimeRaw)
                    if (secs > 86400) uptime = \`\${Math.floor(secs / 86400)}d\`
                    else if (secs > 3600) uptime = \`\${Math.floor(secs / 3600)}h\`
                    else if (secs > 60) uptime = \`\${Math.floor(secs / 60)}m\`
                    else uptime = \`\${secs}s\`
                } else if (uptimeRaw) {
                    uptime = String(uptimeRaw).split(' ')[0]
                }

                const activeHosts = getConnectedHosts(acsDevice)
                
                const acsBoxes = acsDevice ? \`
                    <div class='grid grid-cols-4 gap-1 mt-1.5'>
                        <div class='rounded-md bg-blue-50 border border-blue-100 p-1.5 dark:bg-blue-900/20 dark:border-blue-900/30 text-center flex flex-col justify-center'>
                            <p class='text-[10px] font-black text-blue-700 dark:text-blue-400'>\${redamanLive || '-'}</p>
                            <p class='text-[7px] font-black uppercase text-blue-500'>RX dB</p>
                        </div>
                        <div class='rounded-md bg-orange-50 border border-orange-100 p-1.5 dark:bg-orange-900/20 dark:border-orange-900/30 text-center flex flex-col justify-center'>
                            <p class='text-[10px] font-black text-orange-700 dark:text-orange-400'>\${temp ? \`\${temp}°\` : '-'}</p>
                            <p class='text-[7px] font-black uppercase text-orange-500'>Suhu</p>
                        </div>
                        <div class='rounded-md bg-indigo-50 border border-indigo-100 p-1.5 dark:bg-indigo-900/20 dark:border-indigo-900/30 text-center flex flex-col justify-center'>
                            <p class='text-[10px] font-black text-indigo-700 dark:text-indigo-400'>\${wifiClients || '0'}</p>
                            <p class='text-[7px] font-black uppercase text-indigo-500'>Klien</p>
                        </div>
                        <div class='rounded-md bg-emerald-50 border border-emerald-100 p-1.5 dark:bg-emerald-900/20 dark:border-emerald-900/30 text-center flex flex-col justify-center'>
                            <p class='text-[10px] font-black text-emerald-700 dark:text-emerald-400'>\${uptime}</p>
                            <p class='text-[7px] font-black uppercase text-emerald-500'>Uptime</p>
                        </div>
                    </div>
                    \${model ? \`<p class='mt-1 text-center text-[9px] font-bold text-slate-500'>\${model}</p>\` : ''}
                    
                    \${activeHosts.length > 0 ? \`
                    <div class='mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2'>
                        <div class='flex justify-between items-center mb-1.5'>
                            <p class='text-[8px] font-black uppercase text-slate-500'>Perangkat Terhubung</p>
                            <span class='bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-bold px-1.5 rounded-full'>\${activeHosts.length}</span>
                        </div>
                        <div class='max-h-[85px] overflow-y-auto space-y-1 pr-1 custom-scrollbar'>
                            \${activeHosts.map((h: any) => \`
                                <div class='bg-white dark:bg-slate-900 rounded p-1.5 border border-slate-100 dark:border-slate-800/60'>
                                    <p class='text-[9px] font-bold truncate text-slate-700 dark:text-slate-200'>\${h.name}</p>
                                    <div class='flex justify-between text-[8px] text-slate-400 font-mono mt-0.5'>
                                        <span>\${h.ip}</span><span>\${h.mac}</span>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                    <style>
                        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
                    </style>
                    \` : ''}
                \` : ''

                marker.bindPopup(\`
                    <div class='w-[250px] overflow-hidden rounded-xl bg-white text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white'>
                        <div class='px-3 py-2.5 \${user.status === 'online' ? 'bg-emerald-600' : 'bg-slate-500'} text-white'>
                            <div class='flex items-center justify-between gap-2'>
                                <h4 class='min-w-0 truncate text-xs font-black'>\${user.username}</h4>
                                <span class='shrink-0 rounded-lg bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase'>\${user.status || 'unknown'}</span>
                            </div>
                        </div>
                        <div class='space-y-1.5 p-3'>
                            <div class='grid grid-cols-2 gap-1.5'>
                                <div class='rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70'>
                                    <p class='truncate text-[11px] font-black'>\${profile}</p>
                                    <p class='text-[8px] font-black uppercase text-slate-500'>Profile</p>
                                </div>
                                <div class='rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70'>
                                    <p id='ip-\${user.username}' class='truncate text-[11px] font-black'>\${user.ip_address || user.address || (acsDevice ? getNestedParam(acsDevice, 'VirtualParameters.pppoeIP') : null) || '-'}</p>
                                    <p class='text-[8px] font-black uppercase text-slate-500'>IP</p>
                                </div>
                            </div>
                            
                            <div class='flex items-center justify-between rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-inner dark:bg-black'>
                                <div class='flex items-center gap-1'>
                                    <svg class='h-3 w-3 text-emerald-400' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M12 19V5'/><path d='m5 12 7-7 7 7'/></svg>
                                    <span id='tx-\${user.username}' class='text-[10px] font-black tracking-widest text-emerald-400'>0 Kbps</span>
                                </div>
                                <div class='h-3 w-px bg-white/20'></div>
                                <div class='flex items-center gap-1'>
                                    <svg class='h-3 w-3 text-rose-400' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5v14'/><path d='m19 12-7 7-7-7'/></svg>
                                    <span id='rx-\${user.username}' class='text-[10px] font-black tracking-widest text-rose-400'>0 Kbps</span>
                                </div>
                            </div>
                            
                            \${!acsDevice && redamanAwal ? \`
                            <div class='grid grid-cols-1 mt-1.5'>
                                <div class='rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70 text-center'>
                                    <p class='text-[11px] font-black text-slate-600'>\${redamanAwal} dB</p>
                                    <p class='text-[8px] font-black uppercase text-slate-500'>RX Awal (Manual)</p>
                                </div>
                            </div>
                            \` : ''}

                            \${acsBoxes}

                            \${user.alamat ? \`<p class='line-clamp-2 mt-1 rounded-lg bg-slate-50 p-2 text-[9px] font-bold text-slate-500 dark:bg-slate-800/70'>\${user.alamat}</p>\` : ''}
                            
                            <div class="pt-1">
                            \${acsDevice ? 
                                \`<button onclick='window.syncAcsByUsername("\${user.username}")' class='w-full rounded-lg bg-blue-600 px-2 py-2 text-[9px] font-black uppercase text-white hover:bg-blue-700 transition-colors shadow-sm'>Refresh Data</button>\` : 
                                \`<p class='text-center text-[9px] italic text-slate-400'>Perangkat tidak terdeteksi di ACS</p>\`
                            }
                            </div>
                        </div>
                    </div>
                \`, { className: 'premium-popup', closeButton: false, autoPan: true, autoPanPadding: [24, 24], maxWidth: 260 })
                
                marker.on('popupopen', async () => {
                    try {
                        const ipEl = document.getElementById(\`ip-\${user.username}\`)
                        const rxEl = document.getElementById(\`rx-\${user.username}\`)
                        const txEl = document.getElementById(\`tx-\${user.username}\`)
                        if (rxEl) rxEl.innerText = '...'
                        if (txEl) txEl.innerText = '...'
                        
                        const res = await api.post('/mikrotik_action.php', {
                            router_id: activeRouter?.software_id || activeRouter?.id,
                            action: 'user_status',
                            params: { username: user.username }
                        })
                        const data = res.data.data
                        if (ipEl && data.ip && data.ip !== '-') ipEl.innerText = data.ip
                        if (rxEl) rxEl.innerText = formatBps(data.tx_bps)
                        if (txEl) txEl.innerText = formatBps(data.rx_bps)
                    } catch(e) {
                        const rxEl = document.getElementById(\`rx-\${user.username}\`)
                        const txEl = document.getElementById(\`tx-\${user.username}\`)
                        if (rxEl && rxEl.innerText === '...') rxEl.innerText = '0 Kbps'
                        if (txEl && txEl.innerText === '...') txEl.innerText = '0 Kbps'
                    }
                })

                clusterGroup.addLayer(marker)
                bounds.extend(pos)
                hasPoints = true
`;
    
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx + endMarker.length);
}

fs.writeFileSync('src/features/network-map/index.tsx', code);
console.log('Patch complete.');
