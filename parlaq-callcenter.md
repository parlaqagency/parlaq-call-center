# Parlaq Agency — Call Center Paneli

## Proje Özeti

Parlaq Agency için özel geliştirilmiş, Netgsm Netsantral API ile entegre çalışan tam fonksiyonlu bir çağrı merkezi yönetim paneli. Çalışanlar bu panel üzerinden müşterileri arayabilir, gelen aramaları yönetebilir, kuyruk durumlarını takip edebilir ve raporlara erişebilir.

---

## Teknik Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Veritabanı**: PostgreSQL
- **Gerçek Zamanlı**: WebSocket (Socket.io)
- **API Entegrasyonu**: Netgsm Netsantral API (HTTP GET + TCP Socket + Webhook)
- **Stil**: Tailwind CSS

---

## Netgsm API Bağlantı Bilgileri

```env
NETGSM_USERNAME=8503088214
NETGSM_PASSWORD=[API_SIFRESI]
NETGSM_TRUNK=8503088214
NETGSM_API_BASE=https://crmsntrl.netgsm.com.tr
NETGSM_SOCKET_HOST=crmsntrl.netgsm.com.tr
NETGSM_SOCKET_PORT=9110
NETGSM_REPORT_URL=https://api.netgsm.com.tr/netsantral/report
NETGSM_STATS_URL=https://api.netgsm.com.tr/netsantral/statistics
NETGSM_AUTOCALL_URL=https://api.netgsm.com.tr/autocallservice
```

---

## Proje Klasör Yapısı

```
parlaq-callcenter/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── netgsm.js          # Tüm Netgsm API çağrıları
│   │   │   ├── calls.js           # Çağrı başlatma/sonlandırma
│   │   │   ├── queue.js           # Kuyruk yönetimi
│   │   │   ├── agents.js          # Çalışan yönetimi
│   │   │   ├── autocall.js        # Otomatik arama
│   │   │   └── reports.js         # CDR ve istatistikler
│   │   ├── socket/
│   │   │   ├── netgsmSocket.js    # Netsantral TCP socket bağlantısı
│   │   │   └── webhookHandler.js  # Webhook olayları
│   │   ├── routes/
│   │   │   ├── callRoutes.js
│   │   │   ├── agentRoutes.js
│   │   │   ├── queueRoutes.js
│   │   │   ├── reportRoutes.js
│   │   │   └── autocallRoutes.js
│   │   ├── db/
│   │   │   ├── schema.sql         # Veritabanı şeması
│   │   │   └── queries.js         # DB sorguları
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Header.jsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── LiveCallPanel.jsx
│   │   │   │   ├── AgentStatusGrid.jsx
│   │   │   │   └── QueueStatus.jsx
│   │   │   ├── Calls/
│   │   │   │   ├── CallDialer.jsx
│   │   │   │   ├── ActiveCall.jsx
│   │   │   │   └── CallHistory.jsx
│   │   │   ├── Agents/
│   │   │   │   ├── AgentCard.jsx
│   │   │   │   └── AgentList.jsx
│   │   │   ├── AutoCall/
│   │   │   │   ├── CampaignCreate.jsx
│   │   │   │   └── CampaignList.jsx
│   │   │   └── Reports/
│   │   │       ├── CDRTable.jsx
│   │   │       ├── StatsChart.jsx
│   │   │       └── AudioPlayer.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Calls.jsx
│   │   │   ├── Agents.jsx
│   │   │   ├── AutoCall.jsx
│   │   │   └── Reports.jsx
│   │   ├── store/
│   │   │   ├── callStore.js       # Zustand store
│   │   │   ├── agentStore.js
│   │   │   └── queueStore.js
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── useCallCenter.js
│   │   └── App.jsx
│   └── package.json
└── README.md
```

---

## Veritabanı Şeması (PostgreSQL)

```sql
-- Çalışanlar tablosu
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  extension VARCHAR(10) NOT NULL UNIQUE,  -- Dahili numara (101, 102 vb.)
  phone VARCHAR(15),
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'offline',   -- offline, available, busy, break
  queue VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Müşteriler tablosu
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100),
  company VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Çağrı geçmişi tablosu
CREATE TABLE call_logs (
  id SERIAL PRIMARY KEY,
  unique_id VARCHAR(50),
  agent_id INTEGER REFERENCES agents(id),
  customer_id INTEGER REFERENCES customers(id),
  customer_phone VARCHAR(15),
  direction VARCHAR(10),    -- inbound, outbound
  status VARCHAR(20),       -- answered, missed, busy
  duration INTEGER,         -- saniye
  recording_url TEXT,
  notes TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Otomatik arama kampanyaları
CREATE TABLE autocall_campaigns (
  id SERIAL PRIMARY KEY,
  netgsm_list_id VARCHAR(20),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_numbers INTEGER DEFAULT 0,
  called_numbers INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Molalar tablosu
CREATE TABLE breaks (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id),
  reason VARCHAR(100),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);
```

