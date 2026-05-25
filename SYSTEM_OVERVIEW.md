# Parlaq Agency Call Center — Sistem Dokümantasyonu

## Proje Özeti

Parlaq Agency için geliştirilmiş, tam özellikli bir call center yönetim panelidir. Tarayıcı tabanlı softphone (JsSIP), otomatik arama kampanyaları, gerçek zamanlı çağrı yönetimi ve çalışan/admin ayrımı içerir.

## Teknoloji Stack

### Frontend
- **React 18** + **Vite**
- **Tailwind CSS** — tüm stil
- **Framer Motion** — animasyonlar
- **Zustand** — state management (persist middleware ile)
- **JsSIP** — WebRTC tabanlı browser softphone
- **Socket.io-client** — gerçek zamanlı bildirimler
- **Lucide React** — ikonlar
- **Axios** — HTTP istekleri

### Backend
- **Node.js** + **Express**
- **PostgreSQL** (Supabase Session Pooler üzerinden)
- **Socket.io** — WebSocket sunucusu
- **JWT** — authentication (12 saat geçerlilik)
- **bcrypt** — şifre hashleme
- **Netgsm Netsantral HTTP API** — PBX entegrasyonu

---

## Veritabanı Şeması

### `agents` tablosu
```sql
id, name, email, extension (varchar, örn: "101"), password (bcrypt), role ("admin"|"agent"),
status ("available"|"busy"|"break"|"offline"), sip_password, created_at
```

### `customers` tablosu
```sql
id, phone (unique), name, email, notes, created_at, updated_at
```

### `call_logs` tablosu
```sql
id, unique_id, agent_id (FK agents), customer_id (FK customers),
customer_phone, direction ("inbound"|"outbound"),
status ("ringing"|"answered"|"missed"),
duration (integer, saniye), disposition (varchar),
notes (text), callback_at (timestamp),
created_at, ended_at
```

### `call_campaigns` tablosu
```sql
id, name, status ("pending"|"running"|"paused"|"completed"),
total_contacts, called_count, answered_count,
created_by (FK agents), notes, created_at, started_at, completed_at
```

### `campaign_contacts` tablosu
```sql
id, campaign_id (FK), phone, name, status ("pending"|"calling"|"answered"|"missed"),
called_at, extension_used, call_log_id (FK), attempt_count, created_at
```

### `appointments` tablosu
```sql
id, agent_id (FK), customer_id (FK), customer_phone, customer_name,
title, notes, scheduled_at, status ("pending"|"done"|"cancelled"), created_at
```

---

## Authentication Sistemi

- **Çalışan girişi**: `extension` + `password` ile → `/api/auth/login`
- **Admin girişi**: `email` + `password` ile → `/api/auth/admin-login`
- JWT token 12 saat geçerli, localStorage'da (Zustand persist)
- `authStore` içinde: `agent`, `token`, `isAdmin` state'leri
- `refreshMe`: sadece HTTP 401'de logout yapar, network hatalarında yapmaz (kritik)
- Token'a agent bilgisi embed: `id, name, email, extension, role, sip_password`
- **Beni Hatırla**: `localStorage` içinde `parlaq_remember_agent` / `parlaq_remember_admin` key ile form bilgilerini saklar

---

## SIP / Softphone Sistemi (JsSIP)

### Bağlantı Bilgileri
```
WSS: wss://sip9.netsantral.com:8089/ws
SIP Domain: sip9.netsantral.com
SIP Trunk: 8503088214
SIP Username format: {extension}-{trunk} (örn: 101-8503088214)
```

### `sipStore` (Zustand, persist'siz)
State: `ua, session, incomingSession, registered, registering, callStatus, callPhone, muted, callLogId`

Metodlar:
- `init(agent)`: mikrofon ister, JsSIP UA oluşturur, kayıt başlatır
- `makeCall(phone, logId)`: outbound çağrı, remote audio stream'i `#sip-remote-audio` elementine bağlar
- `answer()`: gelen çağrıyı yanıtlar
- `reject()`: gelen çağrıyı reddeder
- `hangup()`: aktif çağrıyı kapatır
- `toggleMute()`: mikrofonu sessize alır/açar

### Çağrı Akışı
1. Login → App.jsx `agent.sip_password` varsa `initSip(agent)` çağrılır
2. Outbound: `makeCall` → JsSIP `ua.call()` → CDR `/api/calls/log` kaydedilir
3. Inbound: `ua.on('newRTCSession')` → `incomingSession` state güncellenir → SoftphoneWidget ring gösterir
4. Çağrı biterken: `callStatus: null`, session temizlenir, 8sn post-call panel açık kalır

---

## Frontend Route Yapısı

