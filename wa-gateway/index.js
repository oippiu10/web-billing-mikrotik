const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys')
const express = require('express')
const cors = require('cors')
const pino = require('pino')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 4890

app.use(cors())
app.use(express.json())

const sessionPath = path.join(__dirname, 'session')

let sock = null
let qrCodeUrl = ''
let connectionStatus = 'disconnected'
let connectedNumber = ''
let connectedName = ''

// Setup logger minimal agar console bersih
const logger = pino({ level: 'silent' })

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version, isLatest } = await fetchLatestBaileysVersion()
  
  console.log(`[WA-Gateway] Memulai Baileys v${version.join('.')}, latest: ${isLatest}`)

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['Windows', 'Chrome', '109.0.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (qr) {
      try {
        qrCodeUrl = await QRCode.toDataURL(qr)
        connectionStatus = 'disconnected'
      } catch (err) {
        console.error('[WA-Gateway] Gagal mengonversi QR ke DataURL', err)
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('[WA-Gateway] Koneksi terputus. Alasan:', lastDisconnect?.error, 'Reconnect:', shouldReconnect)
      
      qrCodeUrl = ''
      connectionStatus = 'disconnected'
      connectedNumber = ''
      connectedName = ''
      
      if (shouldReconnect) {
        startWhatsApp()
      } else {
        console.log('[WA-Gateway] Perangkat keluar (loggedOut). Menghapus sesi lama...')
        clearSession()
        startWhatsApp()
      }
    } else if (connection === 'open') {
      console.log('[WA-Gateway] Koneksi TERBUKA & AKTIF!')
      qrCodeUrl = ''
      connectionStatus = 'connected'
      
      const user = sock.user || {}
      connectedNumber = user.id ? user.id.split(':')[0] : '-'
      connectedName = user.name || 'Gateway Billing WiFiKu'
    }
  })

  // ── DENGARKAN CHAT MASUK (TWO-WAY MESSAGING WEBHOOK) ───────────────────────
  sock.ev.on('messages.upsert', async (m) => {
    // Hanya proses pesan baru
    if (m.type !== 'notify') return

    for (const msg of m.messages) {
      // Abaikan jika pesan dikirim oleh diri kita sendiri
      if (msg.key.fromMe) continue

      // Ambil nomor pengirim
      const jid = msg.key.remoteJid
      if (!jid || !jid.endsWith('@s.whatsapp.net')) continue
      const phone = jid.split('@')[0]

      // Ekstrak teks pesan
      const messageText = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          msg.message?.videoMessage?.caption || '';

      if (!messageText.trim()) continue

      console.log(`[WA-Gateway] Pesan MASUK dari ${phone}: ${messageText}`)

      // Kirim webhook ke PHP backend local subfolder /shadcn
      const webhookData = JSON.stringify({ phone: phone, message: messageText })
      
      // Menggunakan modular http request agar super tangguh & kompatibel dengan versi node lama/baru
      try {
        const req = require('http').request({
          hostname: '127.0.0.1',
          port: 80,
          path: '/shadcn/api/wa_receiver.php',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(webhookData)
          }
        }, (res) => {
          res.on('data', () => {}) // consume
        })
        
        req.on('error', (e) => {
          console.error('[WA-Gateway] Webhook HTTP Error:', e.message)
        })
        
        req.write(webhookData)
        req.end()
      } catch (err) {
        console.error('[WA-Gateway] Gagal mengirim webhook:', err.message)
      }
    }
  })
}

function clearSession() {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      console.log('[WA-Gateway] Folder sesi dibersihkan dengan sukses!')
    }
  } catch (err) {
    console.error('[WA-Gateway] Gagal membersihkan folder sesi', err)
  }
}

// ── HTTP API ENDPOINTS ────────────────────────────────────────────────

// 1. Ambil status koneksi perangkat
app.get('/status', (req, res) => {
  res.json({
    success: true,
    connected: connectionStatus === 'connected',
    device_info: {
      number: connectedNumber,
      name: connectedName,
      quota: 'UNLIMITED (Gratis)',
      expiry: 'SEUMUR HIDUP'
    }
  })
})

// 2. Ambil QR Code Gambar (Base64) jika belum terhubung
app.get('/qr', (req, res) => {
  if (connectionStatus === 'connected') {
    return res.json({ success: false, message: 'WhatsApp sudah terhubung!' })
  }
  
  if (!qrCodeUrl) {
    return res.json({ success: false, message: 'QR Code sedang dibuat, silakan muat ulang beberapa saat lagi...' })
  }
  
  res.json({
    success: true,
    qr: qrCodeUrl
  })
})

// 3. Putuskan koneksi WhatsApp (Logout)
app.get('/disconnect', async (req, res) => {
  console.log('[WA-Gateway] Menerima request pemutusan perangkat (Logout)...')
  try {
    if (sock) {
      await sock.logout()
    }
    clearSession()
    res.json({ success: true, message: 'Perangkat berhasil diputus dan sesi dibersihkan!' })
  } catch (err) {
    clearSession()
    res.json({ success: true, message: 'Sesi dibersihkan secara paksa!' })
    setTimeout(() => {
      startWhatsApp()
    }, 1500)
  }
})

// 4. Kirim pesan WhatsApp ke tujuan
app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  
  if (!phone || !message) {
    return res.status(400).json({ success: false, message: 'Nomor telepon (phone) dan pesan (message) harus diisi!' })
  }
  
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(500).json({ success: false, message: 'WhatsApp Gateway belum terhubung!' })
  }
  
  let formattedPhone = phone.replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1)
  }
  
  const jid = `${formattedPhone}@s.whatsapp.net`
  
  try {
    console.log(`[WA-Gateway] Mengirim pesan ke ${jid}...`)
    const result = await sock.sendMessage(jid, { text: message })
    
    res.json({
      success: true,
      message: 'Pesan berhasil dikirim!',
      message_id: result.key.id
    })
  } catch (err) {
    console.error(`[WA-Gateway] Gagal mengirim pesan ke ${phone}`, err)
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan', error: err.message })
  }
})

// Start server Express
app.listen(PORT, () => {
  console.log(`[WA-Gateway] Express server berjalan di port ${PORT}`)
  startWhatsApp()
})