---

## Backend — Netgsm API Modülü

### `backend/src/api/netgsm.js`

```javascript
const axios = require('axios');
const net = require('net');

const config = {
  username: process.env.NETGSM_USERNAME,
  password: process.env.NETGSM_PASSWORD,
  trunk: process.env.NETGSM_TRUNK,
  baseUrl: process.env.NETGSM_API_BASE,
  socketHost: process.env.NETGSM_SOCKET_HOST,
  socketPort: parseInt(process.env.NETGSM_SOCKET_PORT),
};

// HTTP GET ile dış numaraya çağrı başlat
async function startOutboundCall({ customerPhone, extensionNumber, crmId }) {
  const url = `${config.baseUrl}/${config.username}/originate`;
  const params = {
    username: config.username,
    password: config.password,
    customer_num: customerPhone,
    pbxnum: config.username,
    internal_num: extensionNumber,
    ring_timeout: 30,
    crm_id: crmId,
    wait_response: 1,
    originate_order: 'if',
    trunk: config.trunk,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çağrıyı sonlandır
async function hangupCall({ uniqueId, crmId }) {
  const url = `${config.baseUrl}/${config.username}/hangup`;
  const params = {
    username: config.username,
    password: config.password,
    unique_id: uniqueId,
    crm_id: crmId,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çağrıyı sessize al / aç
async function muteCall({ uniqueId, crmId, direction = 'all', state = 'mute' }) {
  const url = `${config.baseUrl}/${config.username}/muteaudio`;
  const params = {
    username: config.username,
    password: config.password,
    unique_id: uniqueId,
    crm_id: crmId,
    direction,
    state,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çağrıyı transfer et (kör transfer)
async function transferCall({ uniqueId, crmId, extension }) {
  const url = `${config.baseUrl}/${config.username}/xfer`;
  const params = {
    username: config.username,
    password: config.password,
    unique_id: uniqueId,
    crm_id: crmId,
    exten: extension,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Kuyruk durumunu sorgula
async function getQueueStats({ queueName, crmId }) {
  const url = `${config.baseUrl}/${config.username}/queuestats`;
  const params = {
    username: config.username,
    password: config.password,
    queue: queueName,
    crm_id: crmId,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çalışanı kuyruğa ekle
async function agentLogin({ extension, queue, crmId, paused = 0, penalty = 1 }) {
  const url = `${config.baseUrl}/${config.username}/agentlogin`;
  const params = {
    username: config.username,
    password: config.password,
    exten: extension,
    queue,
    crm_id: crmId,
    paused,
    penalty,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çalışanı kuyruktan çıkar
async function agentLogoff({ extension, queue, crmId }) {
  const url = `${config.baseUrl}/${config.username}/agentlogoff`;
  const params = {
    username: config.username,
    password: config.password,
    exten: extension,
    queue,
    crm_id: crmId,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// Çalışanı molaya al / çıkar
async function agentPause({ extension, queue, crmId, paused, reason = '' }) {
  const url = `${config.baseUrl}/${config.username}/agentpause`;
  const params = {
    username: config.username,
    password: config.password,
    exten: extension,
    queue,
    crm_id: crmId,
    paused,
    reason,
  };
  const response = await axios.get(url, { params });
  return response.data;
}

// CDR raporu çek
async function getCDR({ startDate, stopDate, queryType, phone }) {
  const url = process.env.NETGSM_REPORT_URL;
  const body = {
    usercode: config.username,
    password: config.password,
    startdate: startDate,
    stopdate: stopDate,
  };
  if (queryType && phone) {
    body.querytype = queryType;
    body.no = [phone];
  }
  const response = await axios.post(url, body);
  return response.data;
}

// Gelen çağrı istatistikleri
async function getCallStats({ startDate, stopDate }) {
  const url = process.env.NETGSM_STATS_URL;
  const xmlBody = `<?xml version="1.0"?>