```
/login          → Login sayfası (çalışan + admin modal)
/                → AdminRoute → /dashboard
/dashboard       → Admin ana sayfa (istatistikler)
/calls           → Çağrı geçmişi
/customers       → Müşteri yönetimi
/appointments    → Randevu yönetimi
/campaigns       → Kampanya yönetimi
/agents          → Çalışan yönetimi
/reports         → Raporlar
/agent           → AgentRoute → Çalışan workspace
/setup           → Kurulum sayfası
```

**AdminRoute**: agent yoksa → /login, agent varsa ama role !== 'admin' → /agent
**AgentRoute**: agent yoksa → /login, agent varsa ama role === 'admin' → /dashboard

---

## Çalışan Workspace (`/agent`)

Tam ekran, sidebar yok. 3 sütun layout:

### Sol Sütun (w-72): `CustomerList`
- Aranacak müşteri listesi
- Arama yap butonu → `handleCallStart`

### Orta Sütun (flex-1)
- Aktif çağrı varsa: `CallInfoPanel`
- Yoksa: çevirme formu / boş durum

### Sağ Sütun (w-72)
- `MyCallHistory`: bugünün çağrı geçmişi
- `TodayAppointments`: bugünün randevuları

### Header
- Ad/dahili, durum badge, durum aksiyonları (Göreve Başla / Mola / Moladan Dön)
- Mini istatistikler (toplam/cevaplanan/kaçan)
- Randevu Al butonu → `AppointmentModal`
- Logout