<mainbody>
  <header>
    <usercode>${config.username}</usercode>
    <password>${config.password}</password>
    <startdate>${startDate}</startdate>
    <stopdate>${stopDate}</stopdate>
  </header>
</mainbody>`;
  const response = await axios.post(url, xmlBody, {
    headers: { 'Content-Type': 'text/xml' },
  });
  return response.data;
}

module.exports = {
  startOutboundCall,
  hangupCall,
  muteCall,
  transferCall,
  getQueueStats,
  agentLogin,
  agentLogoff,
  agentPause,
  getCDR,
  getCallStats,
};
```

---

### `backend/src/socket/netgsmSocket.js` — Gerçek Zamanlı Santral Dinleme

```javascript
const net = require('net');
const { EventEmitter } = require('events');

class NetgsmSocket extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.reconnectTimer = null;
  }

  connect() {
    this.socket = new net.Socket();
    this.socket.setTimeout(0);

    this.socket.connect(
      parseInt(process.env.NETGSM_SOCKET_PORT),
      process.env.NETGSM_SOCKET_HOST,
      () => {
        this.connected = true;
        console.log('Netsantral socket bağlandı');
        this._login();
      }
    );

    this.socket.on('data', (data) => {
      try {
        const events = data.toString().trim().split('\n');
        events.forEach((eventStr) => {
          if (eventStr) {
            const event = JSON.parse(eventStr);
            this._handleEvent(event);
          }
        });
      } catch (err) {
        console.error('Socket veri parse hatası:', err);
      }
    });

    this.socket.on('close', () => {
      this.connected = false;
      console.log('Netsantral socket kapandı, yeniden bağlanıyor...');
      this._reconnect();
    });

    this.socket.on('error', (err) => {
      console.error('Netsantral socket hatası:', err);
    });
  }

  _login() {
    const loginMsg = JSON.stringify({
      command: 'login',
      crm_id: 'parlaq_socket',
      username: process.env.NETGSM_USERNAME,
      password: process.env.NETGSM_PASSWORD,
    });
    this.socket.write(loginMsg);
  }

  _handleEvent(event) {
    // Tüm olayları emit et — frontend WebSocket üzerinden dinleyecek
    switch (event.scenario) {
      case 'Inbound_call':
        this.emit('inbound_call', event);
        break;
      case 'Outbound_call':
        this.emit('outbound_call', event);
        break;
      case 'Answer':
        this.emit('call_answered', event);
        break;
      case 'Hangup':
        this.emit('call_hangup', event);
        break;
      case 'Queue':
        this.emit('queue_event', event);
        break;
      case 'QueueLeave':
        this.emit('queue_leave', event);
        break;
      case 'cdr':
        this.emit('cdr', event);
        break;
      default:
        this.emit('event', event);
    }
  }

  _reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      console.log('Yeniden bağlanılıyor...');
      this.connect();
    }, 5000);
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}

module.exports = new NetgsmSocket();
```

---

### `backend/src/server.js`

```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const netgsmSocket = require('./socket/netgsmSocket');

const callRoutes = require('./routes/callRoutes');
const agentRoutes = require('./routes/agentRoutes');
const queueRoutes = require('./routes/queueRoutes');
const reportRoutes = require('./routes/reportRoutes');
const autocallRoutes = require('./routes/autocallRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/calls', callRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/autocall', autocallRoutes);

// Webhook endpoint — Netgsm'den gelen anlık olaylar
app.post('/webhook/netgsm', (req, res) => {
  const event = req.body;
  io.emit('santral_event', event);
  res.sendStatus(200);
});

// Netsantral socket olaylarını frontend WebSocket'e yayınla
netgsmSocket.on('inbound_call', (data) => io.emit('inbound_call', data));
netgsmSocket.on('outbound_call', (data) => io.emit('outbound_call', data));
netgsmSocket.on('call_answered', (data) => io.emit('call_answered', data));
netgsmSocket.on('call_hangup', (data) => io.emit('call_hangup', data));
netgsmSocket.on('queue_event', (data) => io.emit('queue_event', data));
netgsmSocket.on('cdr', (data) => io.emit('cdr', data));

// Netsantral socket'e bağlan
netgsmSocket.connect();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Parlaq Call Center backend çalışıyor: http://localhost:${PORT}`);
});
```

---

## Frontend — Panel Tasarımı ve Özellikleri

### Renk Paleti (Parlaq Agency)

```css
:root {
  --bg-primary: #0a0e1a;       /* Koyu lacivert arka plan */
  --bg-secondary: #111827;     /* Panel arka planı */
  --bg-card: #1a2235;          /* Kart arka planı */
  --accent-blue: #3b82f6;      /* Elektrik mavi */
  --accent-cyan: #06b6d4;      /* Cyan vurgu */
  --text-primary: #f1f5f9;     /* Ana metin */
  --text-secondary: #94a3b8;   /* İkincil metin */
  --success: #10b981;          /* Yeşil — müsait */
  --warning: #f59e0b;          /* Sarı — meşgul */
  --danger: #ef4444;            /* Kırmızı — sorun */
  --break: #8b5cf6;            /* Mor — molada */
}
```

---

### Sayfa 1: Dashboard (Ana Panel)

**URL**: `/dashboard`

**Bileşenler:**

```
┌─────────────────────────────────────────────────────┐
│  PARLAQ AGENCY          [Canlı: 3 Aktif Çağrı] 🔴  │
├──────────┬──────────────────────────────────────────┤
│          │  📊 ÖZET KARTLAR                         │
│ Sidebar  │  [Bugün: 47 Çağrı] [Cevaplanan: 42]     │
│          │  [Cevapsız: 5] [Ort. Süre: 3:24]        │
│ Dashboard│                                           │
│ Çağrılar │  👥 ÇALIŞAN DURUM GRID                  │
│ Çalışanlar│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│ Oto Arama│  │Özle │ │Ayşe │ │Mehm │ │Duyg │      │
│ Raporlar │  │ 🟢  │ │ 🔴  │ │ 🟡  │ │ 🟣  │      │
│          │  │Müsait│ │Meşgul│ │Molada│ │Çevrimd│  │
│          │  └─────┘ └─────┘ └─────┘ └─────┘      │
│          │                                           │
│          │  📞 CANLI ÇAĞRILAR                       │
│          │  [Özle ← 0532xxx] 02:34 [Sessize][Transfer]│
│          │  [Ayşe ← 0543xxx] 01:12 [Sessize][Transfer]│
│          │                                           │
│          │  ⏳ KUYRUKTA BEKLEYENLER                  │
│          │  [0555xxx — 00:45 bekledi]               │
└──────────┴──────────────────────────────────────────┘
```

---

### Sayfa 2: Çağrı Ekranı

**URL**: `/calls`

**Özellikler:**
- Müşteri numarası gir → **Ara** butonu
- Müşteri listesinden tıkla → otomatik ara
- Aktif çağrıda: Sessize Al / Aç, Transfer Et, Sonlandır butonları
- Çağrı geçmişi tablosu (tarih, numara, süre, ses kaydı)
- Ses kaydı dinleme player (Netgsm player entegrasyonu)

```jsx
// CallDialer.jsx — Örnek yapı
function CallDialer() {
  const [phone, setPhone] = useState('');
  const [activeCall, setActiveCall] = useState(null);

  const handleCall = async () => {
    const result = await fetch('/api/calls/start', {
      method: 'POST',
      body: JSON.stringify({
        customerPhone: phone,
        extensionNumber: currentAgent.extension,
      }),
    });
    const data = await result.json();
    if (data.unique_id) setActiveCall(data);
  };

  return (
    <div className="dialer">
      <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button onClick={handleCall}>📞 Ara</button>
      {activeCall && (
        <ActiveCallControls
          uniqueId={activeCall.unique_id}
          onHangup={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
```

---

### Sayfa 3: Çalışan Yönetimi

**URL**: `/agents`

**Özellikler:**
- Çalışan ekle / düzenle / sil
- Dahili numara ata (101, 102, 103...)
- Kuyruğa ekle / çıkar
- Molaya al / moladan çıkar (sebep seç: Yemek, Tuvalet, Toplantı)
- Çalışan bazlı günlük çağrı istatistikleri

---

### Sayfa 4: Otomatik Arama Kampanyaları

**URL**: `/autocall`

**Özellikler:**
- Yeni kampanya oluştur
- Excel/CSV ile numara listesi yükle
- Kampanya başlat / durdur / devam ettir
- Gerçek zamanlı kampanya ilerleme çubuğu
- Çağrı sonuçları raporu (başarılı / başarısız / cevapsız)

---

### Sayfa 5: Raporlar

**URL**: `/reports`

**Özellikler:**
- Tarih aralığı seç
- Gelen/giden çağrı istatistikleri grafik
- CDR tablosu (filtrelenebilir, aranabilir)
- Ses kaydı dinleme player
- CSV olarak dışa aktar
- Çalışan performans tablosu

---

## Backend API Endpoint Listesi

### Çağrı İşlemleri
```
POST   /api/calls/start          — Çağrı başlat
POST   /api/calls/hangup         — Çağrı sonlandır
POST   /api/calls/mute           — Sessize al/aç
POST   /api/calls/transfer       — Transfer et
GET    /api/calls/history        — Çağrı geçmişi
GET    /api/calls/active         — Aktif çağrılar
```

### Çalışan İşlemleri
```
GET    /api/agents               — Tüm çalışanlar
POST   /api/agents               — Yeni çalışan ekle
PUT    /api/agents/:id           — Çalışan güncelle
DELETE /api/agents/:id           — Çalışan sil
POST   /api/agents/:id/login     — Kuyruğa ekle
POST   /api/agents/:id/logoff    — Kuyruktan çıkar
POST   /api/agents/:id/pause     — Molaya al
POST   /api/agents/:id/unpause   — Moladan çıkar
```

### Kuyruk İşlemleri
```
GET    /api/queue/stats          — Kuyruk durumu
GET    /api/queue/waiting        — Bekleyenler
```

### Raporlar
```
GET    /api/reports/cdr          — Görüşme detayları
GET    /api/reports/stats        — İstatistikler
GET    /api/reports/agent/:id    — Çalışan raporu
```

### Otomatik Arama
```
GET    /api/autocall             — Tüm kampanyalar
POST   /api/autocall             — Yeni kampanya
POST   /api/autocall/:id/start   — Kampanya başlat
POST   /api/autocall/:id/stop    — Kampanya durdur
POST   /api/autocall/:id/numbers — Numara ekle
GET    /api/autocall/:id/report  — Kampanya raporu
```

---

## Kurulum Adımları

```bash
# 1. Backend kurulum
cd backend
npm install
cp .env.example .env
# .env dosyasına API bilgilerini gir

# 2. Veritabanı oluştur
psql -U postgres -c "CREATE DATABASE parlaq_callcenter;"
psql -U postgres -d parlaq_callcenter -f src/db/schema.sql

# 3. Backend başlat
npm run dev

# 4. Frontend kurulum
cd ../frontend
npm install

# 5. Frontend başlat
npm run dev
```

---

## Önemli Notlar

1. **Dahili Numaralar**: Netsantral panelinden önce dahili numaraları tanımla (101, 102, 103...). Her çalışana bir dahili numarası atanacak. Çalışanlar bu dahili ile sisteme register olacak (Netgsm Softphone uygulaması ile).

2. **Webhook URL**: Backend deploy edilince Netsantral panelinden `Ayarlar > Genel Ayarlar > API Talep Ayarları` bölümünden webhook URL'ini kaydet: `https://[DOMAIN]/webhook/netgsm`

3. **Softphone**: Çalışanların aramaları tarayıcıdan alabilmesi için Netgsm Softphone uygulamasını kurmaları gerekiyor. Bu uygulama dahili numarayı register ediyor.

4. **CRM ID**: Her API isteğinde benzersiz bir `crm_id` gönderilmeli. `Date.now()` kullanılabilir.

5. **Kuyruk Adı**: Netsantral panelinde bir kuyruk oluştur (örn: `satis`, `destek`). Çalışanlar bu kuyruğa atanacak.

6. **Ses Kaydı**: Netsantral'de ses kaydı aktif olmalı. CDR'dan gelen `recording` URL'i panelde dinlenebilir.

---

## Geliştirme Öncelikleri

**Faz 1 (İlk Hafta):**
- [ ] Backend kurulum ve API bağlantısı
- [ ] Veritabanı şeması
- [ ] Çağrı başlatma ve sonlandırma
- [ ] Temel dashboard
- [ ] Çalışan listesi ve durum göstergesi

**Faz 2 (İkinci Hafta):**
- [ ] Gerçek zamanlı socket entegrasyonu
- [ ] Kuyruk yönetimi
- [ ] Çağrı transfer
- [ ] Mola yönetimi

**Faz 3 (Üçüncü Hafta):**
- [ ] CDR raporları
- [ ] Ses kaydı dinleme
- [ ] Otomatik arama kampanyaları
- [ ] İstatistik grafikleri

**Faz 4 (Dördüncü Hafta):**
- [ ] Müşteri kartı (kim aradı, geçmiş görüşmeler)
- [ ] Not ekleme
- [ ] CSV export
- [ ] Performans raporları