### Kritik Kural
`handleCallStart` ve `handleCallEnd` içinde `refreshMe()` çağrılmaz. Sadece local state güncellenir. (Önceden burası logout bug'ına yol açıyordu)

---

## CallInfoPanel Bileşeni

Her çağrıda (inbound/outbound) açılan bilgi/not paneli.

### İçerik
- Müşteri adı, telefon, daha önce kaç kez arandı
- Son 5 çağrı geçmişi (tarih, süre, sonuç)
- **8 Disposition butonu**:
  - `interested` — İlgileniyor
  - `not_interested` — İlgilenmiyor
  - `appointment` — Randevu Alındı
  - `callback` — Geri Ara (datetime picker açar)
  - `no_audio` — Ses Yok
  - `busy` — Meşgul
  - `no_answer` — Cevap Yok
  - `wrong_number` — Yanlış Numara
- Not alanı (textarea)
- Geri arama tarihi seçici (`callback` disposition seçilince görünür)
- Çağrı kontrolleri: Sessiz / Transfer / Kapat

### Kaydetme
`PATCH /api/calls/:id/disposition` → disposition, notes, callback_at kaydeder
`callback` + `callback_at` varsa otomatik randevu oluşturur

### Yaşam Döngüsü
- Çağrı başlarken açılır
- Çağrı bitince 8 saniye daha açık kalır (post-call notlar için)

---

## SoftphoneWidget Bileşeni

Fixed bottom-right köşede yüzen widget.

### Durum Göstergesi (Pill)
- Yeşil: SIP kayıtlı
- Amber (pulse): Bağlanıyor
- Gri: Bağlı değil

### Gelen Çağrı Kartı
- Web Audio API ile zil sesi (480Hz sinüs dalgası, 1.8sn aralıklarla)
- Arayan numara
- Cevapla / Reddet butonları

### Aktif Çağrı Kartı
- Numarayı gösterir
- Çağrı sayacı (mm:ss)
- Sessiz / Çağrı Kartı (📋) / Kapat butonları
- 📋 butonu → `CallInfoPanel` overlay açar

---

## Otomatik Arama Kampanyaları

### Dialer Engine (`backend/src/dialer/index.js`)
- `setInterval(tick, 4000)` — 4 saniyede bir çalışır
- `tick()`:
  1. `running` statüsündeki kampanyayı al
  2. `available` statüsündeki ajanları al
  3. `pending` statüsündeki contactları atomik SQL UPDATE ile kilitle
  4. Her ajan için Netgsm API ile çağrı başlat
  5. CDR kaydı oluştur
  6. Socket event yayınla
- Takılma koruması: 6+ dakika `calling` kalan contact'lar `pending`'e döner

### Kampanya İş Akışı
1. CSV yükle → `campaign_contacts` tablosuna kaydet
2. Kampanyayı `running`'e al
3. Dialer otomatik çalışır, boş ajan buldukça arar
4. Tüm contactlar tamamlanınca `completed`'a geçer

### API Endpoints
```
POST   /api/campaigns           — Yeni kampanya oluştur
GET    /api/campaigns           — Kampanya listesi
GET    /api/campaigns/:id       — Kampanya detayı
PATCH  /api/campaigns/:id       — Durum güncelle (start/pause/resume/stop)
POST   /api/campaigns/:id/contacts — CSV contact yükle
GET    /api/campaigns/:id/stats — Gerçek zamanlı istatistikler
```

---

## Çağrı API Endpoints

```
POST   /api/calls/start         — Netgsm outbound çağrı başlat
POST   /api/calls/hangup        — Netgsm çağrıyı kapat
POST   /api/calls/mute          — Netgsm sessiz
POST   /api/calls/transfer      — Netgsm transfer
GET    /api/calls/history       — Tüm çağrı geçmişi (admin)
GET    /api/calls/active        — Aktif çağrılar
GET    /api/calls/today-stats   — Bugünün özet istatistikleri
GET    /api/calls/my-stats      — Çalışanın bugünkü istatistikleri
GET    /api/calls/my-history    — Çalışanın bugünkü çağrıları
GET    /api/calls/by-phone/:phone — Telefona göre geçmiş
POST   /api/calls/log           — JsSIP CDR kaydı (Netgsm API yok)
PATCH  /api/calls/:id/disposition — Sonuç/not kaydet
```

---

## Socket.io Events

### Sunucudan İstemciye
- `agent_status_changed` — Ajan durumu değişti `{ agentId, status }`
- `call_started` — Çağrı başladı `{ callLog }`
- `call_ended` — Çağrı bitti `{ callLogId, duration }`
- `campaign_call_started` — Kampanya araması başladı
- `campaign_stats` — Kampanya istatistik güncellemesi
- `campaign_completed` — Kampanya tamamlandı

---

## Mevcut Çalışanlar (Seed Data)

| Ad | Dahili | SIP Username | Şifre |
|---|---|---|---|
| Ayşe Kaya | 101 | 101-8503088214 | sip101pass |
| Mehmet Demir | 102 | 102-8503088214 | sip102pass |
| Fatma Yıldız | 103 | 103-8503088214 | sip103pass |
| Ali Çelik | 104 | 104-8503088214 | sip104pass |
| Eylem Gültekce | 105 | 105-8503088214 | eylemm123 (SIP: Eylem123Eylem) |

Admin: `unlukaann@gmail.com` / `Dilarakaan0308.`

---

## Klasör Yapısı

```
Parlaq Call Center/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AgentWorkspace.jsx
│   │   │   ├── Calls.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Appointments.jsx
│   │   │   ├── Campaigns.jsx
│   │   │   ├── Agents.jsx
│   │   │   └── Reports.jsx
│   │   ├── components/
│   │   │   ├── SoftphoneWidget.jsx
│   │   │   ├── CallInfoPanel.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── ...
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   └── sipStore.js
│   │   └── App.jsx
│   └── .env
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── authRoutes.js
    │   │   ├── callRoutes.js
    │   │   ├── customerRoutes.js
    │   │   ├── agentRoutes.js
    │   │   ├── appointmentRoutes.js
    │   │   └── campaignRoutes.js
    │   ├── dialer/
    │   │   └── index.js
    │   ├── api/
    │   │   └── netgsm.js
    │   └── db/
    │       └── queries.js
    ├── migrate.js
    └── seed.js
```

---

## Bilinen Kısıtlamalar / Eksikler

1. **Raporlar sayfası** — temel istatistikler var, gelişmiş filtreleme/grafik yok
2. **Transfer özelliği** — backend mevcut ama UI'da tam implement edilmedi
3. **Müşteri notları** — call_logs'ta var ama customers tablosunda ayrı notes yok
4. **Kampanya önceliklendirme** — şu an FIFO, öncelik sıralaması yok
5. **Çoklu kampanya** — aynı anda sadece 1 kampanya `running` olabilir
6. **Inbound çağrı CDR** — JsSIP ile gelen çağrılar için CDR otomatik kayıt yok (sadece outbound log)
7. **Kayıt** — çağrı kayıt özelliği yok
8. **Darkmode** — yok, sadece light theme

---

## Önemli Bug Geçmişi

**Arama yapınca login'e atıyordu:**
- Neden: `refreshMe` herhangi bir hata aldığında (network timeout dahil) `logout()` çağırıyordu
- Çözüm: Sadece HTTP 401'de logout, diğer hatalarda sessiz geç
- Çözüm 2: `handleCallStart/End` içinden `refreshMe()` çağrıları tamamen kaldırıldı

**`my-history` tüm geçmişi getiriyordu:**
- Çözüm: SQL'e `DATE(cl.created_at) = CURRENT_DATE` filtresi eklendi

**Sayfa yenilenince SIP bağlanmıyordu:**
- Neden: Persist'li `agent` objesi `sip_password` içermiyordu (eski token)
- Çözüm: App.jsx'te `sip_password` yoksa `/api/auth/me` ile sessizce güncelle
